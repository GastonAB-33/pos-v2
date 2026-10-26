-- 030_add_tax_id_to_suppliers.sql
-- Agrega la columna tax_id (CUIT / DNI / Identificación tributaria) a la tabla suppliers

alter table if exists public.suppliers
  add column if not exists tax_id text;

-- Índice para búsqueda rápida por CUIT / Tax ID por tenant
create index if not exists suppliers_tenant_tax_id_idx
  on public.suppliers(tenant_id, tax_id);

-- Opcional: Extraer CUIT que haya quedado registrado temporalmente en observations
update public.suppliers
set
  tax_id = substring(observations from 'CUIT:\s*([0-9\-]+)'),
  observations = trim(regexp_replace(observations, '(\|\s*)?CUIT:\s*[0-9\-]+', ''))
where
  tax_id is null
  and observations ~ 'CUIT:\s*[0-9\-]+';
