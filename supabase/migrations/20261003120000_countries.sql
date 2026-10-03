-- Multi-country: Colombia (CO, COP) and Curaçao (CW, USD).
-- Money is stored in each currency's minor unit: COP = pesos, USD = cents.

-- ─── Columns ───────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists country text not null default 'CO';
alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check check (country in ('CO', 'CW'));

alter table public.trips add column if not exists country text not null default 'CO';
alter table public.trips add column if not exists currency text not null default 'COP';

alter table public.pricing_versions add column if not exists country text not null default 'CO';
alter table public.zones add column if not exists country text not null default 'CO';

create or replace function public.country_currency(c text) returns text language sql immutable as $$
  select case c when 'CW' then 'USD' else 'COP' end
$$;

-- ─── Signup keeps the chosen country ───────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.user_role; c text;
begin
  r := case
    when exists (select 1 from public.bootstrap_admins b where lower(b.email) = lower(new.email)) then 'admin'::public.user_role
    when new.raw_user_meta_data ->> 'role' = 'driver' then 'driver'::public.user_role
    else 'passenger'::public.user_role
  end;
  c := case when new.raw_user_meta_data ->> 'country' in ('CO', 'CW') then new.raw_user_meta_data ->> 'country' else 'CO' end;
  insert into public.profiles (id, email, full_name, phone, role, driver_status, vehicle, payout, country)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    r,
    case when r = 'driver' then 'pendiente' end,
    case when r = 'driver' then new.raw_user_meta_data -> 'vehicle' end,
    case when r = 'driver' then new.raw_user_meta_data -> 'payout' end,
    c
  );
  return new;
end $$;

-- ─── Pricing per country ───────────────────────────────────────────────────
insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, country)
select coalesce(max(version), 0) + 1, 400, 150, 25, 800, 12,
  '{
    "moto":    {"id":"moto","name":"Moto","tagline":"Rápido y económico","seats":1,"multiplier":0.7,"minimumFare":700,"enabled":false,"etaMinutes":2},
    "go":      {"id":"go","name":"Go","tagline":"El viaje de todos los días","seats":4,"multiplier":1,"minimumFare":800,"enabled":true,"etaMinutes":4},
    "eco":     {"id":"eco","name":"Eléctrico","tagline":"Cero emisiones, mismo precio justo","seats":4,"multiplier":1.05,"minimumFare":900,"enabled":true,"etaMinutes":6},
    "confort": {"id":"confort","name":"Confort","tagline":"Carros nuevos, conductores top","seats":4,"multiplier":1.3,"minimumFare":1100,"enabled":true,"etaMinutes":5},
    "xl":      {"id":"xl","name":"XL","tagline":"Hasta 6 personas y maletas","seats":6,"multiplier":1.6,"minimumFare":1400,"enabled":true,"etaMinutes":8}
  }'::jsonb,
  'Lanzamiento Curazao (USD, valores en centavos)', 'CW'
from public.pricing_versions
where not exists (select 1 from public.pricing_versions where country = 'CW');

drop function if exists public.calculate_fare(numeric, numeric, text, integer);
create or replace function public.calculate_fare(p_distance_km numeric, p_duration_min numeric, p_category text default 'go', p_version integer default null, p_country text default 'CO')
returns jsonb language plpgsql stable set search_path = public as $$
declare
  cfg public.pricing_versions; cat jsonb; mult numeric;
  dch integer; tch integer; raw integer; minf integer; fin integer; pct numeric; com integer;
begin
  select * into cfg from public.pricing_versions
   where (p_version is not null and version = p_version) or (p_version is null and country = p_country)
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
  pct  := least(greatest(coalesce(nullif(cat ->> 'commissionPct', '')::numeric, cfg.commission_pct), 0), 100);
  com  := round(fin * pct / 100);
  return jsonb_build_object(
    'version', cfg.version, 'category', p_category, 'country', cfg.country, 'currency', public.country_currency(cfg.country),
    'distanceKm', p_distance_km, 'durationMin', p_duration_min,
    'baseFare', cfg.base_fare, 'distanceCharge', dch, 'timeCharge', tch,
    'rawFare', raw, 'minimumAdjustment', fin - raw, 'minimumApplied', fin > raw,
    'finalFare', fin, 'commissionPct', pct, 'platformCommission', com, 'driverEarnings', fin - com
  );
end $$;

