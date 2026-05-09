-- Corrige tenants faltantes que bloquean barcode/pagos/comprobantes por FK.
-- Ejecutar en Supabase SQL Editor.

begin;

with used_tenants as (
  select distinct tenant_id from products where tenant_id is not null
  union
  select distinct tenant_id from product_barcodes where tenant_id is not null
  union
  select distinct tenant_id from sales where tenant_id is not null
  union
  select distinct tenant_id from sale_items where tenant_id is not null
  union
  select distinct tenant_id from sale_payments where tenant_id is not null
  union
  select distinct tenant_id from receipts where tenant_id is not null
  union
  select distinct tenant_id from stock_movements where tenant_id is not null
  union
  select distinct tenant_id from customers where tenant_id is not null
  union
  select distinct tenant_id from payment_methods where tenant_id is not null
),
missing as (
  select u.tenant_id
  from used_tenants u
  left join tenants t on t.id = u.tenant_id
  where t.id is null
)
insert into tenants (
  id,
  legal_name,
  trade_name,
  cuit,
  is_active,
  created_at,
  updated_at
)
select
  m.tenant_id,
  'Tenant ' || m.tenant_id as legal_name,
  'Tenant ' || left(m.tenant_id, 8) as trade_name,
  'AUTO-' || left(md5(m.tenant_id), 20) as cuit,
  true,
  now(),
  now()
from missing m
on conflict (id) do nothing;

commit;

-- Verificacion rapida (debe devolver 0 filas):
with used_tenants as (
  select distinct tenant_id from products where tenant_id is not null
  union
  select distinct tenant_id from product_barcodes where tenant_id is not null
  union
  select distinct tenant_id from sales where tenant_id is not null
  union
  select distinct tenant_id from sale_items where tenant_id is not null
  union
  select distinct tenant_id from sale_payments where tenant_id is not null
  union
  select distinct tenant_id from receipts where tenant_id is not null
  union
  select distinct tenant_id from stock_movements where tenant_id is not null
)
select u.tenant_id
from used_tenants u
left join tenants t on t.id = u.tenant_id
where t.id is null
order by u.tenant_id;
