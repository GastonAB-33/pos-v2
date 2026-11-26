-- ==============================================================================
-- 042_allow_own_permission_profile_select.sql
-- Permite que todo usuario autenticado pueda leer SU PROPIO perfil de permisos
-- asignado en public.users al iniciar sesion, sin requerir permiso de 'usuarios'.
--
-- Corrige:
-- 1. Error "No se encontro el perfil de permisos asignado" para roles no-admin (ej. Cajera).
-- 2. Fallback a "auto-admin" cuando un owner/admin se cambia a un perfil restringido.
-- ==============================================================================

drop policy if exists permission_profiles_select_own_tenant on public.permission_profiles;

create policy permission_profiles_select_own_tenant
on public.permission_profiles
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('usuarios')
    or exists (
      select 1
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = permission_profiles.tenant_id
        and u.permission_profile_id = permission_profiles.id
    )
  )
);
