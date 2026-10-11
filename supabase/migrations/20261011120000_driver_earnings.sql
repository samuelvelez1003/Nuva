-- More earnings for drivers and NÜVA without raising fares (2026-10-11).
--
-- Settings per country (nuva_settings, editable in the admin console):
--   wait_free_min / wait_per_min  — waiting at the pickup: free minutes, then per minute (100 % driver)
--   no_show_fee / no_show_wait_min — passenger cancels after the driver arrived, or doesn't show up
--                                    within N minutes: NÜVA credits the driver now and adds the fee to
--                                    the passenger's next trip (recovered from that trip's commission)
--   challenge_trips / challenge_pct — N completed trips this week → this % for the rest of the week
--   pass_price / pass_enabled      — weekly pass bought from the balance: no commission for 7 days
--   max_pickup_km                  — requests farther than this aren't offered to the driver (app)

alter table public.nuva_settings
  add column if not exists wait_free_min integer not null default 3,
  add column if not exists wait_per_min integer not null default 150,
  add column if not exists no_show_fee integer not null default 3000,
  add column if not exists no_show_wait_min integer not null default 5,
  add column if not exists challenge_trips integer not null default 40,
  add column if not exists challenge_pct numeric not null default 8,
  add column if not exists pass_price integer not null default 60000,
  add column if not exists pass_enabled boolean not null default true,
  add column if not exists max_pickup_km numeric not null default 4;
update public.nuva_settings
   set wait_per_min = 15, no_show_fee = 300, challenge_pct = 10, pass_price = 6000, max_pickup_km = 8
 where country = 'CW';

alter table public.trips
  add column if not exists arrived_at timestamptz,
  add column if not exists wait_fee integer not null default 0,
  add column if not exists cancel_fee integer not null default 0,
  add column if not exists cancelled_by text;
alter table public.profiles add column if not exists pending_fee integer not null default 0;

create table if not exists public.driver_passes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  country text not null,
  price integer not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists driver_passes_driver_idx on public.driver_passes (driver_id, ends_at desc);
alter table public.driver_passes enable row level security;
revoke all on public.driver_passes from anon;
grant select on public.driver_passes to authenticated;
drop policy if exists "own passes or admin" on public.driver_passes;
create policy "own passes or admin" on public.driver_passes for select to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin());

-- ── Settings ─────────────────────────────────────────────────────────────────
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
    welcome_bonus    = coalesce((p ->> 'welcome_bonus')::integer, welcome_bonus),
    min_topup        = coalesce((p ->> 'min_topup')::integer, min_topup),
    low_balance      = coalesce((p ->> 'low_balance')::integer, low_balance),
    free_trips       = coalesce((p ->> 'free_trips')::integer, free_trips),
    tier_threshold   = coalesce((p ->> 'tier_threshold')::integer, tier_threshold),
    tier_pct         = coalesce((p ->> 'tier_pct')::numeric, tier_pct),
    debt_allowance   = coalesce((p ->> 'debt_allowance')::integer, debt_allowance),
    wait_free_min    = coalesce((p ->> 'wait_free_min')::integer, wait_free_min),
    wait_per_min     = coalesce((p ->> 'wait_per_min')::integer, wait_per_min),
    no_show_fee      = coalesce((p ->> 'no_show_fee')::integer, no_show_fee),
    no_show_wait_min = coalesce((p ->> 'no_show_wait_min')::integer, no_show_wait_min),
    challenge_trips  = coalesce((p ->> 'challenge_trips')::integer, challenge_trips),
    challenge_pct    = coalesce((p ->> 'challenge_pct')::numeric, challenge_pct),
    pass_price       = coalesce((p ->> 'pass_price')::integer, pass_price),
    pass_enabled     = coalesce((p ->> 'pass_enabled')::boolean, pass_enabled),
    max_pickup_km    = coalesce((p ->> 'max_pickup_km')::numeric, max_pickup_km),
    updated_at = now(), updated_by = auth.uid()
  where country = c
  returning * into s;
  if not found then raise exception 'País no válido'; end if;
  if s.free_trips < 0 or s.tier_threshold < 1 or s.tier_pct < 0 or s.tier_pct > 40 or s.debt_allowance < 0
     or s.wait_free_min < 0 or s.wait_per_min < 0 or s.no_show_fee < 0 or s.no_show_wait_min < 1
     or s.challenge_trips < 1 or s.challenge_pct < 0 or s.challenge_pct > 40 or s.pass_price < 1 or s.max_pickup_km <= 0 then
    raise exception 'Valores inválidos';
  end if;
  return s;
end $$;

