-- Security hardening (Supabase advisors, 2026-10-06).
--
-- 1. Signed-out visitors (anon) only ever read the public settings and tariffs
--    (nuva_settings, pricing_versions / current_pricing). Every other table is used
--    with a session, so anon loses its (default) privileges there. RLS already
--    denied those rows; this removes the surface altogether.
revoke all on table
  public.bootstrap_admins,
  public.driver_presence,
  public.driver_topups,
  public.profiles,
  public.promos,
  public.saved_places,
  public.support_tickets,
  public.trip_messages,
  public.trip_pins,
  public.trips,
  public.withdrawals,
  public.zones
from anon;
revoke insert, update, delete, truncate, references, trigger on table public.pricing_versions, public.current_pricing, public.nuva_settings from anon;

-- 2. Trigger functions are never called directly: nobody needs EXECUTE on them
--    (a trigger fires regardless of the caller's privileges).
revoke execute on function
  public.credit_promo_on_complete(),
  public.ticket_defaults(),
  public.bank_accounts_touch(),
  public.guard_role_change()
from public, anon, authenticated;

-- 3. Role helpers used by RLS policies: signed-in users only. anon can no longer
--    reach any table whose policies call them (step 1).
revoke execute on function public.is_admin(), public.is_driver(), public.my_role() from public, anon;
grant execute on function public.is_admin(), public.is_driver(), public.my_role() to authenticated, service_role;
