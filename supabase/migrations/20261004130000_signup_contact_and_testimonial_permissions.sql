begin;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  full_name text;
  first_name text;
  last_name text;
  phone text;
begin
  requested_username := nullif(new.raw_user_meta_data ->> 'username', '');
  full_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  first_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(split_part(full_name, ' ', 1), ''),
    ''
  );
  last_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(trim(regexp_replace(full_name, '^\S+\s*', '')), ''),
    ''
  );
  phone := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone_number'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'telephone'), '')
  );

  insert into public.profiles (id, username, first_name, last_name, telephone)
  values (new.id, requested_username, first_name, last_name, phone)
  on conflict do nothing;

  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, first_name, last_name, telephone)
    values (new.id, first_name, last_name, phone);
  end if;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user()
  from public, anon, authenticated;

update public.profiles as profile
set
  first_name = case
    when profile.first_name = '' then coalesce(
      nullif(user_metadata.raw_user_meta_data ->> 'first_name', ''),
      nullif(split_part(nullif(trim(user_metadata.raw_user_meta_data ->> 'full_name'), ''), ' ', 1), ''),
      ''
    )
    else profile.first_name
  end,
  last_name = case
    when profile.last_name = '' then coalesce(
      nullif(user_metadata.raw_user_meta_data ->> 'last_name', ''),
      nullif(trim(regexp_replace(
        nullif(trim(user_metadata.raw_user_meta_data ->> 'full_name'), ''),
        '^\S+\s*',
        ''
      )), ''),
      ''
    )
    else profile.last_name
  end,
  telephone = coalesce(
    profile.telephone,
    nullif(trim(user_metadata.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(user_metadata.raw_user_meta_data ->> 'phone_number'), ''),
    nullif(trim(user_metadata.raw_user_meta_data ->> 'telephone'), '')
  )
from auth.users as user_metadata
where profile.id = user_metadata.id;

grant usage on schema public to anon, authenticated;
grant insert on table public.testimonials to anon, authenticated;

drop policy if exists "Public can submit testimonials" on public.testimonials;
create policy "Public can submit testimonials"
  on public.testimonials for insert to anon, authenticated
  with check (
    length(trim(name)) between 2 and 60
    and length(trim(message)) between 10 and 800
    and rating between 1 and 5
    and approved = false
  );

commit;
