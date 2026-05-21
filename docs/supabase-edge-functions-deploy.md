# Despliegue de Edge Functions administrativas

Estas funciones son necesarias para que el modulo **Usuarios** pueda crear, editar y eliminar usuarios reales de Supabase Auth desde el sistema.

Proyecto Supabase:

```powershell
qfquvyxyodmnyqlchpbf
```

## 1. Login de Supabase CLI

Ejecutar en PowerShell desde la raiz del proyecto:

```powershell
npx supabase login
```

Supabase va a pedir un access token. Se obtiene desde el dashboard de Supabase:

```text
Account > Access Tokens
```

## 2. Desplegar funciones

Ejecutar:

```powershell
npx supabase functions deploy admin-create-user --project-ref qfquvyxyodmnyqlchpbf --no-verify-jwt
npx supabase functions deploy admin-update-user --project-ref qfquvyxyodmnyqlchpbf --no-verify-jwt
npx supabase functions deploy admin-delete-user --project-ref qfquvyxyodmnyqlchpbf --no-verify-jwt
```

Usamos `--no-verify-jwt` para permitir el preflight CORS del navegador. La seguridad real sigue dentro de la funcion: solo acepta usuarios logueados con permiso de escritura en `usuarios`.

## 3. Verificar que existen

```powershell
Invoke-WebRequest -Uri "https://qfquvyxyodmnyqlchpbf.supabase.co/functions/v1/admin-create-user" -Method Options
Invoke-WebRequest -Uri "https://qfquvyxyodmnyqlchpbf.supabase.co/functions/v1/admin-update-user" -Method Options
Invoke-WebRequest -Uri "https://qfquvyxyodmnyqlchpbf.supabase.co/functions/v1/admin-delete-user" -Method Options
```

Esperado: respuesta HTTP 200 o 204, no `NOT_FOUND`.

## 4. Probar desde el sistema

1. Entrar a `Usuarios`.
2. Crear una usuaria de prueba con email y contrasena.
3. Confirmar que aparece en `public.users`.
4. Confirmar que aparece en Supabase Auth.
5. Cerrar sesion e iniciar con esa usuaria para validar tenant/permisos.
6. Eliminar una usuaria de prueba y confirmar que ya no pueda iniciar sesion.
