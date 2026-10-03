-- Promotions and service zones applied to real trips.
--
-- ZONES (per country): when a country has active zones ('activa' or 'piloto'), a pickup
-- must fall inside one of them. A paused zone blocks pickups inside it. A country with
-- no zones keeps working everywhere (nothing changes until the admin creates zones).
--
-- PROMOS: the passenger enters a code before requesting. The server checks it (active,
-- same country, not expired, budget left, one use per passenger) and stores the
-- discount on the trip. The passenger pays the driver (final_fare − discount); when the
-- trip completes, NÜVA credits the discount to the driver's wallet, so the driver still
-- earns on the full fare and the commission stays on the full fare.

alter table public.trips add column if not exists promo_id uuid references public.promos (id) on delete set null;
alter table public.trips add column if not exists discount integer not null default 0 check (discount >= 0);
create index if not exists trips_promo_idx on public.trips (promo_id);

-- Distance in metres between a jsonb {lat,lng} and a point (local planar approximation).
create or replace function public.meters_between(a jsonb, lat double precision, lng double precision) returns double precision
language sql immutable set search_path = public as $$
  select sqrt(
    power(((a ->> 'lat')::double precision - lat) * 110574, 2) +
    power(((a ->> 'lng')::double precision - lng) * 111320 * cos(radians(lat)), 2)
  )
$$;

/** 'ok' | 'paused' | 'outside' for a pickup in a country. */
create or replace function public.zone_check(p_point jsonb, p_country text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.zones z
     where z.country = p_country and z.status = 'pausada'
       and public.meters_between(p_point, (z.center ->> 'lat')::double precision, (z.center ->> 'lng')::double precision) <= z.radius_m
  ) then return 'paused'; end if;
  if not exists (select 1 from public.zones z where z.country = p_country and z.status in ('activa', 'piloto')) then return 'ok'; end if;
  if exists (
    select 1 from public.zones z
     where z.country = p_country and z.status in ('activa', 'piloto')
       and public.meters_between(p_point, (z.center ->> 'lat')::double precision, (z.center ->> 'lng')::double precision) <= z.radius_m
  ) then return 'ok'; end if;
  return 'outside';
end $$;

/**
 * Checks a promo code for the signed-in passenger and a fare (minor units).
 * Returns {ok, promoId, code, title, discount, error}. Used for the quote preview and
 * again inside request_ride (the server never trusts the client's discount).
 */
