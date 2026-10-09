-- Commission only on the fare (surcharges are 100 % the driver's) and request_ride
-- serialized per passenger and per promo campaign (2026-10-08).

create or replace function public.calculate_fare(
  p_distance_km numeric, p_duration_min numeric, p_category text default 'go', p_version integer default null,
  p_country text default 'CO', p_pickup jsonb default null, p_destination jsonb default null, p_at timestamptz default now())
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  cfg public.pricing_versions; cat jsonb; mult numeric; s jsonb;
  dch integer; tch integer; raw integer; minf integer; base_fin integer; fin integer; pct numeric; com integer;
  night integer := 0; air integer := 0; lt time; wf time; wt time; alat numeric; alng numeric; rad numeric;
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
  base_fin := greatest(minf, raw);

  -- Surcharges only for a real trip (with its points), never for generic estimates.
  s := coalesce(cfg.surcharges, '{}'::jsonb);
  if p_pickup is not null or p_destination is not null then
    if coalesce((s -> 'night' ->> 'enabled')::boolean, false) then
      lt := (coalesce(p_at, now()) at time zone case cfg.country when 'CW' then 'America/Curacao' else 'America/Bogota' end)::time;
      wf := coalesce(s -> 'night' ->> 'from', '19:00')::time;
      wt := coalesce(s -> 'night' ->> 'to', '05:00')::time;
      if (wf <= wt and lt >= wf and lt < wt) or (wf > wt and (lt >= wf or lt < wt)) then
        night := round(coalesce((s -> 'night' ->> 'amount')::numeric, 0));
      end if;
    end if;
    if coalesce((s -> 'airport' ->> 'enabled')::boolean, false) then
      alat := (s -> 'airport' ->> 'lat')::numeric;
      alng := (s -> 'airport' ->> 'lng')::numeric;
      rad  := coalesce((s -> 'airport' ->> 'radiusM')::numeric, 1000);
      if p_pickup is not null and sqrt(power(((p_pickup ->> 'lat')::numeric - alat) * 110574, 2)
           + power(((p_pickup ->> 'lng')::numeric - alng) * 111320 * cos(radians((p_pickup ->> 'lat')::numeric)), 2)) <= rad then
        air := air + round(coalesce((s -> 'airport' ->> 'pickup')::numeric, 0));
      end if;
      if p_destination is not null and sqrt(power(((p_destination ->> 'lat')::numeric - alat) * 110574, 2)
           + power(((p_destination ->> 'lng')::numeric - alng) * 111320 * cos(radians((p_destination ->> 'lat')::numeric)), 2)) <= rad then
        air := air + round(coalesce((s -> 'airport' ->> 'dropoff')::numeric, 0));
      end if;
    end if;
  end if;

  fin  := base_fin + night + air;
  pct  := least(greatest(coalesce(nullif(cat ->> 'commissionPct', '')::numeric, cfg.commission_pct), 0), 100);
  -- Surcharges are 100 % the driver's: commission only on the fare (or the minimum).
  com  := round(base_fin * pct / 100);
  return jsonb_build_object(
    'version', cfg.version, 'category', p_category, 'country', cfg.country, 'currency', public.country_currency(cfg.country),
    'distanceKm', p_distance_km, 'durationMin', p_duration_min,
    'baseFare', cfg.base_fare, 'distanceCharge', dch, 'timeCharge', tch,
    'rawFare', raw, 'minimumAdjustment', base_fin - raw, 'minimumApplied', base_fin > raw,
    'nightSurcharge', night, 'airportSurcharge', air,
    'finalFare', fin, 'commissionPct', pct, 'platformCommission', com, 'driverEarnings', fin - com
  );
end $$;

create or replace function public.request_ride(p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash',
  p_distance_km numeric default null, p_duration_min integer default null, p_promo_code text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text; z text; promo jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  -- One request at a time per passenger (no double trips, no double use of a promo).
  perform 1 from public.profiles where id = auth.uid() for update;
  update public.trips set status = 'cancelled', cancelled_at = now()
   where passenger_id = auth.uid() and status = 'requested' and requested_at < now() - interval '15 minutes';
  if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje en curso';
  end if;
  select coalesce(country, 'CO') into c from public.profiles where id = auth.uid();
  z := public.zone_check(p_pickup, c);
  if z = 'paused' then raise exception 'El servicio está pausado temporalmente en esa zona'; end if;
  if z = 'outside' then raise exception 'Aún no operamos en ese punto de recogida'; end if;
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 2.0 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2.5 then p_duration_min else est.duration_min end;
  f    := public.calculate_fare(km, mins, p_category, null, c, p_pickup, p_destination, now());
  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
    -- Serialize uses of the same campaign so its budget can't be overspent.
    perform 1 from public.promos where code = upper(btrim(p_promo_code)) for update;
    promo := public.check_promo(p_promo_code, (f ->> 'finalFare')::integer);
    if not (promo ->> 'ok')::boolean then raise exception '%', promo ->> 'error'; end if;
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
