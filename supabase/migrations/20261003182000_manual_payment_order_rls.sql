begin;

-- This project stores "pending payment", "paid", and "cancelled" as
-- en_attente, paye, and echoue respectively. The Orange Money reference uses
-- the existing transaction_reference column.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;
grant usage on schema public to authenticated;

alter table public.orders
  add column if not exists transaction_reference text not null default '';
alter table public.orders enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format(
      'drop policy if exists %I on public.orders',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "Customers read own orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Customers create own pending orders"
  on public.orders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'en_attente'
    and paid_at is null
    and transaction_reference = ''
    and public.order_amount_matches_catalog(book_id, service_id, amount)
  );

create policy "Customers add reference to unpaid orders"
  on public.orders for update to authenticated
  using (
    user_id = (select auth.uid())
    and status in ('en_attente', 'echoue')
  )
  with check (
    user_id = (select auth.uid())
    and status in ('en_attente', 'echoue')
    and paid_at is null
  );

create policy "Admins manage all orders"
  on public.orders for all to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

create or replace function public.guard_customer_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_current_user_admin()) then
    if old.user_id <> (select auth.uid())
      or old.status not in ('en_attente', 'echoue')
      or new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.book_id is distinct from old.book_id
      or new.service_id is distinct from old.service_id
      or new.payment_method is distinct from old.payment_method
      or new.status is distinct from old.status
      or new.amount is distinct from old.amount
      or new.purchased_at is distinct from old.purchased_at
      or new.paid_at is distinct from old.paid_at then
      raise exception 'Customers may only set a reference on their unpaid orders'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_customer_order_update() from public, anon, authenticated;

drop trigger if exists guard_customer_order_update on public.orders;
create trigger guard_customer_order_update
  before update on public.orders
  for each row execute function public.guard_customer_order_update();

revoke all on public.orders from anon, authenticated;
grant select, delete on public.orders to authenticated;
grant insert (user_id, book_id, service_id, payment_method, amount)
  on public.orders to authenticated;
grant update on public.orders to authenticated;
grant execute on function public.order_amount_matches_catalog(uuid, uuid, numeric)
  to authenticated;

drop index if exists public.orders_user_book_unique;
create unique index orders_user_book_unique
  on public.orders (user_id, book_id)
  where book_id is not null and status in ('en_attente', 'paye');

drop index if exists public.orders_user_service_unique;
create unique index orders_user_service_unique
  on public.orders (user_id, service_id)
  where service_id is not null and status in ('en_attente', 'paye');

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
  if not (select public.is_current_user_admin()) then
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

commit;
