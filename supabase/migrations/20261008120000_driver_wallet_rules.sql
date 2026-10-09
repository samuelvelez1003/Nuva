-- Driver wallet: safety fixes and the new commission rules (2026-10-08).
--
-- Commission rules (per country, in nuva_settings, editable in the admin console):
--   * Surcharges (night, airport) are 100 % the driver's: commission only on the fare.
--   * free_trips:     a new driver's first N completed trips pay no commission.
--   * tier_threshold / tier_pct: from the N-th completed trip of the month, a lower %.
--   * debt_allowance: how far below 0 a balance may go when accepting a trip.
-- The driver-specific commission is fixed when the driver ACCEPTS (accept_ride) and
-- stored on the trip, so what the driver sees before accepting is what is deducted.
--
-- Fixes: one active trip per driver (lock + unique index), test wallets no longer
-- rewrite history (commission_waived frozen per trip), admin adjustments record who
-- made them (+ per-currency cap and debt floor), audit log, promo budget race,
-- wallet history order and labels.

-- ── Settings ──────────────────────────────────────────────────────────────────
alter table public.nuva_settings
  add column if not exists free_trips integer not null default 10,
  add column if not exists tier_threshold integer not null default 100,
  add column if not exists tier_pct numeric not null default 10,
  add column if not exists debt_allowance integer not null default 10000;
update public.nuva_settings set tier_pct = 13, debt_allowance = 1000 where country = 'CW';
-- The free first trips replace the cash welcome bonus (harder to farm with fake accounts).
update public.nuva_settings set welcome_bonus = 0 where country = 'CO';

create or replace function public.update_settings(p jsonb)
returns public.nuva_settings
language plpgsql
security definer
set search_path = public
as $$
declare s public.nuva_settings; c text := coalesce(p ->> 'country', 'CO');
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.nuva_settings set
    welcome_bonus  = coalesce((p ->> 'welcome_bonus')::integer, welcome_bonus),
    min_topup      = coalesce((p ->> 'min_topup')::integer, min_topup),
    low_balance    = coalesce((p ->> 'low_balance')::integer, low_balance),
    free_trips     = coalesce((p ->> 'free_trips')::integer, free_trips),
    tier_threshold = coalesce((p ->> 'tier_threshold')::integer, tier_threshold),
    tier_pct       = coalesce((p ->> 'tier_pct')::numeric, tier_pct),
    debt_allowance = coalesce((p ->> 'debt_allowance')::integer, debt_allowance),
    updated_at = now(), updated_by = auth.uid()
  where country = c
  returning * into s;
  if not found then raise exception 'País no válido'; end if;
  if s.free_trips < 0 or s.tier_threshold < 1 or s.tier_pct < 0 or s.tier_pct > 40 or s.debt_allowance < 0 then
    raise exception 'Valores inválidos';
  end if;
  return s;
end $$;

-- ── Trips: per-trip commission facts ─────────────────────────────────────────
alter table public.trips
  add column if not exists commission_rule text not null default 'standard',
  add column if not exists commission_waived boolean not null default false;
-- Freeze today's test wallets onto their past trips, so balances don't change.
update public.trips t set commission_waived = true
  from public.profiles p where p.id = t.driver_id and p.test_wallet and t.status = 'completed';

-- One active trip per driver, enforced by the database.
create unique index if not exists trips_one_active_per_driver on public.trips (driver_id)
  where driver_id is not null and status in ('accepted', 'arriving', 'in_progress');

-- ── Audit log of admin money actions ─────────────────────────────────────────
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid default auth.uid(),
  action text not null,
  target uuid,
  details jsonb not null default '{}'::jsonb
);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;
drop policy if exists "admins read audit" on public.admin_audit;
create policy "admins read audit" on public.admin_audit for select to authenticated using (public.is_admin());

alter table public.driver_topups add column if not exists created_by uuid;

create or replace function public.audit_test_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.test_wallet is distinct from old.test_wallet then
    insert into public.admin_audit (action, target, details)
    values ('test_wallet', new.id, jsonb_build_object('from', old.test_wallet, 'to', new.test_wallet));
  end if;
  return new;
