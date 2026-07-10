# Pendientes de Plataforma Para Salir a Pruebas Multi-Tenant

Este recordatorio agrupa las acciones que requieren acceso a Supabase, Vercel o GitHub antes de compartir el sistema con varios comercios.

## Supabase

- Ejecutar `docs/sql/019_promotion_bundles_and_barcodes.sql` si todavia no fue aplicado.
- Ejecutar `docs/sql/021_tenant_slugs.sql` para habilitar enlaces por comercio, por ejemplo `/la25`.
- Ejecutar `docs/sql/022_beta_readiness_preflight.sql` antes de invitar clientes. No avanzar si devuelve algun `FAIL`.
- Para limpiar datos basura y dejar solo el tenant interno de pruebas, usar `docs/sql/024_reset_to_single_test_tenant.sql`.
- Para pruebas de aislamiento con dos comercios internos, usar `docs/sql/025_reset_to_two_test_tenants.sql`.
- Confirmar que no existan policies `dev_all_anon` ni `dev_all_auth`.
- Confirmar que `anon` no puede leer tablas operativas (`tenants`, `products`, `customers`, `sales`, etc.).
- Confirmar que cada usuario real tenga `public.users.auth_user_id` vinculado al usuario de Supabase Auth.
- Crear un procedimiento repetible para alta de comercios:
  - tenant
  - tenant_settings
  - perfiles de permisos
  - usuario administrador
  - usuarios empleados
  - medios de pago por defecto
  - codigos de balanza si aplica
- Usar como base `docs/sql/020_bootstrap_new_tenant_template.sql` para nuevas altas.
- Desde el sistema, usar `/sistema/alta-comercio` para generar el SQL de alta de un comercio desde un formulario interno.
- Confirmar que cada tenant tenga `slug` unico y que el login `/slug/login` valide el comercio correcto.
- Probar aislamiento entre al menos dos tenants reales:
  - usuario A no ve productos/clientes/ventas del usuario B
  - usuario B no ve productos/clientes/ventas del usuario A
- Verificar que las tablas nuevas `promotion_items` y `promotion_barcodes` tengan RLS activo.
- Confirmar que los Edge Functions `admin-create-user` y `admin-update-user` sigan desplegados.

## Vercel

- Confirmar que el proyecto deploya desde `main`.
- Configurar variables de entorno de Production:
  - `VITE_DATA_PROVIDER=supabase`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPPORT_WHATSAPP_PHONE`
- Confirmar que el deployment de Production pasa correctamente.
- Revisar que GitHub ya no bloquee merge por falta de Production deployment.
- Confirmar que la URL pública abre login y no usa modo mock.
- Hacer una prueba completa desde la URL de Production:
  - login
  - cargar producto
  - cargar cliente
  - abrir caja
  - venta contado
  - venta cuenta corriente
  - pago cuenta corriente
  - compra a proveedor
  - ajuste de stock

## GitHub

- Mantener `main` como rama de Production.
- Mantener `develop` como rama de trabajo.
- Si las reglas de protección molestan durante esta etapa, simplificarlas temporalmente.
- Cuando el flujo este estable, volver a activar:
  - Pull Request obligatorio
  - checks/deployments obligatorios
  - bloqueo de push directo a `main`

## Soporte

- Definir numero definitivo para soporte WhatsApp.
- Configurarlo como `VITE_SUPPORT_WHATSAPP_PHONE` en Vercel Production.
- Probar desde un usuario cliente que el boton abra WhatsApp con comercio, usuario y modulo actual.

## Antes De Dar Acceso A Cada Cliente

- Seguir `docs/beta-5-clientes-runbook.md`.
- Crear tenant propio.
- Crear usuario administrador del comercio.
- Crear contrasena inicial o enviar invitacion/restablecimiento.
- Cargar configuracion minima:
  - nombre comercial
  - medios de pago
  - caja
  - codigos de balanza, si usa balanza
  - permisos
- Hacer una venta de prueba y borrarla/anularla si corresponde.
- Confirmar que el cliente no puede ver datos de otros comercios.
