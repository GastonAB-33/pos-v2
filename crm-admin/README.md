# Jireh POS - SuperAdmin & CRM Central (Standalone)

Esta es la **Plataforma Central de SuperAdmin y CRM de Jireh POS**, completamente independiente del sistema POS y de la Landing Page.

## Propósito
Permite al fundador y equipo de ventas de Jireh POS:
1. **Gestionar Comercios (Tenants)**: Visualizar todos los comercios registrados, estado de suscripción (`trial`, `active`, `past_due`, `suspended`), fecha de vencimiento y plan contratado.
2. **Acciones Inmediatas de 1 Clic**:
   - **Extender Prueba (+3, +7, +15 días)**: Para clientes en negociación que solicitan más tiempo.
   - **Activar Manualmente**: Habilitar el sistema por 1, 3, 6 o 12 meses cuando el cliente abona por transferencia bancaria directa o efectivo.
   - **Suspender / Reactivar**: Activa automáticamente el Paywall de suscripción en el POS del cliente si no renueva.
   - **WhatsApp Directo**: Iniciar chat personalizado con el titular del comercio con un solo clic.
3. **Pipeline CRM (Kanban)**:
   - Seguimiento visual de leads: *Nuevo Lead* ➔ *Trial 7 Días* ➔ *En Negociación* ➔ *Cliente Oficial* ➔ *Perdido*.
4. **Historial de Cobranzas**: Registro auditable de todas las transacciones y pagos registrados.

## Ejecución Local
```bash
npm install
npm run dev
```
La aplicación correrá en `http://localhost:5175`.

## Build para Producción
```bash
npm run build
```
Genera la carpeta optimizada `dist/` para desplegar en `admin.jirehpos.com` o `crm.jirehpos.com` en Vercel, Netlify o servidor privado.
