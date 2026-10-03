-- Passenger ↔ driver contact during a trip, and full ratings.
--  * trip_messages: in-app chat between the two people of a trip. Readable by them (and
--    admins for support); writable only while the trip is active.
--  * trip_counterpart also returns the other person's phone, only while the trip is
--    active (accepted → in progress), so they can call each other; never after.
--  * rate_trip stores the chosen tags and the optional comment.

create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists trip_messages_trip_idx on public.trip_messages (trip_id, created_at);
create index if not exists trip_messages_sender_idx on public.trip_messages (sender_id);
alter table public.trip_messages enable row level security;

create policy "trip people read messages" on public.trip_messages for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.trips t
       where t.id = trip_id and (select auth.uid()) in (t.passenger_id, t.driver_id)
    )
  );

create policy "trip people write while active" on public.trip_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.trips t
       where t.id = trip_id and (select auth.uid()) in (t.passenger_id, t.driver_id)
         and t.status in ('accepted', 'arriving', 'in_progress')
    )
  );

alter publication supabase_realtime add table public.trip_messages;

alter table public.trips add column if not exists rating_tags text[];
alter table public.trips add column if not exists rating_note text;

drop function if exists public.rate_trip(uuid, smallint, integer);
create or replace function public.rate_trip(p_trip uuid, p_rating smallint, p_tip integer default 0, p_tags text[] default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trips
     set rating = p_rating, tip = greatest(p_tip, 0),
         rating_tags = p_tags[1:10],
         rating_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where id = p_trip and passenger_id = auth.uid() and status = 'completed';
  if not found then raise exception 'Solo puedes calificar tus viajes completados'; end if;
end $$;
revoke execute on function public.rate_trip(uuid, smallint, integer, text[], text) from public, anon;
grant execute on function public.rate_trip(uuid, smallint, integer, text[], text) to authenticated;

create or replace function public.trip_counterpart(p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
    'avatar', p.avatar_url,
    -- Only while the trip is on; it disappears once completed or cancelled.
    'phone', case when t.status in ('accepted', 'arriving', 'in_progress') then p.phone end
  );
end $$;
