-- POS V2 - Catálogo Maestro Global de Productos
-- Tabla pública de solo lectura compartida entre todos los comercios para agilizar el alta de productos

create table if not exists public.master_products (
  barcode text primary key,
  name text not null,
  brand text,
  category text not null,
  subcategory text,
  unit text not null default 'u',
  image_url text,
  is_verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de alto rendimiento
create index if not exists idx_master_products_barcode on public.master_products(barcode);
create index if not exists idx_master_products_category on public.master_products(category);
create index if not exists idx_master_products_name on public.master_products using gin(to_tsvector('spanish', name));

-- Habilitar RLS
alter table public.master_products enable row level security;

-- Política de lectura pública: cualquier comercio/cajero puede consultar el catálogo maestro
drop policy if exists "master_products_read_policy" on public.master_products;
create policy "master_products_read_policy" on public.master_products
  for select
  using (true);

-- Política de inserción colaborativa: usuarios autenticados pueden sugerir productos nuevos
drop policy if exists "master_products_insert_policy" on public.master_products;
create policy "master_products_insert_policy" on public.master_products
  for insert
  with check (auth.role() = 'authenticated');
