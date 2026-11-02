select
  t.id as tenant_id,
  t.trade_name,
  t.slug,
  t.is_active as tenant_active,
  u.id as app_user_id,
  u.email,
  u.username,
  u.full_name,
  u.role_code,
  u.is_active as user_active,
  u.auth_user_id,
  au.email as auth_email
from public.tenants t
left join public.users u on u.tenant_id = t.id
left join auth.users au on au.id = u.auth_user_id
where t.is_active = true
order by t.slug, u.is_active desc, u.email nulls last;
