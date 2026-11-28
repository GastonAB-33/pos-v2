-- ==============================================================================
-- 041_production_recipes_schema.sql
-- Modulo Inventario • Producción y Recetas (Elaboración de Alimentos / Insumos)
-- Permite definir recetas por tanda, calcular costo/margen por unidad y
-- registrar órdenes de producción por tanda o por unidad descontando insumos
-- y sumando el producto terminado al stock.
-- ==============================================================================

begin;

-- ============================================================================
-- 1. TABLA: public.recipes (Recetas / Fichas Técnicas)
-- ============================================================================
create table if not exists public.recipes (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  batch_yield numeric(14,3) not null default 1 check (batch_yield > 0),
  yield_unit text not null default 'unit' check (yield_unit in ('unit', 'kg')),
  indirect_cost numeric(14,2) not null default 0 check (indirect_cost >= 0),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_tenant_active_idx
  on public.recipes(tenant_id, is_active);

create index if not exists recipes_tenant_product_idx
  on public.recipes(tenant_id, product_id);

-- ============================================================================
-- 2. TABLA: public.recipe_items (Insumos por Tanda de Receta)
-- ============================================================================
create table if not exists public.recipe_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  ingredient_product_id text not null references public.products(id) on delete restrict,
  quantity_per_batch numeric(14,4) not null check (quantity_per_batch > 0),
  input_unit text not null default 'unit' check (input_unit in ('unit', 'kg', 'g')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_items_tenant_recipe_idx
  on public.recipe_items(tenant_id, recipe_id);

-- ============================================================================
-- 3. TABLA: public.production_orders (Órdenes / Lotes de Producción)
-- ============================================================================
create table if not exists public.production_orders (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  input_mode text not null default 'units' check (input_mode in ('units', 'batches')),
  batches_count numeric(14,4) not null check (batches_count > 0),
  units_produced numeric(14,3) not null check (units_produced > 0),
  waste_units numeric(14,3) not null default 0 check (waste_units >= 0),
  total_cost numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  estimated_sale_total numeric(14,2) not null default 0,
  estimated_profit numeric(14,2) not null default 0,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  ingredients_snapshot jsonb not null default '[]'::jsonb,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_orders_tenant_created_idx
  on public.production_orders(tenant_id, created_at desc);

create index if not exists production_orders_tenant_recipe_idx
  on public.production_orders(tenant_id, recipe_id);

-- ============================================================================
-- 4. RLS & PERMISOS MULTI-TENANT
-- ============================================================================
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_orders enable row level security;

-- recipes
drop policy if exists recipes_select_own_tenant on public.recipes;
create policy recipes_select_own_tenant on public.recipes
  for select to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipes_insert_own_tenant on public.recipes;
create policy recipes_insert_own_tenant on public.recipes
  for insert to authenticated with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipes_update_own_tenant on public.recipes;
create policy recipes_update_own_tenant on public.recipes
  for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipes_delete_own_tenant on public.recipes;
create policy recipes_delete_own_tenant on public.recipes
  for delete to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipes_service_all on public.recipes;
create policy recipes_service_all on public.recipes
  for all to service_role using (true) with check (true);

-- recipe_items
drop policy if exists recipe_items_select_own_tenant on public.recipe_items;
create policy recipe_items_select_own_tenant on public.recipe_items
  for select to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipe_items_insert_own_tenant on public.recipe_items;
create policy recipe_items_insert_own_tenant on public.recipe_items
  for insert to authenticated with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipe_items_update_own_tenant on public.recipe_items;
create policy recipe_items_update_own_tenant on public.recipe_items
  for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipe_items_delete_own_tenant on public.recipe_items;
create policy recipe_items_delete_own_tenant on public.recipe_items
  for delete to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists recipe_items_service_all on public.recipe_items;
create policy recipe_items_service_all on public.recipe_items
  for all to service_role using (true) with check (true);

-- production_orders
drop policy if exists production_orders_select_own_tenant on public.production_orders;
create policy production_orders_select_own_tenant on public.production_orders
  for select to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists production_orders_insert_own_tenant on public.production_orders;
create policy production_orders_insert_own_tenant on public.production_orders
  for insert to authenticated with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists production_orders_update_own_tenant on public.production_orders;
create policy production_orders_update_own_tenant on public.production_orders
  for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists production_orders_delete_own_tenant on public.production_orders;
create policy production_orders_delete_own_tenant on public.production_orders
  for delete to authenticated using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists production_orders_service_all on public.production_orders;
create policy production_orders_service_all on public.production_orders
  for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_items to authenticated;
grant select, insert, update, delete on public.production_orders to authenticated;

grant all on public.recipes to service_role;
grant all on public.recipe_items to service_role;
grant all on public.production_orders to service_role;

-- ============================================================================
-- 5. HABILITAR PERMISO 'produccion' EN PERFILES EXISTENTES CON ACCESO A STOCK
-- ============================================================================
update public.permission_profiles
set permissions = jsonb_set(
  permissions,
  '{produccion}',
  coalesce(permissions->'stock', '{"read": true, "write": true}'::jsonb),
  true
)
where not (permissions ? 'produccion');

commit;