-- ── Request: a pending cancellation fee travels with the passenger's next trip ──
create or replace function public.request_ride(p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash',
  p_distance_km numeric default null, p_duration_min integer default null, p_promo_code text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text; z text; promo jsonb; pf integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  update public.trips set status = 'cancelled', cancelled_at = now()
   where passenger_id = auth.uid() and status = 'requested' and requested_at < now() - interval '15 minutes';
  if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje en curso';
  end if;
  select coalesce(country, 'CO'), coalesce(pending_fee, 0) into c, pf from public.profiles where id = auth.uid();
  z := public.zone_check(p_pickup, c);
  if z = 'paused' then raise exception 'El servicio está pausado temporalmente en esa zona'; end if;
  if z = 'outside' then raise exception 'Aún no operamos en ese punto de recogida'; end if;
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 2.0 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2.5 then p_duration_min else est.duration_min end;
  f    := public.calculate_fare(km, mins, p_category, null, c, p_pickup, p_destination, now());
  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
    perform 1 from public.promos where code = upper(btrim(p_promo_code)) for update;
    promo := public.check_promo(p_promo_code, (f ->> 'finalFare')::integer);
    if not (promo ->> 'ok')::boolean then raise exception '%', promo ->> 'error'; end if;
  end if;
  -- Paid by the passenger to this driver in cash; NÜVA already credited the previous
  -- driver, so it is recovered through this trip's commission (the driver's net is unchanged).
  if pf > 0 then
    f := f || jsonb_build_object('pendingFee', pf, 'finalFare', (f ->> 'finalFare')::integer + pf,
                                 'platformCommission', (f ->> 'platformCommission')::integer + pf);
  end if;
  insert into public.trips (passenger_id, category, payment, pickup, destination, distance_km, duration_min,
                            pricing_version, fare, final_fare, platform_commission, driver_earnings, country, currency,
                            promo_id, discount)
  values (auth.uid(), p_category, p_payment, p_pickup, p_destination, km, mins,
          (f ->> 'version')::integer, f, (f ->> 'finalFare')::integer,
          (f ->> 'platformCommission')::integer, (f ->> 'driverEarnings')::integer, c, public.country_currency(c),
          (promo ->> 'promoId')::uuid, coalesce((promo ->> 'discount')::integer, 0))
  returning * into t;
  return t;
end $$;

-- ── This driver's commission right now (shown before accepting) ──────────────
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
                   and completed_at >= date_trunc('month', now() at time zone tz.z) at time zone tz.z),
       week as (select count(*) n from public.trips, p, tz where driver_id = p.id and status = 'completed'
                   and completed_at >= date_trunc('week', now() at time zone tz.z) at time zone tz.z),
       pass as (select max(ends_at) e from public.driver_passes, p where driver_id = p.id and now() between starts_at and ends_at)
  select jsonb_build_object(
    'freeTrips', s.free_trips, 'freeLeft', greatest(s.free_trips - done.n, 0),
    'monthTrips', month.n, 'tierThreshold', s.tier_threshold, 'tierPct', s.tier_pct, 'tierActive', month.n >= s.tier_threshold,
    'weekTrips', week.n, 'challengeTrips', s.challenge_trips, 'challengePct', s.challenge_pct, 'challengeActive', week.n >= s.challenge_trips,
    'passEnabled', s.pass_enabled, 'passPrice', s.pass_price, 'passActive', pass.e is not null, 'passEndsAt', pass.e,
    'debtAllowance', s.debt_allowance, 'maxPickupKm', s.max_pickup_km,
    'waitFreeMin', s.wait_free_min, 'waitPerMin', s.wait_per_min, 'noShowFee', s.no_show_fee, 'noShowWaitMin', s.no_show_wait_min,
    'balance', public.driver_balance(auth.uid()), 'test', p.test)
  from p, s, done, month, week, pass
$$;
revoke execute on function public.my_commission_rule() from public, anon;
grant execute on function public.my_commission_rule() to authenticated;

