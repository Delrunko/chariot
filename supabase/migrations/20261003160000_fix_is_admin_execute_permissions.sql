-- RLS policies can evaluate is_admin() for both anonymous and authenticated
-- requests. The function only returns whether auth.uid() has the admin role;
-- granting EXECUTE does not grant access to protected table rows.
grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
