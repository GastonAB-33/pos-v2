# Setup de Auth real para tenants POS

Fecha: 2026-05-09

Este documento describe el flujo para pasar de login demo/mock a login real con Supabase Auth.

## Modelo implementado

- `auth.users` guarda email y contrasena.
- `public.users.auth_user_id` vincula el usuario interno del POS con Supabase Auth.
- `public.users.tenant_id` define a que comercio pertenece.
- `public.users.permission_profile_id` define permisos de modulo.
- El login en modo `VITE_DATA_PROVIDER=supabase` usa `supabase.auth.signInWithPassword`.
- El alta/edicion de usuarios desde el modulo Usuarios llama Edge Functions:
  - `admin-create-user`
  - `admin-update-user`
  - `admin-delete-user`

## Archivos agregados

- `src/services/auth.service.ts`: login/logout con Supabase Auth.
- `src/services/auth-admin.service.ts`: cliente frontend para Edge Functions administrativas.
- `supabase/functions/admin-create-user/index.ts`: crea usuario en Auth y fila en `public.users`.
- `supabase/functions/admin-update-user/index.ts`: actualiza email/datos/perfil y opcionalmente contrasena.
- `supabase/functions/admin-delete-user/index.ts`: elimina el usuario de Auth y su fila en `public.users`.
- `supabase/functions/_shared/admin.ts`: cliente service role y validacion de permiso `usuarios.write`.
- `supabase/functions/_shared/cors.ts`: respuestas CORS.

## Orden recomendado para probar

1. Ejecutar en Supabase SQL Editor:
   - `docs/sql/001_supabase_base_schema.sql`
   - `docs/sql/002_supabase_rls_policies.sql`

2. Crear manualmente en Supabase Auth el usuario administrador inicial del comercio.

3. Copiar el UUID del usuario Auth creado.

4. Editar `docs/sql/003_bootstrap_tenant_admin.sql`:
   - `v_auth_user_id`
   - `v_admin_email`
   - `v_admin_username`
   - `v_admin_full_name`
   - `v_tenant_legal_name`
   - `v_tenant_trade_name`
   - `v_tenant_cuit`

5. Ejecutar `docs/sql/003_bootstrap_tenant_admin.sql`.

6. Ejecutar `docs/sql/004_supabase_validation_checks.sql`.

7. Desplegar Edge Functions:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
supabase functions deploy admin-delete-user
```

8. Configurar variables de entorno del frontend:

```env
VITE_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

9. Iniciar la app y entrar con el email/contrasena del usuario Auth.

## Validacion funcional

Despues de iniciar sesion como admin del comercio:

1. Ir a `Usuarios`.
2. Crear una empleada con email, usuario, perfil y contrasena.
3. Cerrar sesion.
4. Entrar con el email/contrasena de la empleada.
5. Validar que solo ve el comercio asignado.
6. Validar que sus permisos coinciden con el perfil asignado.

## Pendiente importante

El login en Supabase usa email/contrasena. El campo visual todavia se llama "Email" en modo Supabase, y el tenant se deduce automaticamente desde `public.users.auth_user_id`.

Para permitir login por username ademas de email haria falta un endpoint previo seguro que resuelva username -> email sin filtrar datos entre tenants, o un identificador de comercio + username. Por ahora se prioriza el flujo mas seguro y simple.
