-- Commission & wallet controls for the admin.
--  1. nuva_settings: welcome bonus, minimum top-up and low-balance alert (no more hard-coded values).
--  2. Optional commission per category (categories.<id>.commissionPct); falls back to the global one.
--  3. Manual wallet adjustments (credit/debit with a reason) by admins.
--  4. admin_finance(): the real money — top-ups received, bonuses, commissions, balances held.

-- ─── 1. Settings ───────────────────────────────────────────────────────────
create table if not exists public.nuva_settings (
  id             boolean primary key default true check (id),
  welcome_bonus  integer not null default 20000 check (welcome_bonus between 0 and 200000),
  min_topup      integer not null default 20000 check (min_topup between 5000 and 1000000),
  low_balance    integer not null default 5000  check (low_balance between 0 and 200000),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id)
);
insert into public.nuva_settings (id) values (true) on conflict do nothing;
alter table public.nuva_settings enable row level security;
drop policy if exists "settings readable" on public.nuva_settings;
create policy "settings readable" on public.nuva_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.nuva_settings from anon, authenticated;

create or replace function public.update_settings(p jsonb)
returns public.nuva_settings language plpgsql security definer set search_path = public as $$
declare s public.nuva_settings;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.nuva_settings set
    welcome_bonus = coalesce((p ->> 'welcome_bonus')::integer, welcome_bonus),
    min_topup     = coalesce((p ->> 'min_topup')::integer, min_topup),
    low_balance   = coalesce((p ->> 'low_balance')::integer, low_balance),
    updated_at    = now(),
    updated_by    = auth.uid()
  where id
  returning * into s;
  return s;
end $$;
revoke execute on function public.update_settings(jsonb) from public, anon;
grant execute on function public.update_settings(jsonb) to authenticated;

-- Welcome bonus now comes from the settings (0 = no bonus).
create or replace function public.set_driver_status(p_driver uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare bonus integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set driver_status = p_status where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  select welcome_bonus into bonus from public.nuva_settings where id;
  if p_status = 'aprobado' and coalesce(bonus, 0) > 0
     and not exists (select 1 from public.driver_topups where driver_id = p_driver and method = 'bono') then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
    values (p_driver, bonus, 'pagado', 'bono', 'BIENVENIDA');
  end if;
end $$;

-- ─── 2. Commission per category ────────────────────────────────────────────
create or replace function public.calculate_fare(p_distance_km numeric, p_duration_min numeric, p_category text default 'go', p_version integer default null)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  cfg public.pricing_versions; cat jsonb; mult numeric;
  dch integer; tch integer; raw integer; minf integer; fin integer; pct numeric; com integer;
begin
  select * into cfg from public.pricing_versions
   where p_version is null or version = p_version
   order by version desc limit 1;
  if not found then raise exception 'No hay tarifas configuradas'; end if;

  cat := cfg.categories -> p_category;
  if cat is null or not coalesce((cat ->> 'enabled')::boolean, true) then
    raise exception 'Categoría no disponible: %', p_category;
  end if;

  mult := coalesce((cat ->> 'multiplier')::numeric, 1);
  dch  := round(greatest(p_distance_km, 0) * cfg.price_per_km * mult);
  tch  := round(greatest(p_duration_min, 0) * cfg.price_per_minute * mult);
  raw  := cfg.base_fare + dch + tch;
  minf := round(greatest(cfg.minimum_fare, coalesce((cat ->> 'minimumFare')::integer, 0)));
  fin  := greatest(minf, raw);
  -- Category commission when set, otherwise the global one.
  pct  := least(greatest(coalesce(nullif(cat ->> 'commissionPct', '')::numeric, cfg.commission_pct), 0), 100);
  com  := round(fin * pct / 100);

  return jsonb_build_object(
    'version', cfg.version, 'category', p_category,
    'distanceKm', p_distance_km, 'durationMin', p_duration_min,
    'baseFare', cfg.base_fare, 'distanceCharge', dch, 'timeCharge', tch,
    'rawFare', raw, 'minimumAdjustment', fin - raw, 'minimumApplied', fin > raw,
    'finalFare', fin, 'commissionPct', pct, 'platformCommission', com, 'driverEarnings', fin - com
  );
end $$;

-- ─── 3. Manual adjustments ─────────────────────────────────────────────────
alter table public.driver_topups drop constraint if exists driver_topups_amount_check;
alter table public.driver_topups add constraint driver_topups_amount_check
  check (amount <> 0 and (amount > 0 or method = 'ajuste'));

create or replace function public.admin_adjust_wallet(p_driver uuid, p_amount integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'Monto inválido'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Escribe el motivo del ajuste'; end if;
  if not exists (select 1 from public.profiles where id = p_driver and role = 'driver') then raise exception 'Conductor no encontrado'; end if;
  insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
  values (p_driver, p_amount, 'pagado', 'ajuste', left(trim(p_reason), 120));
  return public.driver_balance(p_driver);
end $$;
revoke execute on function public.admin_adjust_wallet(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_wallet(uuid, integer, text) to authenticated;

-- Wallet movements: adjustments carry their reason.
create or replace function public.driver_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'movements', coalesce((
      select jsonb_agg(m order by m->>'at' desc) from (
        select jsonb_build_object(
                 'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' else 'recarga' end,
                 'amount', amount, 'status', status, 'at', created_at,
                 'note', case when method = 'ajuste' then payment_ref end) as m
          from public.driver_topups where driver_id = auth.uid()
        union all
        select jsonb_build_object('kind', 'comision', 'amount', -platform_commission, 'status', 'pagado', 'at', completed_at, 'code', code)
          from public.trips where driver_id = auth.uid() and status = 'completed'
        order by 1 desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

-- ─── 4. Real money for the admin ───────────────────────────────────────────
create or replace function public.admin_finance(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => p_days); low integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select low_balance into low from public.nuva_settings where id;
  select jsonb_build_object(
    'topups',       coalesce((select sum(amount) from public.driver_topups where method = 'wompi' and status = 'pagado' and created_at > since), 0),
    'topupsCount',  coalesce((select count(*)    from public.driver_topups where method = 'wompi' and status = 'pagado' and created_at > since), 0),
    'bonuses',      coalesce((select sum(amount) from public.driver_topups where method = 'bono' and status = 'pagado' and created_at > since), 0),
    'adjustments',  coalesce((select sum(amount) from public.driver_topups where method = 'ajuste' and created_at > since), 0),
    'commissions',  coalesce((select sum(platform_commission) from public.trips where status = 'completed' and completed_at > since), 0),
    -- What drivers hold right now (prepaid money NÜVA owes as future commissions).
    'balances',     coalesce((select sum(public.driver_balance(id)) from public.profiles where role = 'driver'), 0),
    'lowDrivers',   coalesce((select count(*) from public.profiles where role = 'driver' and driver_status = 'aprobado' and public.driver_balance(id) < coalesce(low, 0)), 0)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_finance(integer) from public, anon;
grant execute on function public.admin_finance(integer) to authenticated;
