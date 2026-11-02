-- 019 - Promociones por combo/grupo y codigos de barras
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.promotion_items (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  promotion_id text not null references public.promotions(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotion_barcodes (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  promotion_id text not null references public.promotions(id) on delete cascade,
  barcode text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists promotions_tenant_code_uidx
  on public.promotions (tenant_id, lower(code));

create unique index if not exists promotion_items_unique_product_uidx
  on public.promotion_items (tenant_id, promotion_id, product_id);

create unique index if not exists promotion_barcodes_tenant_barcode_uidx
  on public.promotion_barcodes (tenant_id, lower(barcode));

create index if not exists promotion_items_tenant_promotion_idx
  on public.promotion_items (tenant_id, promotion_id);

create index if not exists promotion_barcodes_tenant_promotion_idx
  on public.promotion_barcodes (tenant_id, promotion_id);

alter table public.promotion_items enable row level security;
alter table public.promotion_barcodes enable row level security;

drop policy if exists promotion_items_select_own_tenant on public.promotion_items;
drop policy if exists promotion_items_insert_own_tenant on public.promotion_items;
drop policy if exists promotion_items_update_own_tenant on public.promotion_items;
drop policy if exists promotion_items_delete_own_tenant on public.promotion_items;
drop policy if exists promotion_items_service_all on public.promotion_items;

create policy promotion_items_select_own_tenant
  on public.promotion_items for select to authenticated
  using (belongs_to_current_tenant(tenant_id));

create policy promotion_items_insert_own_tenant
  on public.promotion_items for insert to authenticated
  with check (belongs_to_current_tenant(tenant_id));

create policy promotion_items_update_own_tenant
  on public.promotion_items for update to authenticated
  using (belongs_to_current_tenant(tenant_id))
  with check (belongs_to_current_tenant(tenant_id));

create policy promotion_items_delete_own_tenant
  on public.promotion_items for delete to authenticated
  using (belongs_to_current_tenant(tenant_id));

create policy promotion_items_service_all
  on public.promotion_items for all to service_role
  using (true)
  with check (true);

drop policy if exists promotion_barcodes_select_own_tenant on public.promotion_barcodes;
drop policy if exists promotion_barcodes_insert_own_tenant on public.promotion_barcodes;
drop policy if exists promotion_barcodes_update_own_tenant on public.promotion_barcodes;
drop policy if exists promotion_barcodes_delete_own_tenant on public.promotion_barcodes;
drop policy if exists promotion_barcodes_service_all on public.promotion_barcodes;

create policy promotion_barcodes_select_own_tenant
  on public.promotion_barcodes for select to authenticated
  using (belongs_to_current_tenant(tenant_id));

create policy promotion_barcodes_insert_own_tenant
  on public.promotion_barcodes for insert to authenticated
  with check (belongs_to_current_tenant(tenant_id));

create policy promotion_barcodes_update_own_tenant
  on public.promotion_barcodes for update to authenticated
  using (belongs_to_current_tenant(tenant_id))
  with check (belongs_to_current_tenant(tenant_id));

create policy promotion_barcodes_delete_own_tenant
  on public.promotion_barcodes for delete to authenticated
  using (belongs_to_current_tenant(tenant_id));

create policy promotion_barcodes_service_all
  on public.promotion_barcodes for all to service_role
  using (true)
  with check (true);
