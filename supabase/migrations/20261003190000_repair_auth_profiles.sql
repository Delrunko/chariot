begin;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := nullif(new.raw_user_meta_data ->> 'username', '');

  insert into public.profiles (id, username, first_name, last_name, telephone)
  values (
    new.id,
    requested_username,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', '')
  )
  on conflict do nothing;

  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, first_name, last_name, telephone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'first_name', ''),
      coalesce(new.raw_user_meta_data ->> 'last_name', ''),
      nullif(new.raw_user_meta_data ->> 'telephone', '')
    );
  end if;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Restore profiles for existing auth accounts created before the trigger was
-- installed or while it was failing. Existing profiles and admin roles remain untouched.
insert into public.profiles (id, first_name, last_name, telephone)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'first_name', ''),
  coalesce(u.raw_user_meta_data ->> 'last_name', ''),
  nullif(u.raw_user_meta_data ->> 'telephone', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

commit;
