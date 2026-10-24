-- NÜVA, phase 2 (2026-10-24): what makes NÜVA better than the other apps in Colombia.
--
-- Passengers
--   · Card payments: the trip is paid at the end through NÜVA's Wompi account (`wompi` edge
--     function, service role). The driver's part is credited to their NÜVA balance.
--   · Saved cards (Wompi payment sources) for passengers and drivers.
--   · NÜVA Mujeres: a passenger can ask for a verified woman driver; a woman driver can
--     choose to take only women passengers.
--   · Scheduled trips: requested up to 7 days ahead at today's price; offered to drivers
--     15 minutes before the pickup time.
--   · Share the trip: a link that shows the trip live to anyone the passenger sends it to.
--   · Driver identity check: a selfie every N hours before taking trips (admin reviews them).
-- Drivers
--   · Daily pass (24 h without commission) besides the weekly one.
--   · Withdrawals of what they earned with card trips, cancellations and promotions.
--   · Human review: suspensions carry a reason, the driver can appeal from the app and
--     support answers inside the app.

-- ── Settings ─────────────────────────────────────────────────────────────────
alter table public.nuva_settings
  add column if not exists day_pass_price integer not null default 12000,
  add column if not exists day_pass_enabled boolean not null default true,
  add column if not exists min_withdrawal integer not null default 20000,
  add column if not exists selfie_hours integer not null default 12;

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
    day_pass_price   = coalesce((p ->> 'day_pass_price')::integer, day_pass_price),
    day_pass_enabled = coalesce((p ->> 'day_pass_enabled')::boolean, day_pass_enabled),
    min_withdrawal   = coalesce((p ->> 'min_withdrawal')::integer, min_withdrawal),
    selfie_hours     = coalesce((p ->> 'selfie_hours')::integer, selfie_hours),
    max_pickup_km    = coalesce((p ->> 'max_pickup_km')::numeric, max_pickup_km),
    updated_at = now(), updated_by = auth.uid()
  where country = c
  returning * into s;
  if not found then raise exception 'País no válido'; end if;
  if s.free_trips < 0 or s.tier_threshold < 1 or s.tier_pct < 0 or s.tier_pct > 40 or s.debt_allowance < 0
     or s.wait_free_min < 0 or s.wait_per_min < 0 or s.no_show_fee < 0 or s.no_show_wait_min < 1
     or s.challenge_trips < 1 or s.challenge_pct < 0 or s.challenge_pct > 40 or s.pass_price < 1 or s.max_pickup_km <= 0
     or s.day_pass_price < 1 or s.min_withdrawal < 1000 or s.selfie_hours < 0 or s.selfie_hours > 168 then
    raise exception 'Valores inválidos';
  end if;
  return s;
end $$;

-- ── Profiles: NÜVA Mujeres, identity check, reasons of a suspension ──────────
alter table public.profiles
  add column if not exists gender text check (gender in ('f', 'm')),
  add column if not exists women_verified boolean not null default false,
  add column if not exists women_riders_only boolean not null default false,
  add column if not exists selfie_at timestamptz,
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz;

-- Only an admin verifies a woman driver, sets a status reason or records the selfie time;
-- changing one's own gender drops the verification. Applies to direct edits from the apps
-- (role authenticated); the server functions (record_selfie…) run as their owner.
create or replace function public.guard_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role is distinct from old.role
       or new.driver_status is distinct from old.driver_status
       or new.test_wallet is distinct from old.test_wallet
       or new.country is distinct from old.country
       or new.rating is distinct from old.rating
       or new.women_verified is distinct from old.women_verified
       or new.selfie_at is distinct from old.selfie_at
       or new.status_reason is distinct from old.status_reason
       or new.status_changed_at is distinct from old.status_changed_at then
      raise exception 'Solo un administrador puede cambiar roles, país, calificación o aprobar conductores';
    end if;
    if new.gender is distinct from old.gender then new.women_verified := false; end if;
    if new.gender is distinct from 'f' then new.women_riders_only := false; end if;
  end if;
  return new;
end $$;

-- ── Trips: card channel, NÜVA Mujeres, scheduling ───────────────────────────
alter table public.trips drop column if exists payment_channel;
alter table public.trips
  add column payment_channel text generated always as (case when payment = 'card' then 'platform' else 'direct' end) stored,
  add column if not exists paid_at timestamptz,
  add column if not exists women_only boolean not null default false,
  add column if not exists passenger_female boolean not null default false,
  add column if not exists scheduled_for timestamptz;
