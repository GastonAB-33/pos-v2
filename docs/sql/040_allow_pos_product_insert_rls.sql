-- 040_allow_pos_product_insert_rls.sql
-- Habilita el alta de productos y asignación de códigos de barra desde el POS (y Compras/Stock)
-- para usuarios con permisos operativos (Cajeros, Vendedores, Empleados) que no poseen
-- permiso administrativo completo sobre el módulo 'productos'.

begin;

-- 1. Asegurar que la columna 'code' sea opcional para no fallar por NOT NULL
alter table public.products alter column code drop not null;

-- 2. Permitir inserción de productos desde 'productos', 'pos', 'stock' o 'compras'
drop policy if exists products_insert_own_tenant on public.products;
create policy products_insert_own_tenant
on public.products
for insert
to authenticated
with check (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
    or public.can_write_module('compras')
  )
);

-- 3. Permitir inserción de códigos de barra desde 'productos', 'pos', 'stock' o 'compras'
drop policy if exists product_barcodes_insert_own_tenant on public.product_barcodes;
create policy product_barcodes_insert_own_tenant
on public.product_barcodes
for insert
to authenticated
with check (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
    or public.can_write_module('compras')
  )
);

-- 4. Permitir actualización de códigos de barra desde 'productos', 'pos', 'stock' o 'compras'
drop policy if exists product_barcodes_update_own_tenant on public.product_barcodes;
create policy product_barcodes_update_own_tenant
on public.product_barcodes
for update
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
    or public.can_write_module('compras')
  )
)
with check (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
    or public.can_write_module('compras')
  )
);

-- 5. Permitir eliminación de códigos de barra huérfanos/obsoletos desde 'productos', 'pos', 'stock' o 'compras'
drop policy if exists product_barcodes_delete_own_tenant on public.product_barcodes;
create policy product_barcodes_delete_own_tenant
on public.product_barcodes
for delete
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
    or public.can_write_module('compras')
  )
);

commit;
