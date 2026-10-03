-- ════════════════════════════════════════════════════════════════════════════
-- Phase 1 · real passengers & drivers, live matching
-- ════════════════════════════════════════════════════════════════════════════

-- Drivers sign up as 'pendiente' and only receive trips once an admin approves them.
alter table public.profiles
  add column driver_status text check (driver_status in ('pendiente', 'aprobado', 'suspendido')),
  add column vehicle jsonb,
  add column rating numeric(3, 2) not null default 5.00;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.user_role;
begin
  r := case
    when exists (select 1 from public.bootstrap_admins b where lower(b.email) = lower(new.email)) then 'admin'::public.user_role
    when new.raw_user_meta_data ->> 'role' = 'driver' then 'driver'::public.user_role
    else 'passenger'::public.user_role
  end;
  insert into public.profiles (id, email, full_name, phone, role, driver_status, vehicle)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    r,
    case when r = 'driver' then 'pendiente' end,
    case when r = 'driver' then new.raw_user_meta_data -> 'vehicle' end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A driver can work only when approved (admins always can, for testing).
create or replace function public.is_driver()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin' or (role = 'driver' and driver_status = 'aprobado')
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.set_driver_status(p_driver uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set driver_status = p_status where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
end $$;

-- Drivers edit their own vehicle; role/status stay protected by the trigger + RPCs.
create or replace function public.guard_role_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and (new.role is distinct from old.role or new.driver_status is distinct from old.driver_status) then
    raise exception 'Solo un administrador puede cambiar roles o aprobar conductores';
  end if;
  return new;
end $$;

-- ─── Driver presence (online + live location) ──────────────────────────────

create table public.driver_presence (
  driver_id   uuid primary key references auth.users (id) on delete cascade,
  online      boolean not null default false,
  lat         double precision,
  lng         double precision,
  heading     real,
  updated_at  timestamptz not null default now()
);
alter table public.driver_presence enable row level security;

create policy "driver writes own presence" on public.driver_presence for insert
  with check (driver_id = (select auth.uid()) and public.is_driver());
create policy "driver updates own presence" on public.driver_presence for update
  using (driver_id = (select auth.uid()));
create policy "presence visible to self, admins and the passenger of an active trip" on public.driver_presence for select
  using (
    driver_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.trips t
      where t.driver_id = driver_presence.driver_id
        and t.passenger_id = (select auth.uid())
        and t.status in ('accepted', 'arriving', 'in_progress')
    )
  );

-- Anonymous positions of nearby online drivers for the passenger map.
create or replace function public.nearby_drivers(p_lat double precision, p_lng double precision, p_radius_km double precision default 4)
returns table (lat double precision, lng double precision, heading real)
language sql stable security definer set search_path = public as $$
  select p.lat, p.lng, p.heading
  from public.driver_presence p
  where p.online
    and p.updated_at > now() - interval '3 minutes'
    and abs(p.lat - p_lat) * 111 < p_radius_km
    and abs(p.lng - p_lng) * 111 < p_radius_km
  limit 30
$$;

-- ─── Payments: mixed model ─────────────────────────────────────────────────
-- direct   (cash, nequi): passenger pays the driver; driver owes NÜVA the commission.
-- platform (card, pse, nequi_app): passenger pays NÜVA via Wompi; NÜVA owes the driver.

alter table public.trips
  add column payment_channel text generated always as (case when payment in ('cash', 'nequi', 'daviplata') then 'direct' else 'platform' end) stored,
  add column payment_status text not null default 'pendiente' check (payment_status in ('pendiente', 'pagado', 'fallido')),
  add column payment_ref text;

-- Driver payout details (Nequi number shown to passengers who pay direct).
alter table public.profiles add column payout jsonb;

create table public.driver_topups (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references auth.users (id),
  amount      integer not null check (amount > 0),
  status      text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'fallido')),
  payment_ref text,
  created_at  timestamptz not null default now()
);
create index driver_topups_driver_idx on public.driver_topups (driver_id);
alter table public.driver_topups enable row level security;
create policy "own topups or admin" on public.driver_topups for select using (driver_id = (select auth.uid()) or public.is_admin());