-- When the request is offered to drivers: right away, or 15 minutes before a scheduled pickup
-- (set by request_ride; never changes afterwards).
alter table public.trips add column if not exists release_at timestamptz not null default now();
update public.trips set release_at = requested_at where release_at is distinct from requested_at;
create index if not exists trips_open_requests_idx on public.trips (country, release_at desc) where status = 'requested';

-- Can the signed-in driver see / take this open request?
create or replace function public.request_open_for_me(p_release timestamptz, p_women_only boolean, p_passenger_female boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_driver()
     and p_release <= now()
     and coalesce((select (not p_women_only or (gender = 'f' and women_verified))
                      and (not women_riders_only or p_passenger_female)
                    from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.request_open_for_me(timestamptz, boolean, boolean) from public, anon;
grant execute on function public.request_open_for_me(timestamptz, boolean, boolean) to authenticated;

drop policy if exists "trips: participants, open requests for drivers, admins" on public.trips;
create policy "trips: participants, open requests for drivers, admins" on public.trips for select to authenticated
  using (passenger_id = (select auth.uid()) or driver_id = (select auth.uid())
         or (status = 'requested' and public.request_open_for_me(release_at, women_only, passenger_female))
         or public.is_admin());

-- ── Request ─────────────────────────────────────────────────────────────────
drop function if exists public.request_ride(jsonb, jsonb, text, text, numeric, integer, text);
create function public.request_ride(p_pickup jsonb, p_destination jsonb, p_category text default 'go', p_payment text default 'cash',
  p_distance_km numeric default null, p_duration_min integer default null, p_promo_code text default null,
  p_women_only boolean default false, p_scheduled_for timestamptz default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare est record; km numeric; mins integer; f jsonb; t public.trips; c text; z text; promo jsonb; pf integer; g text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pedir un viaje'; end if;
  if p_payment not in ('cash', 'nequi', 'daviplata', 'bancolombia', 'card') then raise exception 'Método de pago no válido'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  -- Unanswered requests expire 15 minutes after they were offered (scheduled: 15 min after the pickup time).
  update public.trips set status = 'cancelled', cancelled_at = now(), cancelled_by = 'system'
   where passenger_id = auth.uid() and status = 'requested'
     and coalesce(scheduled_for, requested_at) < now() - interval '15 minutes';
  if p_scheduled_for is null then
    if exists (select 1 from public.trips where passenger_id = auth.uid() and status in ('requested', 'accepted', 'arriving', 'in_progress')
                 and release_at <= now()) then
      raise exception 'Ya tienes un viaje en curso';
    end if;
  else
    if p_scheduled_for < now() + interval '30 minutes' or p_scheduled_for > now() + interval '7 days' then
      raise exception 'Programa tu viaje con al menos 30 minutos y máximo 7 días de anticipación';
    end if;
    if (select count(*) from public.trips where passenger_id = auth.uid() and status = 'requested' and release_at > now()) >= 3 then
      raise exception 'Ya tienes 3 viajes programados';
    end if;
    if exists (select 1 from public.trips where passenger_id = auth.uid() and status = 'requested'
                 and scheduled_for between p_scheduled_for - interval '1 hour' and p_scheduled_for + interval '1 hour') then
      raise exception 'Ya tienes un viaje programado cerca de esa hora';
    end if;
  end if;
  select coalesce(country, 'CO'), coalesce(pending_fee, 0), gender into c, pf, g from public.profiles where id = auth.uid();
  if p_women_only and g is distinct from 'f' then
    raise exception 'NÜVA Mujeres es para pasajeras. Indica en tu perfil que eres mujer';
  end if;
  z := public.zone_check(p_pickup, c);
  if z = 'paused' then raise exception 'El servicio está pausado temporalmente en esa zona'; end if;
  if z = 'outside' then raise exception 'Aún no operamos en ese punto de recogida'; end if;
  select * into est from public.estimate_route(p_pickup, p_destination);
  km   := case when p_distance_km between est.distance_km * 0.65 and est.distance_km * 2.0 then p_distance_km else est.distance_km end;
  mins := case when p_duration_min between est.duration_min * 0.5 and est.duration_min * 2.5 then p_duration_min else est.duration_min end;
  -- A scheduled trip is priced for its pickup time (night surcharge) and the price is kept.
  f    := public.calculate_fare(km, mins, p_category, null, c, p_pickup, p_destination, coalesce(p_scheduled_for, now()));
  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
    perform 1 from public.promos where code = upper(btrim(p_promo_code)) for update;
    promo := public.check_promo(p_promo_code, (f ->> 'finalFare')::integer);
    if not (promo ->> 'ok')::boolean then raise exception '%', promo ->> 'error'; end if;
  end if;
  -- A pending late-cancellation fee: NÜVA already credited the previous driver, so it is
  -- recovered through this trip's commission (the driver's net is unchanged).
  if pf > 0 then
    f := f || jsonb_build_object('pendingFee', pf, 'finalFare', (f ->> 'finalFare')::integer + pf,
                                 'platformCommission', (f ->> 'platformCommission')::integer + pf);
  end if;
  insert into public.trips (passenger_id, category, payment, pickup, destination, distance_km, duration_min,
                            pricing_version, fare, final_fare, platform_commission, driver_earnings, country, currency,
                            promo_id, discount, women_only, passenger_female, scheduled_for, release_at)
  values (auth.uid(), p_category, p_payment, p_pickup, p_destination, km, mins,
          (f ->> 'version')::integer, f, (f ->> 'finalFare')::integer,
          (f ->> 'platformCommission')::integer, (f ->> 'driverEarnings')::integer, c, public.country_currency(c),
          (promo ->> 'promoId')::uuid, coalesce((promo ->> 'discount')::integer, 0),
          coalesce(p_women_only, false), coalesce(g = 'f', false), p_scheduled_for,
          coalesce(p_scheduled_for - interval '15 minutes', now()))
  returning * into t;
  return t;
end $$;
revoke execute on function public.request_ride(jsonb, jsonb, text, text, numeric, integer, text, boolean, timestamptz) from public, anon;
grant execute on function public.request_ride(jsonb, jsonb, text, text, numeric, integer, text, boolean, timestamptz) to authenticated;

-- A card trip whose card failed can be paid directly to the driver instead.
create or replace function public.switch_trip_payment(p_trip uuid, p_payment text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips;
begin
  if p_payment not in ('cash', 'nequi', 'daviplata', 'bancolombia') then raise exception 'Método de pago no válido'; end if;
  update public.trips set payment = p_payment, payment_ref = null
   where id = p_trip and passenger_id = auth.uid() and payment = 'card' and payment_status <> 'pagado'
     and status in ('requested', 'accepted', 'arriving', 'in_progress', 'completed')
  returning * into t;
  if not found then raise exception 'Este viaje ya no puede cambiar de método de pago'; end if;
  return t;
end $$;
revoke execute on function public.switch_trip_payment(uuid, text) from public, anon;
grant execute on function public.switch_trip_payment(uuid, text) to authenticated;

-- ── Accept: women-only, identity check, card trips need no balance ──────────
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
  if not found or t0.status <> 'requested' or t0.passenger_id = auth.uid() or t0.release_at > now() then
    raise exception 'Este viaje ya fue tomado o cancelado';
  end if;
  if t0.country is distinct from me.country and not public.is_admin() then raise exception 'Este viaje es de otro país'; end if;
  if t0.women_only and not (me.gender = 'f' and me.women_verified) then raise exception 'Este viaje es de NÜVA Mujeres'; end if;
  if me.women_riders_only and not t0.passenger_female then raise exception 'Elegiste recibir solo pasajeras'; end if;

  select * into s from public.nuva_settings where country = coalesce(t0.country, 'CO');
  if coalesce(s.selfie_hours, 0) > 0 and me.role = 'driver'
     and (me.selfie_at is null or me.selfie_at < now() - make_interval(hours => s.selfie_hours)) then
    raise exception 'Tómate la selfie de verificación para recibir viajes';
  end if;
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

  -- A card trip pays its commission out of the card payment: no prepaid balance needed.
  if t0.payment <> 'card' and not coalesce(me.test_wallet, false)
     and public.driver_balance(auth.uid()) - com < -coalesce(s.debt_allowance, 0) then
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

-- ── Card trips: the tip is final once paid; the driver's part goes to the balance ──
create or replace function public.rate_trip(p_trip uuid, p_rating smallint, p_tip integer default 0, p_tags text[] default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trips
     set rating = p_rating,
         tip = case when payment = 'card' and payment_status = 'pagado' then tip else greatest(p_tip, 0) end,
         rating_tags = p_tags[1:10],
         rating_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where id = p_trip and passenger_id = auth.uid() and status = 'completed';
  if not found then raise exception 'Solo puedes calificar tus viajes completados'; end if;
end $$;

-- What the passenger paid by card (fare − promo + tip) is credited to the driver; the trip's
-- commission is already counted against the balance, and the promo is credited apart.
create or replace function public.credit_card_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare amt integer;
begin
  if new.payment = 'card' and new.payment_status = 'pagado' and old.payment_status is distinct from 'pagado' and new.driver_id is not null then
    amt := new.final_fare - coalesce(new.discount, 0) + coalesce(new.tip, 0);
    if amt > 0 then
      insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
      values (new.driver_id, amt, 'pagado', 'tarjeta', left('Viaje con tarjeta ' || new.code, 120));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trips_credit_card on public.trips;
create trigger trips_credit_card after update of payment_status on public.trips
  for each row execute function public.credit_card_trip();

-- ── Saved cards (Wompi payment sources), for passengers and drivers ─────────
create table if not exists public.saved_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider    text not null default 'wompi' check (provider in ('wompi')),
  source_id   bigint not null,
  brand       text,
  last4       text check (last4 ~ '^[0-9]{4}$'),
  exp_month   smallint check (exp_month between 1 and 12),
  exp_year    smallint,
  holder      text,
  live        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, provider, source_id)
);
create index if not exists saved_cards_user_idx on public.saved_cards (user_id, created_at desc);
alter table public.saved_cards enable row level security;
drop policy if exists "saved_cards: own select" on public.saved_cards;
create policy "saved_cards: own select" on public.saved_cards for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "saved_cards: own delete" on public.saved_cards;
create policy "saved_cards: own delete" on public.saved_cards for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.saved_cards from anon;
grant select, delete on public.saved_cards to authenticated;

-- ── Passes: daily (24 h) and weekly (7 days) ────────────────────────────────
alter table public.driver_passes add column if not exists kind text not null default 'week' check (kind in ('day', 'week'));

create or replace function public.buy_pass(p_kind text default 'week')
returns public.driver_passes
language plpgsql
security definer
set search_path = public
as $$
declare me public.profiles; s public.nuva_settings; p public.driver_passes; price integer; label text;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  if p_kind not in ('day', 'week') then raise exception 'Pase no válido'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  select * into s from public.nuva_settings where country = coalesce(me.country, 'CO');
  if (p_kind = 'week' and not coalesce(s.pass_enabled, false)) or (p_kind = 'day' and not coalesce(s.day_pass_enabled, false)) then
    raise exception 'Este pase no está disponible';
  end if;
  if exists (select 1 from public.driver_passes where driver_id = auth.uid() and now() between starts_at and ends_at) then
    raise exception 'Ya tienes un pase activo';
  end if;
  price := case p_kind when 'day' then s.day_pass_price else s.pass_price end;
  label := case p_kind when 'day' then 'Pase diario' else 'Pase semanal' end;
  if public.driver_balance(auth.uid()) < price then raise exception 'Saldo insuficiente para el pase. Recarga tu saldo NÜVA'; end if;
  insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
  values (auth.uid(), -price, 'pagado', 'pase', label);
  insert into public.driver_passes (driver_id, country, price, starts_at, ends_at, kind)
  values (auth.uid(), coalesce(me.country, 'CO'), price, now(), now() + case p_kind when 'day' then interval '24 hours' else interval '7 days' end, p_kind)
  returning * into p;
  return p;
end $$;
revoke execute on function public.buy_pass(text) from public, anon;
grant execute on function public.buy_pass(text) to authenticated;

create or replace function public.buy_weekly_pass()
returns public.driver_passes
language sql
security definer
set search_path = public
as $$ select public.buy_pass('week') $$;

-- ── Withdrawals ─────────────────────────────────────────────────────────────
alter table public.withdrawals drop constraint if exists withdrawals_amount_check;
alter table public.withdrawals add constraint withdrawals_amount_check check (amount > 0);
alter table public.withdrawals
  add column if not exists method text check (method in ('nequi', 'daviplata', 'bancolombia', 'banco')),
  add column if not exists note text,
  add column if not exists processed_at timestamptz,
  add column if not exists processed_by uuid references public.profiles (id);
revoke insert, update, delete on public.withdrawals from authenticated, anon;

-- Balance = credits − commissions − withdrawals (not rejected).
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
    - coalesce((select sum(amount) from public.withdrawals, me where driver_id = me.id and status <> 'rechazado'), 0)
  )::integer
$$;

-- What can be withdrawn: money NÜVA collected for the driver (card trips, cancellation
-- fees, promotions), never top-ups or bonuses, and never more than the balance.
create or replace function public.driver_withdrawable(p_driver uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select greatest(0, least(
      public.driver_balance((select id from me)),
      coalesce((select sum(amount) from public.driver_topups, me where driver_id = me.id and status = 'pagado'
                  and method in ('tarjeta', 'cancelacion', 'promo')), 0)
    - coalesce((select sum(amount) from public.withdrawals, me where driver_id = me.id and status <> 'rechazado'), 0)
  ))::integer
$$;
revoke execute on function public.driver_withdrawable(uuid) from public, anon;
grant execute on function public.driver_withdrawable(uuid) to authenticated;

drop function if exists public.request_withdrawal(integer, text);
create function public.request_withdrawal(p_amount integer, p_method text, p_account text)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare w public.withdrawals; me public.profiles; s public.nuva_settings; acct text := btrim(coalesce(p_account, ''));
begin
  if not public.is_driver() then raise exception 'Solo conductores aprobados'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  select * into s from public.nuva_settings where country = coalesce(me.country, 'CO');
  if p_method not in ('nequi', 'daviplata', 'bancolombia', 'banco') then raise exception 'Elige a dónde enviamos tu dinero'; end if;
  if (p_method in ('nequi', 'daviplata') and acct !~ '^3[0-9]{9}$') or length(acct) < 6 then raise exception 'Revisa el número de la cuenta'; end if;
  if p_amount is null or p_amount < coalesce(s.min_withdrawal, 20000) then
    raise exception 'El retiro mínimo es de $%', to_char(coalesce(s.min_withdrawal, 20000), 'FM999G999G999');
  end if;
  if exists (select 1 from public.withdrawals where driver_id = auth.uid() and status = 'procesando') then
    raise exception 'Ya tienes un retiro en proceso';
  end if;
  if p_amount > public.driver_withdrawable(auth.uid()) then raise exception 'Ese monto es mayor a lo que puedes retirar'; end if;
  insert into public.withdrawals (driver_id, amount, destination, method) values (auth.uid(), p_amount, left(acct, 60), p_method)
  returning * into w;
  return w;
end $$;
revoke execute on function public.request_withdrawal(integer, text, text) from public, anon;
grant execute on function public.request_withdrawal(integer, text, text) to authenticated;

create or replace function public.admin_resolve_withdrawal(p_id uuid, p_status text, p_note text default null)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare w public.withdrawals;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('completado', 'rechazado') then raise exception 'Estado no válido'; end if;
  if p_status = 'rechazado' and coalesce(length(btrim(p_note)), 0) < 3 then raise exception 'Escribe el motivo del rechazo'; end if;
  update public.withdrawals set status = p_status, note = nullif(left(btrim(coalesce(p_note, '')), 200), ''),
         processed_at = now(), processed_by = auth.uid()
   where id = p_id and status = 'procesando'
  returning * into w;
  if not found then raise exception 'Este retiro ya fue procesado'; end if;
  insert into public.admin_audit (action, target, details)
  values ('withdrawal_' || p_status, w.driver_id, jsonb_build_object('withdrawal', w.id, 'amount', w.amount, 'note', w.note));
  return w;
end $$;
revoke execute on function public.admin_resolve_withdrawal(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_withdrawal(uuid, text, text) to authenticated;

create or replace function public.admin_withdrawals(p_status text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id, 'driverId', w.driver_id, 'driver', coalesce(nullif(p.full_name, ''), p.email), 'phone', p.phone,
             'amount', w.amount, 'method', w.method, 'account', w.destination, 'status', w.status, 'note', w.note,
             'createdAt', w.created_at, 'processedAt', w.processed_at) order by (w.status = 'procesando') desc, w.created_at desc)
      from (select * from public.withdrawals where p_status is null or status = p_status order by created_at desc limit 200) w
      join public.profiles p on p.id = w.driver_id), '[]'::jsonb) end
$$;
revoke execute on function public.admin_withdrawals(text) from public, anon;
grant execute on function public.admin_withdrawals(text) to authenticated;

-- ── Driver wallet: commission rule and movements (passes, card trips, withdrawals) ──
create or replace function public.my_commission_rule()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (select id, coalesce(country, 'CO') c, coalesce(test_wallet, false) test, selfie_at from public.profiles where id = auth.uid()),
       s as (select n.* from public.nuva_settings n, p where n.country = p.c),
       tz as (select case p.c when 'CW' then 'America/Curacao' else 'America/Bogota' end z from p),
       done as (select count(*) n from public.trips, p where driver_id = p.id and status = 'completed'),
       month as (select count(*) n from public.trips, p, tz where driver_id = p.id and status = 'completed'
                   and completed_at >= date_trunc('month', now() at time zone tz.z) at time zone tz.z),
       week as (select count(*) n from public.trips, p, tz where driver_id = p.id and status = 'completed'
                   and completed_at >= date_trunc('week', now() at time zone tz.z) at time zone tz.z),
       pass as (select max(ends_at) e, (array_agg(kind order by ends_at desc))[1] k
                  from public.driver_passes, p where driver_id = p.id and now() between starts_at and ends_at)
  select jsonb_build_object(
    'freeTrips', s.free_trips, 'freeLeft', greatest(s.free_trips - done.n, 0),
    'monthTrips', month.n, 'tierThreshold', s.tier_threshold, 'tierPct', s.tier_pct, 'tierActive', month.n >= s.tier_threshold,
    'weekTrips', week.n, 'challengeTrips', s.challenge_trips, 'challengePct', s.challenge_pct, 'challengeActive', week.n >= s.challenge_trips,
    'passEnabled', s.pass_enabled, 'passPrice', s.pass_price, 'passActive', pass.e is not null, 'passEndsAt', pass.e, 'passKind', pass.k,
    'dayPassEnabled', s.day_pass_enabled, 'dayPassPrice', s.day_pass_price,
    'debtAllowance', s.debt_allowance, 'maxPickupKm', s.max_pickup_km,
    'waitFreeMin', s.wait_free_min, 'waitPerMin', s.wait_per_min, 'noShowFee', s.no_show_fee, 'noShowWaitMin', s.no_show_wait_min,
    'balance', public.driver_balance(auth.uid()), 'withdrawable', public.driver_withdrawable(auth.uid()), 'minWithdrawal', s.min_withdrawal,
    'selfieHours', s.selfie_hours, 'selfieAt', p.selfie_at,
    'selfieOk', s.selfie_hours = 0 or (p.selfie_at is not null and p.selfie_at > now() - make_interval(hours => s.selfie_hours)),
    'test', p.test)
  from p, s, done, month, week, pass
$$;

create or replace function public.driver_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'withdrawable', public.driver_withdrawable(auth.uid()),
    'test', coalesce((select test_wallet from public.profiles where id = auth.uid()), false),
    'movements', coalesce((
      select jsonb_agg(m order by m ->> 'at' desc) from (
        select m from (
          select jsonb_build_object(
                   'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' when 'promo' then 'promo'
                                       when 'pase' then 'pase' when 'cancelacion' then 'cancelacion' when 'tarjeta' then 'tarjeta'
                                       else 'recarga' end,
                   'amount', amount,
                   'status', case when status = 'pendiente' and created_at < now() - interval '1 hour' then 'vencido' else status end,
                   'at', created_at,
                   'note', case when method in ('ajuste', 'promo', 'cancelacion', 'pase', 'tarjeta') then payment_ref end) as m
            from public.driver_topups where driver_id = auth.uid()
          union all
          select jsonb_build_object('kind', 'comision',
                   'amount', case when commission_waived then 0 else -platform_commission end,
                   'status', 'pagado', 'at', completed_at, 'code', code, 'rule', commission_rule)
            from public.trips where driver_id = auth.uid() and status = 'completed'
          union all
          select jsonb_build_object('kind', 'retiro', 'amount', -amount, 'status', status, 'at', created_at,
                   'note', note, 'method', method)
            from public.withdrawals where driver_id = auth.uid()
        ) u
        order by m ->> 'at' desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

-- ── Identity check: a selfie before taking trips ─────────────────────────────
insert into storage.buckets (id, name, public) values ('selfies', 'selfies', false) on conflict (id) do nothing;
drop policy if exists "selfies: driver uploads own" on storage.objects;
create policy "selfies: driver uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "selfies: own or admin reads" on storage.objects;
create policy "selfies: own or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'selfies' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

create table if not exists public.driver_selfies (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  path        text not null,
  status      text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists driver_selfies_driver_idx on public.driver_selfies (driver_id, created_at desc);
create index if not exists driver_selfies_pending_idx on public.driver_selfies (created_at desc) where status = 'pendiente';
alter table public.driver_selfies enable row level security;
drop policy if exists "driver_selfies: own or admin" on public.driver_selfies;
create policy "driver_selfies: own or admin" on public.driver_selfies for select to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin());
revoke all on public.driver_selfies from anon;
grant select on public.driver_selfies to authenticated;

create or replace function public.record_selfie(p_path text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare ts timestamptz := now();
begin
  if not public.is_driver() then raise exception 'Solo conductores aprobados'; end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects where bucket_id = 'selfies' and name = p_path) then
    raise exception 'Sube la selfie primero';
  end if;
  insert into public.driver_selfies (driver_id, path) values (auth.uid(), p_path);
  update public.profiles set selfie_at = ts where id = auth.uid();
  return ts;
end $$;
revoke execute on function public.record_selfie(text) from public, anon;
grant execute on function public.record_selfie(text) to authenticated;

-- A rejected selfie (not the driver on file) takes them offline until a new one.
create or replace function public.admin_review_selfie(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('aprobada', 'rechazada') then raise exception 'Estado no válido'; end if;
  update public.driver_selfies set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id returning driver_id into d;
  if not found then raise exception 'Selfie no encontrada'; end if;
  if p_status = 'rechazada' then
    update public.profiles set selfie_at = null where id = d;
    update public.driver_presence set online = false where driver_id = d;
  end if;
  insert into public.admin_audit (action, target, details) values ('selfie_' || p_status, d, jsonb_build_object('selfie', p_id));
end $$;
revoke execute on function public.admin_review_selfie(uuid, text) from public, anon;
grant execute on function public.admin_review_selfie(uuid, text) to authenticated;

-- Admin verifies a woman driver for NÜVA Mujeres.
create or replace function public.admin_set_women_verified(p_driver uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set women_verified = p_verified, gender = case when p_verified then 'f' else gender end
   where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  insert into public.admin_audit (action, target, details) values ('women_verified', p_driver, jsonb_build_object('verified', p_verified));
end $$;
revoke execute on function public.admin_set_women_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_women_verified(uuid, boolean) to authenticated;

-- The passenger sees the driver's photo, whether their identity was checked today and
-- whether they're a verified NÜVA Mujeres driver.
create or replace function public.trip_counterpart(p_trip uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.trips; other uuid; p public.profiles; acct text; hrs integer;
begin
  select * into t from public.trips where id = p_trip;
  if not found or auth.uid() not in (t.passenger_id, coalesce(t.driver_id, '00000000-0000-0000-0000-000000000000')) then
    raise exception 'No autorizado';
  end if;
  other := case when auth.uid() = t.passenger_id then t.driver_id else t.passenger_id end;
  if other is null then return null; end if;
  select * into p from public.profiles where id = other;
  select selfie_hours into hrs from public.nuva_settings where country = coalesce(t.country, 'CO');
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
    'avatar', p.avatar_url,
    'phone', case when t.status in ('accepted', 'arriving', 'in_progress') then p.phone end,
    'identityCheckedAt', case when p.role = 'driver' and coalesce(hrs, 0) > 0
                               and p.selfie_at > now() - make_interval(hours => hrs) then p.selfie_at end,
    'womenVerified', p.role = 'driver' and p.gender = 'f' and p.women_verified
  );
end $$;

-- ── Share the trip ───────────────────────────────────────────────────────────
create table if not exists public.trip_shares (
  trip_id    uuid primary key references public.trips (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.trip_shares enable row level security;
revoke all on public.trip_shares from anon, authenticated;

create or replace function public.share_trip(p_trip uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare tok text;
begin
  if not exists (select 1 from public.trips where id = p_trip and passenger_id = auth.uid()
                   and status in ('requested', 'accepted', 'arriving', 'in_progress')) then
    raise exception 'Solo puedes compartir un viaje en curso';
  end if;
  insert into public.trip_shares (trip_id) values (p_trip) on conflict (trip_id) do nothing;
  select token into tok from public.trip_shares where trip_id = p_trip;
  return tok;
end $$;
revoke execute on function public.share_trip(uuid) from public, anon;
grant execute on function public.share_trip(uuid) to authenticated;

-- Public: what a shared link shows (no phone numbers, no exact pickup address after the
-- trip ends). Works while the trip is on and for 30 minutes after it ends.
create or replace function public.shared_trip(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', t.code, 'status', t.status,
    'pickup', jsonb_build_object('name', t.pickup ->> 'name', 'lat', t.pickup -> 'lat', 'lng', t.pickup -> 'lng'),
    'destination', jsonb_build_object('name', t.destination ->> 'name', 'lat', t.destination -> 'lat', 'lng', t.destination -> 'lng'),
    'passenger', split_part(coalesce(nullif(pp.full_name, ''), 'Pasajero'), ' ', 1),
    'driver', case when d.id is not null then jsonb_build_object(
        'name', split_part(coalesce(nullif(d.full_name, ''), 'Conductor'), ' ', 1),
        'rating', d.rating, 'avatar', d.avatar_url,
        'vehicle', jsonb_build_object('brand', d.vehicle ->> 'brand', 'model', d.vehicle ->> 'model',
                                      'color', d.vehicle ->> 'color', 'plate', d.vehicle ->> 'plate')) end,
    'position', case when t.status in ('accepted', 'arriving', 'in_progress') and pr.updated_at > now() - interval '5 minutes'
                     then jsonb_build_object('lat', pr.lat, 'lng', pr.lng, 'heading', pr.heading, 'at', pr.updated_at) end,
    'requestedAt', t.requested_at, 'acceptedAt', t.accepted_at, 'startedAt', t.started_at,
    'completedAt', t.completed_at, 'cancelledAt', t.cancelled_at,
    'durationMin', t.duration_min, 'distanceKm', t.distance_km)
  from public.trip_shares s
  join public.trips t on t.id = s.trip_id
  join public.profiles pp on pp.id = t.passenger_id
  left join public.profiles d on d.id = t.driver_id
  left join public.driver_presence pr on pr.driver_id = t.driver_id
  where s.token = p_token
    and (t.status in ('requested', 'accepted', 'arriving', 'in_progress')
         or coalesce(t.completed_at, t.cancelled_at) > now() - interval '30 minutes')
$$;
revoke execute on function public.shared_trip(text) from public;
grant execute on function public.shared_trip(text) to anon, authenticated;

-- ── Human review: suspension reasons, appeals and answers from support ──────
drop function if exists public.set_driver_status(uuid, text);
create function public.set_driver_status(p_driver uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare bonus integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('pendiente', 'aprobado', 'suspendido') then raise exception 'Estado no válido'; end if;
  if p_status = 'suspendido' and coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'Escribe el motivo de la suspensión: el conductor lo verá y podrá apelar';
  end if;
  update public.profiles set driver_status = p_status, status_changed_at = now(),
         status_reason = case when p_status = 'aprobado' then null else nullif(left(btrim(coalesce(p_reason, '')), 300), '') end
   where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  if p_status = 'suspendido' then update public.driver_presence set online = false where driver_id = p_driver; end if;
  select s.welcome_bonus into bonus from public.nuva_settings s join public.profiles p on p.country = s.country where p.id = p_driver;
  if p_status = 'aprobado' and coalesce(bonus, 0) > 0
     and not exists (select 1 from public.driver_topups where driver_id = p_driver and method = 'bono') then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref) values (p_driver, bonus, 'pagado', 'bono', 'BIENVENIDA');
  end if;
  insert into public.admin_audit (action, target, details)
  values ('driver_status', p_driver, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;
revoke execute on function public.set_driver_status(uuid, text, text) from public, anon;
grant execute on function public.set_driver_status(uuid, text, text) to authenticated;

alter table public.support_tickets
  add column if not exists kind text not null default 'general' check (kind in ('general', 'apelacion', 'seguridad', 'pago')),
  add column if not exists reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references public.profiles (id);

-- Appeals and safety reports go to the top of the queue.
create or replace function public.ticket_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(country, 'CO') into new.country from public.profiles where id = new.created_by;
  if not public.is_admin() then
    new.status := 'abierto';
    new.priority := case when new.kind in ('apelacion', 'seguridad') then 'alta' else 'media' end;
    new.reply := null; new.replied_at := null; new.replied_by := null;
    if new.trip_id is not null and not exists (
      select 1 from public.trips t where t.id = new.trip_id and new.created_by in (t.passenger_id, t.driver_id)
    ) then
      new.trip_id := null;
    end if;
  end if;
  return new;
end $$;

create or replace function public.admin_reply_ticket(p_ticket uuid, p_reply text, p_resolve boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if coalesce(length(btrim(p_reply)), 0) < 2 then raise exception 'Escribe la respuesta'; end if;
  update public.support_tickets set reply = left(btrim(p_reply), 2000), replied_at = now(), replied_by = auth.uid(),
         status = case when p_resolve then 'resuelto' else 'en-curso' end
   where id = p_ticket;
  if not found then raise exception 'Caso no encontrado'; end if;
end $$;
revoke execute on function public.admin_reply_ticket(uuid, text, boolean) from public, anon;
grant execute on function public.admin_reply_ticket(uuid, text, boolean) to authenticated;
