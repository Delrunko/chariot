begin;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb;
  full_name text;
  name_parts text[];
  first_name text;
  last_name text;
  phone text;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name := btrim(coalesce(metadata ->> 'full_name', ''));
  name_parts := regexp_split_to_array(full_name, '[[:space:]]+');

  first_name := coalesce(
    nullif(btrim(metadata ->> 'first_name'), ''),
    nullif(name_parts[1], ''),
    ''
  );
  last_name := coalesce(
    nullif(btrim(metadata ->> 'last_name'), ''),
    nullif(array_to_string(name_parts[2:array_length(name_parts, 1)], ' '), ''),
    ''
  );
  phone := coalesce(
    nullif(btrim(metadata ->> 'phone'), ''),
    nullif(btrim(metadata ->> 'phone_number'), ''),
    nullif(btrim(metadata ->> 'telephone'), '')
  );

  insert into public.profiles as existing_profile (id, first_name, last_name, telephone)
  values (new.id, first_name, last_name, phone)
  on conflict (id) do update
    set first_name = case
          when existing_profile.first_name = '' then excluded.first_name
          else existing_profile.first_name
        end,
        last_name = case
          when existing_profile.last_name = '' then excluded.last_name
          else existing_profile.last_name
        end,
        telephone = coalesce(existing_profile.telephone, excluded.telephone);

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

commit;
