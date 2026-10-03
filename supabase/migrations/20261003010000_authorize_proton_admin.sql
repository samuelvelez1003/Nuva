insert into public.bootstrap_admins (email) values ('adminnuva@proton.me') on conflict do nothing;
-- If the account already exists, promote it now.
update public.profiles set role = 'admin' where lower(email) = 'adminnuva@proton.me';
