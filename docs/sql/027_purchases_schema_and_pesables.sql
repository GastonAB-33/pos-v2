-- 027_purchases_schema_and_pesables.sql
-- Actualiza la tabla purchases y purchase_items para soportar comprobantes de compra, IVA,
-- bonificados, estados de devolucion y actualizacion de productos desde compras.

-- 1. Agregar columnas faltantes en purchases
alter table public.purchases
  add column if not exists document_type text default 'FACTURA_A',
  add column if not exists document_number text,
  add column if not exists issue_date text,
  add column if not exists payment_method text default 'cash',
  add column if not exists vat_total numeric(14,2) default 0,
  add column if not exists returned_total numeric(14,2) default 0;

-- 2. Asegurar que status permita estados de devolucion
alter table public.purchases
  drop constraint if exists purchases_status_check;

alter table public.purchases
  add constraint purchases_status_check
  check (status in ('confirmed', 'cancelled', 'partial_return', 'returned'));

-- 3. Agregar columnas faltantes en purchase_items
alter table public.purchase_items
  add column if not exists vat_percent numeric(5,2) default 0,
  add column if not exists vat_amount numeric(14,2) default 0,
  add column if not exists bonified_quantity numeric(14,3) default 0,
  add column if not exists returned_quantity numeric(14,3) default 0;

-- 4. Permitir que usuarios con permisos de escritura en 'compras' puedan actualizar
--    datos de productos (stock, costo, precio) al confirmar compras.
create or replace function public.enforce_products_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_can_write('productos') or public.current_user_can_write('compras') then
    return new;
  end if;

  if public.current_user_can_write('pos') or public.current_user_can_write('stock') then
    if new.id is not distinct from old.id
      and new.tenant_id is not distinct from old.tenant_id
      and new.code is not distinct from old.code
      and new.name is not distinct from old.name
      and new.description is not distinct from old.description
      and new.category is not distinct from old.category
      and new.cost is not distinct from old.cost
      and new.price is not distinct from old.price
      and new.min_stock is not distinct from old.min_stock
      and new.unit is not distinct from old.unit
      and new.is_active is not distinct from old.is_active
      and new.created_at is not distinct from old.created_at
      and new.brand is not distinct from old.brand
      and new.supplier is not distinct from old.supplier
      and new.cost_price is not distinct from old.cost_price
      and new.stock_min is not distinct from old.stock_min
      and new.stock_max is not distinct from old.stock_max
      and new.subcategory is not distinct from old.subcategory
      and new.sale_mode is not distinct from old.sale_mode
      and new.currency_code is not distinct from old.currency_code
      and new.is_favorite is not distinct from old.is_favorite
      and new.price_without_vat is not distinct from old.price_without_vat
      and new.vat_percent is not distinct from old.vat_percent
      and new.profit_percent is not distinct from old.profit_percent
      and new.image_url is not distinct from old.image_url
    then
      return new;
    end if;
  end if;

  raise exception 'No tenes permisos para modificar datos de productos'
    using errcode = '42501';
end;
$$;
