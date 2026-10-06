-- NÜVA's own bank accounts per country (where drivers transfer to top up their
-- balance). Edited from the admin console whenever the company changes accounts.
-- Signed-in users read the active ones; only admins create, edit or delete.

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  country text not null check (country in ('CO', 'CW')),
  bank text not null check (length(btrim(bank)) between 2 and 60),
  account_type text not null default '' check (length(account_type) <= 40),
  number text not null check (length(btrim(number)) between 3 and 40),
  holder text not null check (length(btrim(holder)) between 2 and 80),
  holder_id text not null default '' check (length(holder_id) <= 40),
  note text not null default '' check (length(note) <= 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists bank_accounts_country_idx on public.bank_accounts (country, active);

create or replace function public.bank_accounts_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists bank_accounts_touch on public.bank_accounts;
create trigger bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.bank_accounts_touch();

alter table public.bank_accounts enable row level security;

revoke all on public.bank_accounts from anon;
grant select, insert, update, delete on public.bank_accounts to authenticated;

drop policy if exists "bank accounts readable" on public.bank_accounts;
create policy "bank accounts readable" on public.bank_accounts
  for select to authenticated using (active or public.is_admin());

drop policy if exists "bank accounts admin insert" on public.bank_accounts;
create policy "bank accounts admin insert" on public.bank_accounts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "bank accounts admin update" on public.bank_accounts;
create policy "bank accounts admin update" on public.bank_accounts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bank accounts admin delete" on public.bank_accounts;
create policy "bank accounts admin delete" on public.bank_accounts
  for delete to authenticated using (public.is_admin());

-- The accounts are the owner's: where NÜVA's commission money arrives. Colombia
-- collects through Wompi (payouts go to the account set in Wompi's own panel), so
-- its accounts are an admin-only record. Curaçao has no gateway yet: drivers see
-- the active account there to pay their commissions.
drop policy if exists "bank accounts readable" on public.bank_accounts;
create policy "bank accounts readable" on public.bank_accounts
  for select to authenticated using (public.is_admin() or (active and country = 'CW'));
