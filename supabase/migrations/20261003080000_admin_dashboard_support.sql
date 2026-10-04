-- Admin dashboard support: public media, self-service profile edits, and
-- controlled administrative order status changes.

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update, delete on public.quotes, public.quote_images to authenticated;

create or replace function public.admin_update_order(
  requested_order_id uuid,
  requested_status text,
  requested_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if requested_status not in ('paye', 'echoue') then
    raise exception 'Unsupported order status' using errcode = '22023';
  end if;

  update public.orders
  set status = requested_status,
      paid_at = case when requested_status = 'paye' then now() else null end,
      transaction_reference = coalesce(requested_reference, transaction_reference)
  where id = requested_order_id
    and status = 'en_attente';

  return found;
end;
$$;
revoke all on function public.admin_update_order(uuid, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('media', 'media', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read covers" on storage.objects;
create policy "Public can read covers"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'covers');
drop policy if exists "Admins manage covers" on storage.objects;
create policy "Admins manage covers"
  on storage.objects for all to authenticated
  using (bucket_id = 'covers' and (select public.is_admin()))
  with check (bucket_id = 'covers' and (select public.is_admin()));

drop policy if exists "Paid service buyers can read service videos" on storage.objects;
create policy "Paid service buyers can read service videos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1
      from public.services s
      join public.orders o on o.service_id = s.id
      where s.video_path = name
        and o.user_id = (select auth.uid())
        and o.status = 'paye'
    )
  );
drop policy if exists "Admins manage media" on storage.objects;
create policy "Admins manage media"
  on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
