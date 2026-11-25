-- ==============================================================================
-- 041_mi_tienda_ecommerce_schema_and_rpc.sql
-- Módulo "Mi Tienda": E-commerce y Catálogo Digital Compartible para Comercios
-- ==============================================================================

-- 1. CAMPOS DE PUBLICACIÓN EN PRODUCTOS
-- Permite al comerciante elegir qué productos se publican en su tienda web y cuáles destacar.
alter table public.products
  add column if not exists is_published_web boolean not null default true,
  add column if not exists is_featured_web boolean not null default false;

-- 2. SECCIÓN DE CONFIGURACIÓN EN TENANT_SETTINGS
-- Almacena nombre, logo, banner, WhatsApp, políticas de entrega y política de señas
alter table public.tenant_settings
  add column if not exists tienda jsonb not null default '{}'::jsonb;

-- 3. TABLA DE PEDIDOS WEB (STORE_ORDERS)
create table if not exists public.store_orders (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  order_number serial,
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  delivery_mode text not null check (delivery_mode in ('takeaway', 'delivery')),
  delivery_cost numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null,
  total numeric(14,2) not null,
  down_payment_required numeric(14,2) not null default 0,
  remaining_balance numeric(14,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'partial_paid', 'paid')),
  order_status text not null default 'new' check (order_status in ('new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_tenant_status_idx
  on public.store_orders (tenant_id, order_status, created_at desc);

-- RLS para store_orders
alter table public.store_orders enable row level security;

drop policy if exists "store_orders_tenant_isolation" on public.store_orders;
create policy "store_orders_tenant_isolation" on public.store_orders
  for all
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

-- 4. FUNCIÓN RPC PÚBLICA PARA OBTENER EL CATÁLOGO DE LA TIENDA
-- Diseñada para máxima velocidad, una sola petición, y aislamiento estricto:
-- NUNCA expone precios de costo, márgenes de ganancia ni datos de otros comercios.
create or replace function public.get_storefront_data(p_tenant_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant record;
  v_settings jsonb;
  v_negocio jsonb;
  v_tienda jsonb;
  v_products jsonb;
  v_categories jsonb;
begin
  -- 1. Buscar comercio por slug normalizado (permite variaciones con o sin guión: ej 'la25' o 'la-25')
  select t.id, t.trade_name, t.legal_name, t.slug, t.logo_url, t.is_active
  into v_tenant
  from public.tenants t
  where (
    t.slug = public.pos_normalize_tenant_slug(p_tenant_slug)
    or replace(t.slug, '-', '') = replace(public.pos_normalize_tenant_slug(p_tenant_slug), '-', '')
    or public.pos_normalize_tenant_slug(t.trade_name) = public.pos_normalize_tenant_slug(p_tenant_slug)
    or replace(public.pos_normalize_tenant_slug(t.trade_name), '-', '') = replace(public.pos_normalize_tenant_slug(p_tenant_slug), '-', '')
  )
    and t.is_active = true
  limit 1;

  if v_tenant.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Comercio no encontrado o inactivo'
    );
  end if;

  -- 2. Leer configuraciones del comercio
  select
    coalesce(ts.tienda, '{}'::jsonb),
    coalesce(ts.negocio, '{}'::jsonb)
  into v_tienda, v_negocio
  from public.tenant_settings ts
  where ts.tenant_id = v_tenant.id
  limit 1;

  -- Si no existe fila de settings, defaults seguros
  v_tienda := coalesce(v_tienda, '{}'::jsonb);
  v_negocio := coalesce(v_negocio, '{}'::jsonb);

  -- 3. Obtener productos publicados y activos
  -- Excluye eliminados lógicamente y campos sensibles (cost_price, profit_percent)
  select coalesce(jsonb_agg(prod_row), '[]'::jsonb)
  into v_products
  from (
    select
      p.id,
      p.name,
      p.code,
      p.category,
      coalesce(p.subcategory, '') as subcategory,
      p.brand,
      p.price,
      p.sale_mode,
      p.image_url,
      p.stock_current,
      p.is_featured_web,
      pb.barcode
    from public.products p
    left join lateral (
      select barcode
      from public.product_barcodes
      where product_id = p.id
      order by is_primary desc
      limit 1
    ) pb on true
    where p.tenant_id = v_tenant.id
      and p.is_active = true
      and p.is_published_web = true
      and (p.description is null or p.description not like '%[DELETED_AT:%')
    order by p.is_featured_web desc, p.category asc, p.name asc
  ) prod_row;

  -- 4. Obtener lista de categorías únicas de los productos publicados
  select coalesce(jsonb_agg(cat_name), '[]'::jsonb)
  into v_categories
  from (
    select distinct p.category as cat_name
    from public.products p
    where p.tenant_id = v_tenant.id
      and p.is_active = true
      and p.is_published_web = true
      and (p.description is null or p.description not like '%[DELETED_AT:%')
      and p.category is not null and trim(p.category) != ''
    order by p.category asc
  ) cats;

  -- 5. Armar respuesta consolidada
  return jsonb_build_object(
    'success', true,
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'trade_name', v_tenant.trade_name,
      'slug', v_tenant.slug,
      'logo_url', coalesce(v_tienda->>'logo_url', v_negocio->>'logo_url', v_tenant.logo_url)
    ),
    'settings', v_tienda,
    'business', jsonb_build_object(
      'phone', coalesce(v_negocio->>'phone', ''),
      'address', coalesce(v_negocio->>'address', ''),
      'trade_name', coalesce(v_negocio->>'trade_name', v_tenant.trade_name)
    ),
    'categories', v_categories,
    'products', v_products
  );
end;
$$;

-- 5. FUNCIÓN RPC PÚBLICA PARA ENVIAR PEDIDO DESDE LA TIENDA
create or replace function public.submit_store_order(
  p_tenant_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_mode text,
  p_delivery_cost numeric,
  p_subtotal numeric,
  p_total numeric,
  p_down_payment_required numeric,
  p_remaining_balance numeric,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id text;
  v_order_id text;
  v_order_number int;
begin
  select t.id
  into v_tenant_id
  from public.tenants t
  where (
    t.slug = public.pos_normalize_tenant_slug(p_tenant_slug)
    or replace(t.slug, '-', '') = replace(public.pos_normalize_tenant_slug(p_tenant_slug), '-', '')
    or public.pos_normalize_tenant_slug(t.trade_name) = public.pos_normalize_tenant_slug(p_tenant_slug)
    or replace(public.pos_normalize_tenant_slug(t.trade_name), '-', '') = replace(public.pos_normalize_tenant_slug(p_tenant_slug), '-', '')
  )
    and t.is_active = true
  limit 1;

  if v_tenant_id is null then
    return jsonb_build_object('success', false, 'error', 'Comercio no encontrado');
  end if;

  insert into public.store_orders (
    tenant_id,
    customer_name,
    customer_phone,
    customer_address,
    delivery_mode,
    delivery_cost,
    subtotal,
    total,
    down_payment_required,
    remaining_balance,
    items,
    notes
  ) values (
    v_tenant_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(p_customer_address), ''),
    p_delivery_mode,
    coalesce(p_delivery_cost, 0),
    p_subtotal,
    p_total,
    coalesce(p_down_payment_required, 0),
    coalesce(p_remaining_balance, p_total),
    coalesce(p_items, '[]'::jsonb),
    nullif(trim(p_notes), '')
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;

-- 6. PERMISOS DE EJECUCIÓN (Acceso público para compradores sin login)
revoke all on function public.get_storefront_data(text) from public;
grant execute on function public.get_storefront_data(text) to anon;
grant execute on function public.get_storefront_data(text) to authenticated;

revoke all on function public.submit_store_order(text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, text) from public;
grant execute on function public.submit_store_order(text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, text) to anon;
grant execute on function public.submit_store_order(text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, text) to authenticated;
