-- Security / performance clean-up from the Supabase advisors.

-- Withdrawals belong to the old model: drivers are now paid directly by passengers
-- and the NÜVA balance is prepaid (incl. welcome bonuses), so it can't be cashed out.
revoke execute on function public.request_withdrawal(integer, text) from public, anon, authenticated;

-- Listed every online driver's live position to any signed-in user; unused by the apps.
revoke execute on function public.nearby_drivers(double precision, double precision, double precision) from public, anon, authenticated;

-- Fixed search_path (advisor: function_search_path_mutable).
create or replace function public.country_currency(c text) returns text
language sql immutable set search_path = public as $$
  select case c when 'CW' then 'XCG' else 'COP' end
$$;

-- Covering indexes for foreign keys.
create index if not exists nuva_settings_updated_by_idx on public.nuva_settings (updated_by);
create index if not exists pricing_versions_published_by_idx on public.pricing_versions (published_by);
-- Per-country lookups used by the apps and the admin.
create index if not exists pricing_versions_country_version_idx on public.pricing_versions (country, version desc);
create index if not exists trips_country_status_idx on public.trips (country, status, requested_at desc);
create index if not exists profiles_country_role_idx on public.profiles (country, role);