create or replace function public.publish_pricing(p_config jsonb, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer; c text := coalesce(p_config ->> 'country', 'CO');
begin
  if not public.is_admin() then raise exception 'Solo administradores pueden publicar tarifas'; end if;
  if c not in ('CO', 'CW') then raise exception 'País no válido'; end if;
  select coalesce(max(version), 0) + 1 into v from public.pricing_versions;
  insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, published_by, country)
  values (v, (p_config ->> 'baseFare')::integer, (p_config ->> 'pricePerKm')::integer, (p_config ->> 'pricePerMinute')::integer,
          (p_config ->> 'minimumFare')::integer, (p_config ->> 'commissionPct')::numeric, p_config -> 'categories', p_note, auth.uid(), c);
  return v;
end $$;

-- Distance estimate valid at any latitude (was tuned for Pereira only).
create or replace function public.estimate_route(p_from jsonb, p_to jsonb)
returns table(distance_km numeric, duration_min integer) language sql immutable set search_path = public as $$
  with d as (
    select (abs((p_to ->> 'lat')::numeric - (p_from ->> 'lat')::numeric) * 110574
          + abs((p_to ->> 'lng')::numeric - (p_from ->> 'lng')::numeric) * 111320 * cos(radians((p_from ->> 'lat')::numeric))) * 1.06 / 1000 as km
  )
  select round(greatest(0.4, km)::numeric, 1), greatest(3, round(km / 21 * 60 + 1.5))::integer from d
$$;

