-- Payments are manual Orange Money deposits to a phone number. There is no
-- merchant code or generated USSD code in this flow.

alter table public.payment_config
  drop column if exists merchant_code;

alter table public.payment_config
  alter column merchant_number set default '656877046';

update public.payment_config
set merchant_number = '656877046'
where id = (select min(id) from public.payment_config);

insert into public.payment_config (merchant_number)
select '656877046'
where not exists (select 1 from public.payment_config);
