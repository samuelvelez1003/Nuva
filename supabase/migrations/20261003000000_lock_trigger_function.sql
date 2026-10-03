-- Trigger-only function: never callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- bootstrap_admins is intentionally invisible to clients (RLS on, no policies).
comment on table public.bootstrap_admins is 'Founding admin emails. Intentionally no RLS policies: not readable by clients.';
