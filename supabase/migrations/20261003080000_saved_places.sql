-- Passenger's own saved places (Casa, Trabajo, favourites).
create table public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('home', 'work', 'favorite')),
  label       text not null,
  name        text not null,
  address     text,
  area        text,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);
create index saved_places_user_idx on public.saved_places (user_id);
-- One home and one work per user.
create unique index saved_places_one_home_work on public.saved_places (user_id, kind) where kind in ('home', 'work');
alter table public.saved_places enable row level security;
create policy "own saved places: read" on public.saved_places for select using (user_id = (select auth.uid()));
create policy "own saved places: insert" on public.saved_places for insert with check (user_id = (select auth.uid()));
create policy "own saved places: update" on public.saved_places for update using (user_id = (select auth.uid()));
create policy "own saved places: delete" on public.saved_places for delete using (user_id = (select auth.uid()));
