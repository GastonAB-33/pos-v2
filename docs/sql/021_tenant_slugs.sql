-- POS V2 - Tenant slugs para acceso por URL.
-- Objetivo:
-- - Permitir enlaces tipo https://puntodeventa.com/la25
-- - Evitar que el usuario tenga que escribir el comercio en login
-- - Mantener tenants protegidos por RLS

create or replace function public.pos_normalize_tenant_slug(input_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(coalesce(input_value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.tenants
  add column if not exists slug text;

update public.tenants
set slug = public.pos_normalize_tenant_slug(trade_name)
where slug is null or trim(slug) = '';

alter table public.tenants
  alter column slug set not null;

create unique index if not exists tenants_slug_unique_idx
  on public.tenants (slug);

create or replace function public.pos_public_tenant_by_slug(tenant_slug text)
returns table (
  id text,
  trade_name text,
  slug text,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.trade_name, t.slug, t.is_active
  from public.tenants t
  where t.slug = public.pos_normalize_tenant_slug(tenant_slug)
    and t.is_active = true
  limit 1;
$$;

revoke all on function public.pos_public_tenant_by_slug(text) from public;
grant execute on function public.pos_public_tenant_by_slug(text) to anon;
grant execute on function public.pos_public_tenant_by_slug(text) to authenticated;
