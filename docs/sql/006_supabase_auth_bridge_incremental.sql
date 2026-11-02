-- POS V2 - Migracion incremental para vincular public.users con Supabase Auth
-- Ejecutar SOLO despues de revisar el resultado de 005.
--
-- Este archivo agrega la columna auth_user_id y funciones helper.
-- No reemplaza policies existentes: primero hay que inspeccionarlas.

begin;

alter table public.users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists users_auth_user_id_key
  on public.users(auth_user_id)
  where auth_user_id is not null;

create index if not exists users_auth_user_id_idx
  on public.users(auth_user_id);

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.current_tenant_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.tenant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.current_user_can_write(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((pp.permissions -> module_name ->> 'write')::boolean, false)
  from public.users u
  join public.permission_profiles pp
    on pp.id = u.permission_profile_id
   and pp.tenant_id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active = true
    and pp.is_active = true
  limit 1
$$;

create or replace function public.current_user_can_read(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((pp.permissions -> module_name ->> 'read')::boolean, false)
      or coalesce((pp.permissions -> module_name ->> 'write')::boolean, false)
  from public.users u
  join public.permission_profiles pp
    on pp.id = u.permission_profile_id
   and pp.tenant_id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active = true
    and pp.is_active = true
  limit 1
$$;

commit;

-- Verificacion: usuarios aun no vinculados a Auth.
select
  t.trade_name,
  u.id,
  u.email,
  u.username,
  u.full_name,
  u.auth_user_id
from public.users u
join public.tenants t on t.id = u.tenant_id
where u.auth_user_id is null
order by t.trade_name, u.full_name;

