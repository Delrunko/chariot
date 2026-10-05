begin;

grant insert (id, first_name, last_name, telephone)
  on public.profiles to authenticated;

drop policy if exists "Users insert their own profile" on public.profiles;
create policy "Users insert their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

commit;