-- ─── Trips carry country + currency ────────────────────────────────────────
create or replace function public.request_ride(p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash', p_distance_km numeric default null, p_duration_min integer default null)
returns public.trips language plpgsql security definer set search_path = public as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje en curso';
  end if;
  select coalesce(country, 'CO') into c from public.profiles where id = auth.uid();
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 1.35 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2 then p_duration_min else est.duration_min end;
  f    := public.calculate_fare(km, mins, p_category, null, c);
  insert into public.trips (passenger_id, category, payment, pickup, destination, distance_km, duration_min,
                            pricing_version, fare, final_fare, platform_commission, driver_earnings, country, currency)
  values (auth.uid(), p_category, p_payment, p_pickup, p_destination, km, mins,
          (f ->> 'version')::integer, f, (f ->> 'finalFare')::integer,
          (f ->> 'platformCommission')::integer, (f ->> 'driverEarnings')::integer, c, public.country_currency(c))
  returning * into t;
  return t;
end $$;

-- Drivers only take trips in their own country.
create or replace function public.accept_ride(p_trip uuid)
returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips; need integer; tc text; dc text;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  if exists (select 1 from public.trips where driver_id = auth.uid() and status in ('accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje activo';
  end if;
  select platform_commission, country into need, tc from public.trips where id = p_trip;
  select country into dc from public.profiles where id = auth.uid();
  if tc is distinct from dc and not public.is_admin() then raise exception 'Este viaje es de otro país'; end if;
  if public.driver_balance(auth.uid()) < coalesce(need, 0) then
    raise exception 'Saldo insuficiente para la comisión de este viaje. Recarga tu saldo NÜVA';
  end if;
  update public.trips set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested' and passenger_id <> auth.uid()
  returning * into t;
  if not found then raise exception 'Este viaje ya fue tomado o cancelado'; end if;
  return t;
end $$;

-- Payment account shown to the passenger now also covers bank transfers.
create or replace function public.trip_counterpart(p_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.trips; other uuid; p public.profiles; acct text;
begin
  select * into t from public.trips where id = p_trip;
  if not found or auth.uid() not in (t.passenger_id, coalesce(t.driver_id, '00000000-0000-0000-0000-000000000000')) then
    raise exception 'No autorizado';
  end if;
  other := case when auth.uid() = t.passenger_id then t.driver_id else t.passenger_id end;
  if other is null then return null; end if;
  select * into p from public.profiles where id = other;
  if auth.uid() = t.passenger_id and t.status in ('in_progress', 'completed') then
    acct := case t.payment
      when 'nequi' then p.payout ->> 'nequi'
      when 'daviplata' then coalesce(p.payout ->> 'daviplata', p.payout ->> 'nequi')
      when 'bancolombia' then p.payout ->> 'bancolombia'
      when 'transfer' then p.payout ->> 'bank'
    end;
  end if;
  return jsonb_build_object(
    'name', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
    'rating', p.rating, 'vehicle', p.vehicle, 'role', p.role,
    'payAccount', acct, 'nequi', case when t.payment = 'nequi' then acct end,
    'avatar', p.avatar_url
  );
end $$;

-- "Today" in the driver's own time zone.
create or replace function public.driver_summary(p_days integer default 1)
returns jsonb language sql stable security definer set search_path = public as $$
  with tz as (select case (select country from public.profiles where id = auth.uid()) when 'CW' then 'America/Curacao' else 'America/Bogota' end as z)
  select jsonb_build_object(
    'trips', count(*), 'gross', coalesce(sum(final_fare), 0),
    'commission', coalesce(sum(platform_commission), 0), 'net', coalesce(sum(driver_earnings + tip), 0)
  )
  from public.trips, tz
  where driver_id = auth.uid() and status = 'completed'
    and completed_at > date_trunc('day', now() at time zone tz.z) at time zone tz.z - make_interval(days => p_days - 1)
$$;

-- ─── Wallet rules per country ──────────────────────────────────────────────
alter table public.nuva_settings add column if not exists country text not null default 'CO';
alter table public.nuva_settings drop constraint if exists nuva_settings_pkey;
alter table public.nuva_settings drop column if exists id;
alter table public.nuva_settings add primary key (country);
alter table public.nuva_settings drop constraint if exists nuva_settings_min_topup_check;
alter table public.nuva_settings drop constraint if exists nuva_settings_welcome_bonus_check;
alter table public.nuva_settings drop constraint if exists nuva_settings_low_balance_check;
alter table public.nuva_settings add constraint nuva_settings_values_check
  check (welcome_bonus >= 0 and min_topup >= 100 and low_balance >= 0 and welcome_bonus <= 100000000 and min_topup <= 100000000 and low_balance <= 100000000);
-- Curaçao in USD cents: no bonus, minimum top-up US$10, alert under US$3.
insert into public.nuva_settings (country, welcome_bonus, min_topup, low_balance) values ('CW', 0, 1000, 300) on conflict do nothing;

create or replace function public.update_settings(p jsonb)
returns public.nuva_settings language plpgsql security definer set search_path = public as $$
declare s public.nuva_settings; c text := coalesce(p ->> 'country', 'CO');
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.nuva_settings set
    welcome_bonus = coalesce((p ->> 'welcome_bonus')::integer, welcome_bonus),
    min_topup     = coalesce((p ->> 'min_topup')::integer, min_topup),
    low_balance   = coalesce((p ->> 'low_balance')::integer, low_balance),
    updated_at = now(), updated_by = auth.uid()
  where country = c
  returning * into s;
  if not found then raise exception 'País no válido'; end if;
  return s;
end $$;

create or replace function public.set_driver_status(p_driver uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare bonus integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set driver_status = p_status where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  select s.welcome_bonus into bonus from public.nuva_settings s join public.profiles p on p.country = s.country where p.id = p_driver;
  if p_status = 'aprobado' and coalesce(bonus, 0) > 0
     and not exists (select 1 from public.driver_topups where driver_id = p_driver and method = 'bono') then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref) values (p_driver, bonus, 'pagado', 'bono', 'BIENVENIDA');
  end if;
end $$;

drop function if exists public.admin_finance(integer);
create or replace function public.admin_finance(p_days integer default 30, p_country text default 'CO')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => p_days); low integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select low_balance into low from public.nuva_settings where country = p_country;
  select jsonb_build_object(
    'topups',      coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and t.method = 'wompi' and t.status = 'pagado' and t.created_at > since), 0),
    'topupsCount', coalesce((select count(*)     from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and t.method = 'wompi' and t.status = 'pagado' and t.created_at > since), 0),
    'bonuses',     coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and t.method = 'bono' and t.status = 'pagado' and t.created_at > since), 0),
    'adjustments', coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and t.method = 'ajuste' and t.created_at > since), 0),
    'commissions', coalesce((select sum(platform_commission) from public.trips where country = p_country and status = 'completed' and completed_at > since), 0),
    'balances',    coalesce((select sum(public.driver_balance(id)) from public.profiles where role = 'driver' and country = p_country), 0),
    'lowDrivers',  coalesce((select count(*) from public.profiles where role = 'driver' and country = p_country and driver_status = 'aprobado' and public.driver_balance(id) < coalesce(low, 0)), 0)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_finance(integer, text) from public, anon;
grant execute on function public.admin_finance(integer, text) to authenticated;