end $$;
revoke execute on function public.audit_test_wallet() from public, anon, authenticated;
drop trigger if exists profiles_audit_test_wallet on public.profiles;
create trigger profiles_audit_test_wallet after update of test_wallet on public.profiles
  for each row execute function public.audit_test_wallet();

-- ── Balance: commission of completed, non-waived trips ───────────────────────
create or replace function public.driver_balance(p_driver uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select (
      coalesce((select sum(amount) from public.driver_topups, me where driver_id = me.id and status = 'pagado'), 0)
    - coalesce((select sum(platform_commission) from public.trips, me
                 where driver_id = me.id and status = 'completed' and not commission_waived), 0)
  )::integer
$$;

-- ── The commission this driver would pay right now (shown before accepting) ──
create or replace function public.my_commission_rule()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (select id, coalesce(country, 'CO') c, coalesce(test_wallet, false) test from public.profiles where id = auth.uid()),
       s as (select n.* from public.nuva_settings n, p where n.country = p.c),
       tz as (select case p.c when 'CW' then 'America/Curacao' else 'America/Bogota' end z from p),
       done as (select count(*) n from public.trips, p where driver_id = p.id and status = 'completed'),
       month as (select count(*) n from public.trips, p, tz where driver_id = p.id and status = 'completed'
                   and completed_at >= date_trunc('month', now() at time zone tz.z) at time zone tz.z)
  select jsonb_build_object(
    'freeTrips', s.free_trips, 'freeLeft', greatest(s.free_trips - done.n, 0),
    'monthTrips', month.n, 'tierThreshold', s.tier_threshold, 'tierPct', s.tier_pct,
    'tierActive', month.n >= s.tier_threshold, 'debtAllowance', s.debt_allowance,
    'balance', public.driver_balance(auth.uid()), 'test', p.test)
  from p, s, done, month
$$;
revoke execute on function public.my_commission_rule() from public, anon;
grant execute on function public.my_commission_rule() to authenticated;

-- ── Accept: serialized per driver, driver-specific commission, debt floor ────
create or replace function public.accept_ride(p_trip uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips; t0 public.trips; me public.profiles; s public.nuva_settings;
        base integer; pct numeric; com integer; rule text := 'standard'; done integer; month integer; tz text;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  -- One accept at a time per driver (two taps on two requests can't both win).
  select * into me from public.profiles where id = auth.uid() for update;
  if exists (select 1 from public.trips where driver_id = auth.uid() and status in ('accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje activo';
  end if;
  select * into t0 from public.trips where id = p_trip for update;
  if not found or t0.status <> 'requested' or t0.passenger_id = auth.uid() then
    raise exception 'Este viaje ya fue tomado o cancelado';
  end if;
  if t0.country is distinct from me.country and not public.is_admin() then raise exception 'Este viaje es de otro país'; end if;

  select * into s from public.nuva_settings where country = coalesce(t0.country, 'CO');
  tz := case t0.country when 'CW' then 'America/Curacao' else 'America/Bogota' end;
  -- Commission base: the fare without surcharges (those are 100 % the driver's).
  base := t0.final_fare - coalesce((t0.fare ->> 'nightSurcharge')::integer, 0) - coalesce((t0.fare ->> 'airportSurcharge')::integer, 0);
  pct  := coalesce((t0.fare ->> 'commissionPct')::numeric, 0);
  com  := round(base * pct / 100);
  select count(*) into done from public.trips where driver_id = auth.uid() and status = 'completed';
  if done < coalesce(s.free_trips, 0) then
    com := 0; pct := 0; rule := 'free';
  else
    select count(*) into month from public.trips where driver_id = auth.uid() and status = 'completed'
       and completed_at >= date_trunc('month', now() at time zone tz) at time zone tz;
    if month >= coalesce(s.tier_threshold, 2147483647) and s.tier_pct < pct then
      pct := s.tier_pct; com := round(base * pct / 100); rule := 'tier';
    end if;
  end if;

  if not coalesce(me.test_wallet, false) and public.driver_balance(auth.uid()) - com < -coalesce(s.debt_allowance, 0) then
    raise exception 'Saldo insuficiente para la comisión de este viaje. Recarga tu saldo NÜVA';
  end if;

  update public.trips
     set driver_id = auth.uid(), status = 'accepted', accepted_at = now(),
         platform_commission = com, driver_earnings = final_fare - com, commission_rule = rule,
         commission_waived = coalesce(me.test_wallet, false),
         fare = fare || jsonb_build_object('commissionPct', pct, 'platformCommission', com, 'driverEarnings', final_fare - com, 'commissionRule', rule)
   where id = p_trip
  returning * into t;
  return t;
end $$;

-- ── Admin adjustments: who, why, per-currency cap, debt floor ────────────────
create or replace function public.admin_adjust_wallet(p_driver uuid, p_amount integer, p_reason text, p_kind text default 'ajuste')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare c text; cap integer; floor_ integer; bal integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_kind not in ('ajuste', 'manual') then raise exception 'Tipo inválido'; end if;
  select coalesce(country, 'CO') into c from public.profiles where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  -- Same real-world ceiling in both currencies (≈ US$250): 1.000.000 COP, 450 XCG (in cents).
  cap := case c when 'CW' then 45000 else 1000000 end;
  if p_amount is null or p_amount = 0 or abs(p_amount) > cap then raise exception 'Monto inválido'; end if;
  if p_kind = 'manual' and p_amount < 0 then raise exception 'Una recarga debe ser positiva'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Escribe el motivo o la referencia del pago'; end if;
  select -coalesce(debt_allowance, 0) into floor_ from public.nuva_settings where country = c;
  bal := public.driver_balance(p_driver);
  if p_amount < 0 and bal + p_amount < floor_ then raise exception 'El saldo quedaría por debajo del límite de deuda'; end if;
  insert into public.driver_topups (driver_id, amount, status, method, payment_ref, created_by)
  values (p_driver, p_amount, 'pagado', p_kind, left(trim(p_reason), 120), auth.uid());
  insert into public.admin_audit (action, target, details)
  values ('wallet_' || p_kind, p_driver, jsonb_build_object('amount', p_amount, 'reason', left(trim(p_reason), 120), 'balance_before', bal));
  return public.driver_balance(p_driver);
end $$;

-- ── Wallet: correct order, own labels, expired top-ups, commission rule ──────
create or replace function public.driver_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'test', coalesce((select test_wallet from public.profiles where id = auth.uid()), false),
    'movements', coalesce((
      select jsonb_agg(m order by m ->> 'at' desc) from (
        select m from (
          select jsonb_build_object(
                   'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' when 'promo' then 'promo' else 'recarga' end,
                   'amount', amount,
                   -- An abandoned checkout is shown as expired, not "processing" forever.
                   'status', case when status = 'pendiente' and created_at < now() - interval '1 hour' then 'vencido' else status end,
                   'at', created_at,
                   'note', case when method in ('ajuste', 'promo') then payment_ref end) as m
            from public.driver_topups where driver_id = auth.uid()
          union all
          select jsonb_build_object('kind', 'comision',
                   'amount', case when commission_waived then 0 else -platform_commission end,
                   'status', 'pagado', 'at', completed_at, 'code', code, 'rule', commission_rule)
            from public.trips where driver_id = auth.uid() and status = 'completed'
        ) u
        order by m ->> 'at' desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

-- ── Weekly summary: tips apart, and commission saved by the rules ────────────
create or replace function public.driver_summary(p_days integer default 1)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tz as (select case (select country from public.profiles where id = auth.uid()) when 'CW' then 'America/Curacao' else 'America/Bogota' end as z)
  select jsonb_build_object(
    'trips', count(*), 'gross', coalesce(sum(final_fare), 0),
    'commission', coalesce(sum(case when commission_waived then 0 else platform_commission end), 0),
    'tips', coalesce(sum(tip), 0),
    'surcharges', coalesce(sum(coalesce((fare ->> 'nightSurcharge')::integer, 0) + coalesce((fare ->> 'airportSurcharge')::integer, 0)), 0),
    'freeTrips', count(*) filter (where commission_rule = 'free'),
    'net', coalesce(sum(final_fare - case when commission_waived then 0 else platform_commission end + tip), 0)
  )
  from public.trips, tz
  where driver_id = auth.uid() and status = 'completed'
    and completed_at > date_trunc('day', now() at time zone tz.z) at time zone tz.z - make_interval(days => p_days - 1)
$$;
