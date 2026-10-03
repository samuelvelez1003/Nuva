-- ════════════════════════════════════════════════════════════════════════════
-- NÜVA backend · initial schema
-- Roles, versioned pricing, server-side fare engine, trips, payouts, ops data.
-- Every write that touches money goes through a SECURITY DEFINER function so
-- the client can never set a fare, a commission or someone else's role.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Roles & profiles ───────────────────────────────────────────────────────

create type public.user_role as enum ('passenger', 'driver', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        public.user_role not null default 'passenger',
  created_at  timestamptz not null default now()
);

-- Founding administrator. Anyone else becomes admin only via promote_user().
create table public.bootstrap_admins (email text primary key);
insert into public.bootstrap_admins (email) values ('bs.velez10@gmail.com');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone,
    case
      when exists (select 1 from public.bootstrap_admins b where lower(b.email) = lower(new.email)) then 'admin'::public.user_role
      when new.raw_user_meta_data ->> 'role' = 'driver' then 'driver'::public.user_role
      else 'passenger'::public.user_role
    end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- If the admin account already existed before this migration, promote it now.
insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'
from auth.users u
join public.bootstrap_admins b on lower(b.email) = lower(u.email)
on conflict (id) do update set role = 'admin';

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_driver()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('driver', 'admin') from public.profiles where id = auth.uid()), false)
$$;

-- Users may edit their own name/phone, never their role.
create or replace function public.guard_role_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end $$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

create or replace function public.promote_user(p_email text, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set role = p_role where lower(email) = lower(p_email);
  if not found then raise exception 'No existe un usuario con ese correo'; end if;
end $$;

-- ─── Versioned pricing ──────────────────────────────────────────────────────

create table public.pricing_versions (
  version           integer primary key,
  base_fare         integer not null check (base_fare >= 0),
  price_per_km      integer not null check (price_per_km > 0),
  price_per_minute  integer not null check (price_per_minute >= 0),
  minimum_fare      integer not null check (minimum_fare >= 0),
  commission_pct    numeric(5, 2) not null check (commission_pct between 0 and 40),
  -- { "go": { "name": "Go", "multiplier": 1, "minimumFare": 6000, "enabled": true, ... }, ... }
  categories        jsonb not null,
  note              text,
  published_by      uuid references auth.users (id),
  published_at      timestamptz not null default now()
);

create view public.current_pricing with (security_invoker = true) as
  select * from public.pricing_versions order by version desc limit 1;

insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note)
values (1, 2000, 1000, 100, 6000, 12, '{
  "moto":    {"id":"moto","name":"Moto","tagline":"Rápido entre el trancón","seats":1,"multiplier":0.7,"minimumFare":6000,"enabled":true,"etaMinutes":2},
  "go":      {"id":"go","name":"Go","tagline":"El viaje de todos los días","seats":4,"multiplier":1,"minimumFare":6000,"enabled":true,"etaMinutes":3},
  "eco":     {"id":"eco","name":"Eléctrico","tagline":"Cero emisiones, mismo precio justo","seats":4,"multiplier":1.05,"minimumFare":6500,"enabled":true,"etaMinutes":5},
  "confort": {"id":"confort","name":"Confort","tagline":"Carros nuevos, conductores top","seats":4,"multiplier":1.3,"minimumFare":8000,"enabled":true,"etaMinutes":4},
  "xl":      {"id":"xl","name":"XL","tagline":"Hasta 6 personas y maletas","seats":6,"multiplier":1.6,"minimumFare":10000,"enabled":true,"etaMinutes":7}
}', 'Tarifas de lanzamiento');

-- ─── Fare engine (authoritative copy of src/lib/fare.ts) ────────────────────
--   rawFare = base + km × pricePerKm × mult + min × pricePerMinute × mult
--   final   = max(minimumFare, rawFare) · commission = final × pct · driver = final − commission
-- All money is integer COP, each component rounded once.

