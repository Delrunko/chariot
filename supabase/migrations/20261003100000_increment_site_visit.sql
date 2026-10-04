-- Keep the existing singleton counter and expose only an atomic increment
-- operation to public clients.

insert into public.visit_counter (singleton, count)
values (true, 0)
on conflict (singleton) do nothing;

create or replace function public.increment_site_visit()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  updated_count bigint;
begin
  update public.visit_counter
  set count = count + 1
  where singleton = true
  returning count into updated_count;

  if updated_count is null then
    raise exception 'The site visit counter row is missing';
  end if;

  return updated_count;
end;
$$;

revoke all on function public.increment_site_visit() from public;
grant execute on function public.increment_site_visit() to anon, authenticated;

grant select on public.visit_counter to anon, authenticated;
revoke insert, update, delete on public.visit_counter from anon, authenticated;