-- ── Accept: free trips → weekly pass → lowest of volume / weekly challenge ───
create or replace function public.accept_ride(p_trip uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips; t0 public.trips; me public.profiles; s public.nuva_settings;
        base integer; pf integer; pct numeric; com integer; rule text := 'standard'; done integer; month integer; week integer; tz text;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
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
  pf   := coalesce((t0.fare ->> 'pendingFee')::integer, 0);
  -- Commission base: the fare without surcharges and without the passenger's pending fee.
  base := t0.final_fare - pf - coalesce((t0.fare ->> 'nightSurcharge')::integer, 0) - coalesce((t0.fare ->> 'airportSurcharge')::integer, 0);
  pct  := coalesce((t0.fare ->> 'commissionPct')::numeric, 0);
  select count(*) into done from public.trips where driver_id = auth.uid() and status = 'completed';
  if done < coalesce(s.free_trips, 0) then
    pct := 0; rule := 'free';
  elsif exists (select 1 from public.driver_passes where driver_id = auth.uid() and now() between starts_at and ends_at) then
    pct := 0; rule := 'pass';
  else
    select count(*) into month from public.trips where driver_id = auth.uid() and status = 'completed'
       and completed_at >= date_trunc('month', now() at time zone tz) at time zone tz;
    select count(*) into week from public.trips where driver_id = auth.uid() and status = 'completed'
       and completed_at >= date_trunc('week', now() at time zone tz) at time zone tz;
    if month >= coalesce(s.tier_threshold, 2147483647) and s.tier_pct < pct then pct := s.tier_pct; rule := 'tier'; end if;
    if week >= coalesce(s.challenge_trips, 2147483647) and s.challenge_pct < pct then pct := s.challenge_pct; rule := 'challenge'; end if;
  end if;
  -- The pending fee always goes back to NÜVA (it already paid the previous driver).
  com := round(base * pct / 100) + pf;

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

-- ── Advance: arrival time, paid waiting, pending fee settled on completion ───
create or replace function public.advance_ride(p_trip uuid, p_status public.trip_status, p_pin text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips; pin public.trip_pins; s public.nuva_settings; cur public.trips; mins integer; fee integer := 0;
begin
  if p_status = 'in_progress' then
    select * into pin from public.trip_pins where trip_id = p_trip for update;
    if not exists (select 1 from public.trips where id = p_trip and driver_id = auth.uid()) then
      raise exception 'Cambio de estado no permitido';
    end if;
    if pin.trip_id is not null then
      if pin.attempts >= 5 then
        raise exception 'Demasiados intentos. Pide al pasajero que revise su PIN o contacta soporte';
      end if;
      if p_pin is distinct from pin.pin then
        update public.trip_pins set attempts = attempts + 1 where trip_id = p_trip;
        -- Return null (not raise) so the attempt counter is kept; the app shows "PIN incorrecto".
        return null;
      end if;
    end if;
    -- Paid waiting: whole minutes at the pickup beyond the free ones, 100 % the driver's.
    select * into cur from public.trips where id = p_trip;
    if cur.arrived_at is not null then
      select * into s from public.nuva_settings where country = coalesce(cur.country, 'CO');
      mins := floor(extract(epoch from (now() - cur.arrived_at)) / 60)::integer - coalesce(s.wait_free_min, 0);
      if mins > 0 then fee := least(mins, 30) * coalesce(s.wait_per_min, 0); end if;
    end if;
  end if;

  update public.trips
     set status = p_status,
         arrived_at   = case when p_status = 'arriving' then now() else arrived_at end,
         started_at   = case when p_status = 'in_progress' then now() else started_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end,
         wait_fee        = case when p_status = 'in_progress' then fee else wait_fee end,
         final_fare      = case when p_status = 'in_progress' then final_fare + fee else final_fare end,
         driver_earnings = case when p_status = 'in_progress' then driver_earnings + fee else driver_earnings end,
         fare = case when p_status = 'in_progress' and fee > 0
                     then fare || jsonb_build_object('waitFee', fee, 'finalFare', final_fare + fee, 'driverEarnings', driver_earnings + fee)
                     else fare end
   where id = p_trip
     and driver_id = auth.uid()
     and (
       (status = 'accepted'    and p_status = 'arriving') or
       (status in ('accepted', 'arriving') and p_status = 'in_progress') or
       (status = 'in_progress' and p_status = 'completed')
     )
  returning * into t;
  if not found then raise exception 'Cambio de estado no permitido'; end if;

  -- The passenger paid their pending cancellation fee in this trip.
  if p_status = 'completed' and coalesce((t.fare ->> 'pendingFee')::integer, 0) > 0 then
    update public.profiles set pending_fee = greatest(0, pending_fee - (t.fare ->> 'pendingFee')::integer) where id = t.passenger_id;
  end if;
  return t;
end $$;

-- ── Cancel: a late cancellation / no-show compensates the driver ─────────────
create or replace function public.cancel_ride(p_trip uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips; t0 public.trips; s public.nuva_settings; who text; fee integer := 0;
begin
  select * into t0 from public.trips where id = p_trip for update;
  if not found or t0.status not in ('requested', 'accepted', 'arriving')
     or not (t0.passenger_id = auth.uid() or t0.driver_id = auth.uid() or public.is_admin()) then
    raise exception 'Este viaje ya no se puede cancelar';
  end if;
  who := case when auth.uid() = t0.passenger_id then 'passenger' when auth.uid() = t0.driver_id then 'driver' else 'admin' end;
  select * into s from public.nuva_settings where country = coalesce(t0.country, 'CO');
  -- The driver was already at the pickup: the passenger cancelled, or didn't show up in time.
  if t0.status = 'arriving' and t0.arrived_at is not null and t0.driver_id is not null
     and (who = 'passenger' or (who = 'driver' and now() - t0.arrived_at >= make_interval(mins => coalesce(s.no_show_wait_min, 5)))) then
    fee := coalesce(s.no_show_fee, 0);
  end if;

  update public.trips set status = 'cancelled', cancelled_at = now(), cancelled_by = who, cancel_fee = fee
   where id = p_trip
  returning * into t;

  if fee > 0 then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
    values (t.driver_id, fee, 'pagado', 'cancelacion', left('Cancelación ' || t.code, 120));
    update public.profiles set pending_fee = pending_fee + fee where id = t.passenger_id;
  end if;
  return t;
end $$;

-- ── Weekly pass, paid from the balance ───────────────────────────────────────
create or replace function public.buy_weekly_pass()
returns public.driver_passes
language plpgsql
security definer
set search_path = public
as $$
declare me public.profiles; s public.nuva_settings; p public.driver_passes;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  select * into s from public.nuva_settings where country = coalesce(me.country, 'CO');
  if not coalesce(s.pass_enabled, false) then raise exception 'El pase semanal no está disponible'; end if;
  if exists (select 1 from public.driver_passes where driver_id = auth.uid() and now() between starts_at and ends_at) then
    raise exception 'Ya tienes un pase activo';
  end if;
  if public.driver_balance(auth.uid()) < s.pass_price then raise exception 'Saldo insuficiente para el pase. Recarga tu saldo NÜVA'; end if;
  insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
  values (auth.uid(), -s.pass_price, 'pagado', 'pase', 'Pase semanal');
  insert into public.driver_passes (driver_id, country, price, starts_at, ends_at)
  values (auth.uid(), coalesce(me.country, 'CO'), s.pass_price, now(), now() + interval '7 days')
  returning * into p;
  return p;
end $$;
revoke execute on function public.buy_weekly_pass() from public, anon;
grant execute on function public.buy_weekly_pass() to authenticated;

-- ── Wallet labels for the new movements ──────────────────────────────────────
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
                   'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' when 'promo' then 'promo'
                                       when 'pase' then 'pase' when 'cancelacion' then 'cancelacion' else 'recarga' end,
                   'amount', amount,
                   'status', case when status = 'pendiente' and created_at < now() - interval '1 hour' then 'vencido' else status end,
                   'at', created_at,
                   'note', case when method in ('ajuste', 'promo', 'cancelacion') then payment_ref end) as m
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

-- ── Weekly summary: waiting and cancellation money too ───────────────────────
create or replace function public.driver_summary(p_days integer default 1)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tz as (select case (select country from public.profiles where id = auth.uid()) when 'CW' then 'America/Curacao' else 'America/Bogota' end as z),
       since as (select date_trunc('day', now() at time zone tz.z) at time zone tz.z - make_interval(days => p_days - 1) as t from tz)
  select jsonb_build_object(
    'trips', count(*), 'gross', coalesce(sum(final_fare), 0),
    'commission', coalesce(sum(case when commission_waived then 0 else platform_commission end), 0),
    'tips', coalesce(sum(tip), 0),
    'surcharges', coalesce(sum(coalesce((fare ->> 'nightSurcharge')::integer, 0) + coalesce((fare ->> 'airportSurcharge')::integer, 0)), 0),
    'waits', coalesce(sum(wait_fee), 0),
    'cancelFees', (select coalesce(sum(amount), 0) from public.driver_topups, since
                    where driver_id = auth.uid() and method = 'cancelacion' and created_at > since.t),
    'freeTrips', count(*) filter (where commission_rule in ('free', 'pass')),
    'net', coalesce(sum(final_fare - case when commission_waived then 0 else platform_commission end + tip), 0)
  )
  from public.trips, since
  where driver_id = auth.uid() and status = 'completed' and completed_at > since.t
$$;

-- The weekly pass is a negative movement paid from the balance.
alter table public.driver_topups drop constraint if exists driver_topups_amount_check;
alter table public.driver_topups add constraint driver_topups_amount_check
  check (amount <> 0 and (amount > 0 or method in ('ajuste', 'pase')));
