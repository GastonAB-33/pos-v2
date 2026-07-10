-- POS V2 - Diagnostico y correccion guiada de tenants/usuarios incompletos.
--
-- Uso:
-- 1) Ejecutar primero las consultas de diagnostico.
-- 2) Si un tenant/usuario es demo o basura, desactivarlo.
-- 3) Si es real, crear/vincular Supabase Auth y completar perfiles/settings.
--
-- Este archivo NO ejecuta correcciones destructivas por defecto.

-- A. Ver tenants activos incompletos.
select
  t.id,
  t.trade_name,
  t.slug,
  t.cuit,
  t.is_active,
  count(distinct pp.id) filter (where pp.is_active = true) as active_profiles,
  count(distinct u.id) filter (where u.is_active = true) as active_users,
  count(distinct pm.id) filter (where pm.is_active = true) as active_payment_methods,
  count(distinct ts.id) as settings_rows
from public.tenants t
left join public.permission_profiles pp on pp.tenant_id = t.id
left join public.users u on u.tenant_id = t.id
left join public.payment_methods pm on pm.tenant_id = t.id
left join public.tenant_settings ts on ts.tenant_id = t.id
where t.is_active = true
group by t.id, t.trade_name, t.slug, t.cuit, t.is_active
having count(distinct pp.id) filter (where pp.is_active = true) = 0
    or count(distinct u.id) filter (where u.is_active = true) = 0
    or count(distinct pm.id) filter (where pm.is_active = true) = 0
    or count(distinct ts.id) = 0
order by t.trade_name;

-- B. Ver usuarios activos sin login real de Supabase Auth.
select
  t.trade_name,
  t.slug,
  t.is_active as tenant_is_active,
  u.id,
  u.email,
  u.username,
  u.full_name,
  u.role_code,
  u.is_active,
  u.auth_user_id
from public.users u
join public.tenants t on t.id = u.tenant_id
where u.is_active = true
  and u.auth_user_id is null
order by t.trade_name, u.email nulls last, u.username nulls last;

-- C. Si un tenant activo incompleto es demo/basura, desactivarlo.
-- Reemplazar el id y ejecutar SOLO si confirmaste que no es un comercio real.
/*
update public.tenants
set is_active = false,
    updated_at = now()
where id = 'REEMPLAZAR_TENANT_ID';
*/

-- D. Si usuarios activos sin auth_user_id son demo/basura, desactivarlos.
-- Reemplazar emails y ejecutar SOLO si no deben poder ingresar al sistema.
/*
update public.users
set is_active = false,
    updated_at = now()
where lower(email) in (
  'admin@demo.local',
  'angiepaulacaterinamolina.7@gmail.com'
);
*/

-- E. Si el usuario es real, NO desactivarlo:
-- 1) Crear usuario en Supabase Auth.
-- 2) Copiar su User UID.
-- 3) Vincularlo:
/*
update public.users
set auth_user_id = 'REEMPLAZAR_AUTH_USER_UID'::uuid,
    updated_at = now()
where lower(email) = 'REEMPLAZAR_EMAIL';
*/

-- F. Validar de nuevo al final.
-- Ejecutar: docs/sql/022_beta_readiness_preflight.sql
