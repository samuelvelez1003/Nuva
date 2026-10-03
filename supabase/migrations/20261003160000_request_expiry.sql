-- Passenger fixes:
--  * a request nobody accepted in 15 minutes (drivers only see the last 15) is closed
--    automatically, so it never blocks the passenger with "Ya tienes un viaje en curso";
--  * the street route (OSRM) may legitimately be up to 2× the straight-line estimate
--    (e.g. around the bay in Willemstad): accept it, so the quoted price is the one charged.
--    The lower bound stays, so a client can't under-report the distance to pay less.
create or replace function public.request_ride(
  p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash',
  p_distance_km numeric default null, p_duration_min integer default null
) returns public.trips
language plpgsql security definer set search_path = public as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  update public.trips set status = 'cancelled', cancelled_at = now()
   where passenger_id = auth.uid() and status = 'requested' and requested_at < now() - interval '15 minutes';
  if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje en curso';
  end if;
  select coalesce(country, 'CO') into c from public.profiles where id = auth.uid();
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 2.0 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2.5 then p_duration_min else est.duration_min end;
  f    := public.calculate_fare(km, mins, p_category, null, c);
  insert into public.trips (passenger_id, category, payment, pickup, destination, distance_km, duration_min,
                            pricing_version, fare, final_fare, platform_commission, driver_earnings, country, currency)
  values (auth.uid(), p_category, p_payment, p_pickup, p_destination, km, mins,
          (f ->> 'version')::integer, f, (f ->> 'finalFare')::integer,
          (f ->> 'platformCommission')::integer, (f ->> 'driverEarnings')::integer, c, public.country_currency(c))
  returning * into t;
  return t;
end $$;