create or replace function public.calculate_fare(
  p_distance_km numeric,
  p_duration_min numeric,
  p_category text default 'go',
  p_version integer default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  cfg   public.pricing_versions;
  cat   jsonb;
  mult  numeric;
  dch   integer;
  tch   integer;
  raw   integer;
  minf  integer;
  fin   integer;
  pct   numeric;
  com   integer;
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
  pct  := least(greatest(cfg.commission_pct, 0), 100);
  com  := round(fin * pct / 100);

  return jsonb_build_object(
    'version', cfg.version,
    'category', p_category,
    'distanceKm', p_distance_km,
    'durationMin', p_duration_min,
    'baseFare', cfg.base_fare,
    'distanceCharge', dch,
    'timeCharge', tch,
    'rawFare', raw,
    'minimumAdjustment', fin - raw,
    'minimumApplied', fin > raw,
    'finalFare', fin,
    'commissionPct', pct,
    'platformCommission', com,
    'driverEarnings', fin - com
  );
end $$;

-- Server-side route estimate (Manhattan distance on Bogotá's grid, same model
-- as the app). Replace with a routing API (OSRM/Google) for production.
create or replace function public.estimate_route(p_from jsonb, p_to jsonb)
returns table (distance_km numeric, duration_min integer) language sql immutable set search_path = public as $$
  with d as (
    select (abs((p_to ->> 'lat')::numeric - (p_from ->> 'lat')::numeric) * 110574
          + abs((p_to ->> 'lng')::numeric - (p_from ->> 'lng')::numeric) * 110954) * 1.06 / 1000 as km
  )
  select round(greatest(0.4, km), 1), greatest(3, round(km / 21 * 60 + 1.5))::integer from d
$$;

create or replace function public.publish_pricing(p_config jsonb, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not public.is_admin() then raise exception 'Solo administradores pueden publicar tarifas'; end if;
  select coalesce(max(version), 0) + 1 into v from public.pricing_versions;
  insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, published_by)
  values (
    v,
    (p_config ->> 'baseFare')::integer,
    (p_config ->> 'pricePerKm')::integer,
    (p_config ->> 'pricePerMinute')::integer,
    (p_config ->> 'minimumFare')::integer,
    (p_config ->> 'commissionPct')::numeric,
    p_config -> 'categories',
    p_note,
    auth.uid()
  );
  return v;
end $$;

-- ─── Trips ──────────────────────────────────────────────────────────────────

create type public.trip_status as enum ('requested', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled');

create table public.trips (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default ('NV-' || upper(substr(md5(random()::text), 1, 6))),
  passenger_id        uuid not null references auth.users (id),
  driver_id           uuid references auth.users (id),
  status              public.trip_status not null default 'requested',
  category            text not null,
  payment             text not null default 'nequi',
  pickup              jsonb not null,
  destination         jsonb not null,
  distance_km         numeric(6, 1) not null,
  duration_min        integer not null,
  pricing_version     integer not null references public.pricing_versions (version),
  fare                jsonb not null,
  final_fare          integer not null,
  platform_commission integer not null,
  driver_earnings     integer not null,
  rating              smallint check (rating between 1 and 5),
  tip                 integer not null default 0 check (tip >= 0),
  requested_at        timestamptz not null default now(),
  accepted_at         timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz
);
create index trips_status_idx on public.trips (status, requested_at desc);
create index trips_driver_idx on public.trips (driver_id, completed_at desc);
create index trips_passenger_idx on public.trips (passenger_id, requested_at desc);
create index trips_pricing_idx on public.trips (pricing_version);

-- The fare is computed here, with the live pricing version. The client's
-- distance/duration is accepted only if it's within ±35 % of our estimate.
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
  if not public.is_driver() then raise exception 'Solo conductores pueden aceptar viajes'; end if;
  update public.trips
     set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested'
  returning * into t;
  if not found then raise exception 'Este viaje ya fue tomado o cancelado'; end if;
  return t;
end $$;

create or replace function public.advance_ride(p_trip uuid, p_status public.trip_status)
returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips
     set status = p_status,
         started_at   = case when p_status = 'in_progress' then now() else started_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = p_trip
     and driver_id = auth.uid()
     and (
       (status = 'accepted'    and p_status = 'arriving') or
       (status in ('accepted', 'arriving') and p_status = 'in_progress') or
       (status = 'in_progress' and p_status = 'completed')
     )
  returning * into t;
  if not found then raise exception 'Cambio de estado no permitido'; end if;
  return t;
end $$;

create or replace function public.cancel_ride(p_trip uuid)
returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips set status = 'cancelled', cancelled_at = now()
   where id = p_trip
     and status in ('requested', 'accepted', 'arriving')
     and (passenger_id = auth.uid() or driver_id = auth.uid() or public.is_admin())
  returning * into t;
  if not found then raise exception 'Este viaje ya no se puede cancelar'; end if;
  return t;
end $$;

create or replace function public.rate_trip(p_trip uuid, p_rating smallint, p_tip integer default 0)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trips set rating = p_rating, tip = greatest(p_tip, 0)
   where id = p_trip and passenger_id = auth.uid() and status = 'completed';
  if not found then raise exception 'Solo puedes calificar tus viajes completados'; end if;
end $$;

-- ─── Driver payouts ─────────────────────────────────────────────────────────

create table public.withdrawals (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references auth.users (id),
  amount       integer not null check (amount >= 20000),
  destination  text not null,
  status       text not null default 'procesando' check (status in ('procesando', 'completado', 'rechazado')),
  created_at   timestamptz not null default now()
);
create index withdrawals_driver_idx on public.withdrawals (driver_id);

-- Non-admins can only ever see their own balance.
create or replace function public.driver_balance(p_driver uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select (coalesce((select sum(driver_earnings + tip) from public.trips, me where driver_id = me.id and status = 'completed'), 0)
       - coalesce((select sum(amount) from public.withdrawals, me where driver_id = me.id and status <> 'rechazado'), 0))::integer
$$;

create or replace function public.request_withdrawal(p_amount integer, p_destination text)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
declare w public.withdrawals;
begin
  if not public.is_driver() then raise exception 'Solo conductores'; end if;
  if p_amount > public.driver_balance(auth.uid()) then raise exception 'Saldo insuficiente'; end if;
  insert into public.withdrawals (driver_id, amount, destination) values (auth.uid(), p_amount, p_destination)
  returning * into w;
  return w;
end $$;

-- ─── Operations data ────────────────────────────────────────────────────────

create table public.zones (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  status    text not null default 'activa' check (status in ('activa', 'piloto', 'pausada')),
  center    jsonb not null,
  radius_m  integer not null default 1500
);

insert into public.zones (name, status, center) values
  ('Chapinero · Zona G', 'activa', '{"lat":4.6565,"lng":-74.0605}'),
  ('Usaquén · Santa Bárbara', 'activa', '{"lat":4.6948,"lng":-74.0307}'),
  ('Salitre · Aeropuerto', 'activa', '{"lat":4.6475,"lng":-74.1018}'),
  ('Teusaquillo · Galerías', 'activa', '{"lat":4.6405,"lng":-74.0765}'),
  ('Suba · Niza', 'piloto', '{"lat":4.7155,"lng":-74.0805}'),
  ('Centro · La Candelaria', 'activa', '{"lat":4.5976,"lng":-74.0689}');

create table public.promos (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  title         text not null,
  discount_pct  integer not null check (discount_pct between 1 and 60),
  cap           integer not null,
  budget        integer not null,
  status        text not null default 'programada' check (status in ('activa', 'programada', 'finalizada')),
  ends_at       date,
  created_at    timestamptz not null default now()
);

insert into public.promos (code, title, discount_pct, cap, budget, status, ends_at) values
  ('NUVAFRESH', 'Primer viaje con 40 %', 40, 8000, 40000000, 'activa', '2026-10-31'),
  ('ELECTRICO', 'Viajes eléctricos con 15 %', 15, 4000, 12000000, 'activa', '2026-11-15');

create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users (id),
  trip_id     uuid references public.trips (id),
  subject     text not null,
  body        text,
  priority    text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  status      text not null default 'abierto' check (status in ('abierto', 'en-curso', 'resuelto')),
  created_at  timestamptz not null default now()
);
create index support_tickets_created_by_idx on public.support_tickets (created_by);
create index support_tickets_trip_idx on public.support_tickets (trip_id);

-- ─── Admin dashboard ────────────────────────────────────────────────────────

create or replace function public.admin_dashboard(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'trips',              count(*) filter (where status = 'completed'),
    'cancellations',      count(*) filter (where status = 'cancelled'),
    'volume',             coalesce(sum(final_fare) filter (where status = 'completed'), 0),
    'commission',         coalesce(sum(platform_commission) filter (where status = 'completed'), 0),
    'averageFare',        coalesce(round(avg(final_fare) filter (where status = 'completed')), 0),
    'activeDrivers',      count(distinct driver_id) filter (where requested_at > now() - interval '1 day'),
    'activePassengers',   count(distinct passenger_id),
    'live',               count(*) filter (where status in ('requested', 'accepted', 'arriving', 'in_progress')),
    'pricingVersion',     (select max(version) from public.pricing_versions)
  ) into r
  from public.trips
  where requested_at > now() - make_interval(days => p_days);
  return r;
end $$;

-- ─── Row level security ─────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.bootstrap_admins  enable row level security;
alter table public.pricing_versions  enable row level security;
alter table public.trips             enable row level security;
alter table public.withdrawals       enable row level security;
alter table public.zones             enable row level security;
alter table public.promos            enable row level security;
alter table public.support_tickets   enable row level security;

-- (select auth.uid()) is evaluated once per query instead of per row.
create policy "own profile or admin"      on public.profiles for select using (id = (select auth.uid()) or public.is_admin());
create policy "edit own profile"          on public.profiles for update using (id = (select auth.uid()) or public.is_admin());

-- bootstrap_admins: no policies → invisible to clients.

create policy "pricing is public"         on public.pricing_versions for select using (true);

create policy "trips: participants, open requests for drivers, admins"
  on public.trips for select using (
    passenger_id = (select auth.uid())
    or driver_id = (select auth.uid())
    or (status = 'requested' and public.is_driver())
    or public.is_admin()
  );

create policy "own withdrawals or admin"  on public.withdrawals for select using (driver_id = (select auth.uid()) or public.is_admin());

create policy "zones readable"            on public.zones for select using (true);
create policy "zones admin insert"        on public.zones for insert with check (public.is_admin());
create policy "zones admin update"        on public.zones for update using (public.is_admin());
create policy "zones admin delete"        on public.zones for delete using (public.is_admin());

create policy "promos readable"           on public.promos for select using (status = 'activa' or public.is_admin());
create policy "promos admin insert"       on public.promos for insert with check (public.is_admin());
create policy "promos admin update"       on public.promos for update using (public.is_admin());
create policy "promos admin delete"       on public.promos for delete using (public.is_admin());

create policy "own tickets or admin"      on public.support_tickets for select using (created_by = (select auth.uid()) or public.is_admin());
create policy "open own ticket"           on public.support_tickets for insert with check (created_by = (select auth.uid()));
create policy "admin manages tickets"     on public.support_tickets for update using (public.is_admin());

-- Functions are the only write path for money tables: signed-in users only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.publish_pricing(jsonb, text)',
    'public.request_ride(jsonb, jsonb, text, text, numeric, integer)',
    'public.accept_ride(uuid)',
    'public.advance_ride(uuid, public.trip_status)',
    'public.cancel_ride(uuid)',
    'public.rate_trip(uuid, smallint, integer)',
    'public.request_withdrawal(integer, text)',
    'public.admin_dashboard(integer)',
    'public.promote_user(text, public.user_role)',
    'public.driver_balance(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ─── Realtime: apps react to new prices and new trips instantly ─────────────

alter publication supabase_realtime add table public.pricing_versions;
alter publication supabase_realtime add table public.trips;