-- Balance = what NÜVA owes the driver (platform trips) − commissions owed on
-- direct trips − payouts + top-ups. Negative means the driver owes NÜVA.
create or replace function public.driver_balance(p_driver uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select (
      coalesce((select sum(driver_earnings + tip) from public.trips, me
                 where driver_id = me.id and status = 'completed' and payment_channel = 'platform' and payment_status = 'pagado'), 0)
    - coalesce((select sum(platform_commission) from public.trips, me
                 where driver_id = me.id and status = 'completed' and payment_channel = 'direct'), 0)
    - coalesce((select sum(amount) from public.withdrawals, me where driver_id = me.id and status <> 'rechazado'), 0)
    + coalesce((select sum(amount) from public.driver_topups, me where driver_id = me.id and status = 'pagado'), 0)
  )::integer
$$;

-- Drivers can keep working while they owe at most this much in commissions.
create or replace function public.debt_limit() returns integer language sql immutable set search_path = public as $$ select -50000 $$;

-- Driver confirms a direct payment (cash / Nequi) was received.
create or replace function public.confirm_direct_payment(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trips set payment_status = 'pagado'
   where id = p_trip and driver_id = auth.uid() and payment_channel = 'direct' and status = 'completed';
  if not found then raise exception 'No se pudo confirmar el pago'; end if;
end $$;

-- ─── Trips: one active ride at a time, counterpart info ────────────────────

create or replace function public.request_ride(
  p_pickup jsonb,
  p_destination jsonb,
  p_category text default 'go',
  p_payment text default 'nequi',
  p_distance_km numeric default null,
  p_duration_min integer default null
) returns public.trips language plpgsql security definer set search_path = public as $$
declare
  est   record;
  km    numeric;
  mins  integer;
  f     jsonb;
  t     public.trips;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje en curso';
  end if;
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 1.35 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2 then p_duration_min else est.duration_min end;
  f    := public.calculate_fare(km, mins, p_category);

  insert into public.trips (passenger_id, category, payment, pickup, destination, distance_km, duration_min,
                            pricing_version, fare, final_fare, platform_commission, driver_earnings)
  values (auth.uid(), p_category, p_payment, p_pickup, p_destination, km, mins,
          (f ->> 'version')::integer, f, (f ->> 'finalFare')::integer,
          (f ->> 'platformCommission')::integer, (f ->> 'driverEarnings')::integer)
  returning * into t;
  return t;
end $$;

create or replace function public.accept_ride(p_trip uuid)
returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  if public.driver_balance(auth.uid()) < public.debt_limit() then
    raise exception 'Debes comisiones en efectivo/Nequi. Recarga tu saldo para seguir recibiendo viajes';
  end if;
  if exists (select 1 from public.trips where driver_id = auth.uid() and status in ('accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje activo';
  end if;
  update public.trips
     set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested' and passenger_id <> auth.uid()
  returning * into t;
  if not found then raise exception 'Este viaje ya fue tomado o cancelado'; end if;
  return t;
end $$;

-- Public card of the other person in a trip (never email/phone).
create or replace function public.trip_counterpart(p_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.trips; other uuid; p public.profiles;
begin
  select * into t from public.trips where id = p_trip;
  if not found or auth.uid() not in (t.passenger_id, coalesce(t.driver_id, '00000000-0000-0000-0000-000000000000')) then
    raise exception 'No autorizado';
  end if;
  other := case when auth.uid() = t.passenger_id then t.driver_id else t.passenger_id end;
  if other is null then return null; end if;
  select * into p from public.profiles where id = other;
  return jsonb_build_object(
    'name', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
    'rating', p.rating,
    'vehicle', p.vehicle,
    'role', p.role,
    -- The driver's Nequi is shared only with the passenger paying by Nequi, once the ride is underway.
    'nequi', case when auth.uid() = t.passenger_id and t.payment = 'nequi' and t.status in ('in_progress', 'completed')
                  then p.payout ->> 'nequi' end
  );
end $$;

-- Driver's own earnings summary straight from completed trips.
create or replace function public.driver_summary(p_days integer default 1)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trips', count(*),
    'gross', coalesce(sum(final_fare), 0),
    'commission', coalesce(sum(platform_commission), 0),
    'net', coalesce(sum(driver_earnings + tip), 0)
  )
  from public.trips
  where driver_id = auth.uid() and status = 'completed'
    and completed_at > date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota' - make_interval(days => p_days - 1)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_driver_status(uuid, text)',
    'public.nearby_drivers(double precision, double precision, double precision)',
    'public.request_ride(jsonb, jsonb, text, text, numeric, integer)',
    'public.accept_ride(uuid)',
    'public.trip_counterpart(uuid)',
    'public.driver_summary(integer)',
    'public.driver_balance(uuid)',
    'public.confirm_direct_payment(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.driver_presence;