create or replace function public.check_promo(p_code text, p_fare integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c text; p public.promos; spent integer; d integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Inicia sesión para usar un código'); end if;
  select coalesce(country, 'CO') into c from public.profiles where id = auth.uid();
  select * into p from public.promos where code = upper(btrim(p_code)) and country = c;
  if not found then return jsonb_build_object('ok', false, 'error', 'Código no válido'); end if;
  if p.status <> 'activa' then return jsonb_build_object('ok', false, 'error', 'Este código no está activo'); end if;
  if p.ends_at is not null and p.ends_at < current_date then return jsonb_build_object('ok', false, 'error', 'Este código ya venció'); end if;
  if exists (select 1 from public.trips where passenger_id = auth.uid() and promo_id = p.id and status <> 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'Ya usaste este código');
  end if;
  d := least(p.cap, round(greatest(p_fare, 0) * p.discount_pct / 100.0)::integer);
  select coalesce(sum(discount), 0) into spent from public.trips where promo_id = p.id and status <> 'cancelled';
  if spent + d > p.budget then return jsonb_build_object('ok', false, 'error', 'Esta promoción ya agotó su presupuesto'); end if;
  return jsonb_build_object('ok', true, 'promoId', p.id, 'code', p.code, 'title', p.title, 'discount', d);
end $$;
revoke execute on function public.check_promo(text, integer) from public, anon;
grant execute on function public.check_promo(text, integer) to authenticated;

drop function if exists public.request_ride(jsonb, jsonb, text, text, numeric, integer);
create or replace function public.request_ride(
  p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash',
  p_distance_km numeric default null, p_duration_min integer default null, p_promo_code text default null
) returns public.trips
language plpgsql security definer set search_path = public as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text; z text; promo jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
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
  f    := public.calculate_fare(km, mins, p_category, null, c);
  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
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
revoke execute on function public.request_ride(jsonb, jsonb, text, text, numeric, integer, text) from public, anon;
grant execute on function public.request_ride(jsonb, jsonb, text, text, numeric, integer, text) to authenticated;

-- When a discounted trip completes, NÜVA pays the discount into the driver's wallet.
create or replace function public.credit_promo_on_complete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.discount > 0 and new.driver_id is not null then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
    values (new.driver_id, new.discount, 'pagado', 'promo',
            left('Promoción ' || coalesce((select code from public.promos where id = new.promo_id), '') || ' · ' || new.code, 120));
  end if;
  return new;
end $$;
drop trigger if exists trips_credit_promo on public.trips;
create trigger trips_credit_promo after update of status on public.trips
  for each row execute function public.credit_promo_on_complete();

-- Wallet movements: the promo credit shows as an adjustment with its note.
create or replace function public.driver_wallet() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'test', coalesce((select test_wallet from public.profiles where id = auth.uid()), false),
    'movements', coalesce((
      select jsonb_agg(m order by m->>'at' desc) from (
        select jsonb_build_object(
                 'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' when 'promo' then 'ajuste' else 'recarga' end,
                 'amount', amount, 'status', status, 'at', created_at,
                 'note', case when method in ('ajuste', 'promo') then payment_ref end) as m
          from public.driver_topups where driver_id = auth.uid()
        union all
        select jsonb_build_object('kind', 'comision',
                 'amount', case when (select test_wallet from public.profiles where id = auth.uid()) then 0 else -platform_commission end,
                 'status', 'pagado', 'at', completed_at, 'code', code)
          from public.trips where driver_id = auth.uid() and status = 'completed'
        order by 1 desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

-- Internal helpers: only used inside request_ride (SECURITY DEFINER runs them as owner).
revoke execute on function public.zone_check(jsonb, text) from public, anon, authenticated;
revoke execute on function public.meters_between(jsonb, double precision, double precision) from public, anon, authenticated;

-- Finance: promo credits are a cost NÜVA pays into driver wallets (not cash in).
create or replace function public.admin_finance(p_days integer default 30, p_country text default 'CO') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => p_days); low integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select low_balance into low from public.nuva_settings where country = p_country;
  select jsonb_build_object(
    'topups',      coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method in ('wompi', 'manual') and t.status = 'pagado' and t.created_at > since), 0),
    'topupsCount', coalesce((select count(*)     from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method in ('wompi', 'manual') and t.status = 'pagado' and t.created_at > since), 0),
    'bonuses',     coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'bono' and t.status = 'pagado' and t.created_at > since), 0),
    'adjustments', coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'ajuste' and t.created_at > since), 0),
    'promos',      coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'promo' and t.created_at > since), 0),
    'commissions', coalesce((select sum(tr.platform_commission) from public.trips tr join public.profiles p on p.id = tr.driver_id where tr.country = p_country and not p.test_wallet and tr.status = 'completed' and tr.completed_at > since), 0),
    'balances',    coalesce((select sum(public.driver_balance(id)) from public.profiles where role = 'driver' and not test_wallet and country = p_country), 0),
    'lowDrivers',  coalesce((select count(*) from public.profiles where role = 'driver' and not test_wallet and country = p_country and driver_status = 'aprobado' and public.driver_balance(id) < coalesce(low, 0)), 0)
  ) into r;
  return r;
end $$;

-- Admin: how much each campaign has used.
create or replace function public.admin_promo_usage(p_country text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_object_agg(p.id, jsonb_build_object(
      'uses', (select count(*) from public.trips t where t.promo_id = p.id and t.status = 'completed'),
      'spent', (select coalesce(sum(t.discount), 0) from public.trips t where t.promo_id = p.id and t.status <> 'cancelled')))
      from public.promos p where p.country = p_country
  ), '{}'::jsonb);
end $$;
revoke execute on function public.admin_promo_usage(text) from public, anon;
grant execute on function public.admin_promo_usage(text) to authenticated;
