-- POS V2 - Vincular usuarios internos existentes con Supabase Auth por email
-- Ejecutar despues de 006_supabase_auth_bridge_incremental.sql.
--
-- Este archivo:
-- 1) Muestra usuarios internos sin auth_user_id.
-- 2) Muestra si existe un auth.users con el mismo email.
-- 3) Actualiza auth_user_id solo cuando hay match exacto por email.
-- 4) Vuelve a mostrar pendientes.
--
-- No crea usuarios Auth. Si un email queda pendiente, crearlo primero desde
-- Supabase Dashboard > Authentication > Users y volver a ejecutar este script.

begin;

-- Preview antes de vincular.
create temp table if not exists tmp_pos_auth_link_preview (
  trade_name text,
  app_user_id text,
  app_email text,
  username text,
  full_name text,
  current_auth_user_id uuid,
  matched_auth_user_id uuid,
  matched_auth_email text,
  action text
) on commit drop;

truncate table tmp_pos_auth_link_preview;

insert into tmp_pos_auth_link_preview
select
  t.trade_name,
  u.id as app_user_id,
  u.email as app_email,
  u.username,
  u.full_name,
  u.auth_user_id as current_auth_user_id,
  au.id as matched_auth_user_id,
  au.email as matched_auth_email,
  case
    when u.auth_user_id is not null then 'already_linked'
    when u.email is null or trim(u.email) = '' then 'missing_email'
    when au.id is null then 'auth_user_not_found'
    else 'will_link'
  end as action
from public.users u
join public.tenants t on t.id = u.tenant_id
left join auth.users au
  on lower(au.email) = lower(u.email)
where u.auth_user_id is null
order by t.trade_name, u.full_name;

select *
from tmp_pos_auth_link_preview
order by trade_name, full_name;

-- Vinculacion por email exacto normalizado.
update public.users u
set
  auth_user_id = au.id,
  updated_at = now()
from auth.users au
where u.auth_user_id is null
  and u.email is not null
  and lower(au.email) = lower(u.email);

commit;

-- Resultado final.
select
  t.trade_name,
  u.id as app_user_id,
  u.email as app_email,
  u.username,
  u.full_name,
  u.auth_user_id,
  au.email as auth_email,
  case
    when u.auth_user_id is null then 'pending_auth_user'
    when au.id is null then 'broken_auth_reference'
    else 'linked'
  end as status
from public.users u
join public.tenants t on t.id = u.tenant_id
left join auth.users au on au.id = u.auth_user_id
order by t.trade_name, u.full_name;

