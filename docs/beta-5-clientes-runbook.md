# Runbook Beta - Primeros 5 Clientes

Objetivo: habilitar pruebas reales controladas con hasta 5 comercios, sin mezclar datos entre tenants y con soporte operativo por WhatsApp.

## 1. Preparacion De Plataforma

Antes de invitar a cualquier cliente:

1. Supabase debe estar activo y sin pausa.
2. Ejecutar SQL pendientes:
   - `docs/sql/019_promotion_bundles_and_barcodes.sql`
   - `docs/sql/021_tenant_slugs.sql`
   - `docs/sql/022_beta_readiness_preflight.sql`
3. El preflight `022` no debe devolver ningun `FAIL`.
4. Vercel Production debe tener:
   - `VITE_DATA_PROVIDER=supabase`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPPORT_WHATSAPP_PHONE=5492664689173`
5. Dominio conectado a Vercel.

## 2. Alta De Cada Comercio

Para cada comercio:

1. Crear usuario admin en Supabase Auth.
2. Copiar el User UID.
3. Entrar a `/sistema/alta-comercio`.
4. Completar:
   - razon social
   - nombre comercial
   - slug
   - CUIT
   - email comercio
   - User UID del admin
   - email y nombre del admin
   - configuracion de caja y balanza si aplica
5. Copiar y ejecutar el SQL generado.
6. Ejecutar `docs/sql/022_beta_readiness_preflight.sql`.
7. Confirmar que el comercio aparece con slug unico.

## 3. Prueba Minima Por Comercio

Antes de enviar el acceso al cliente:

1. Abrir `https://DOMINIO/SLUG/login`.
2. Iniciar sesion con el usuario admin.
3. Crear 2 productos unitarios.
4. Crear 1 producto pesable si el comercio usa balanza.
5. Crear 1 cliente.
6. Abrir caja.
7. Hacer una venta contado.
8. Hacer una venta a cuenta corriente.
9. Registrar un pago de cuenta corriente.
10. Crear una compra a proveedor y verificar actualizacion de stock.
11. Ver caja diaria y movimientos.
12. Cerrar caja.
13. Verificar boton de WhatsApp soporte.

## 4. Regla De Aislamiento

No invitar al siguiente cliente si no se probo:

- usuario del comercio A no ve productos del comercio B
- usuario del comercio A no ve clientes del comercio B
- usuario del comercio A no ve ventas del comercio B
- usuario del comercio A no puede entrar por el slug del comercio B

## 5. Comunicacion Al Cliente Beta

Mensaje recomendado:

> Te paso el acceso a la beta del sistema. Durante esta etapa vamos a revisar ventas, stock, caja y cuentas corrientes. Si algo no funciona o tenes dudas, usa el boton de WhatsApp soporte dentro del sistema.

## 6. Criterio Para Frenar La Beta

Frenar nuevas altas si aparece cualquiera de estos casos:

- un cliente ve datos de otro comercio
- ventas no impactan caja o stock correctamente
- el login por slug permite entrar a un comercio incorrecto
- Supabase se pausa o queda inaccesible
- hay errores repetidos al registrar ventas
