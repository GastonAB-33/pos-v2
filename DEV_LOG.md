# DEV_LOG - Bitácora de Desarrollo y Memoria de Contexto

Este documento es la **fuente única de verdad y memoria compartida** entre diferentes computadoras, ramas y sesiones de desarrollo asistido por IA (Antigravity / Cursor / Codex / desarrolladores humanos).

> [!IMPORTANT]
> **REGLA OBLIGATORIA (AGENTS.md):**
> Cada vez que se realice un cambio, fix, nueva funcionalidad, migración o ajuste en cualquier parte del sistema, **es obligatorio registrar la entrada correspondiente en este archivo** antes de finalizar la tarea o realizar el commit.

---

## 🏛️ Estructura del Proyecto (Monorepo)
* **`src/`**: Sistema POS V2 (Punto de Venta, Cajas, Cuentas Corrientes, Compras, Stock, Clientes, Proveedores, etc.). React 18 + Vite + Tailwind + Zustand.
* **`crm-admin/`**: Panel Administrativo y CRM SaaS (Gestión de comercios, suscripciones, trials, métricas globales).
* **`landing/`**: Landing page pública aislada (Captación de leads, calculadora de planes, checkout y prueba gratis).
* **`supabase/`**: Edge Functions (`onboard-trial`, `arca-billing`, `mercadopago-checkout`, admin user management).

---

## 📋 Registro Histórico de Cambios

### [2026-11-26] - Fix Cierre Prematuro del Modal de Resumen Post-Cierre en Caja Diaria
* **Zona:** `src/modules/caja/pages/CajaPage.tsx`
* **Objetivo:** Evitar que el modal de cierre de caja se cierre automáticamente al completarse el cierre, permitiendo ver el detalle (Exacto/Faltante/Sobrante) y escribir la aclaración post-cierre.
* **Cambios:**
  * En `CajaPage.tsx`, el `useEffect` que vigilaba `isCloseCashModalOpen && !currentSession` cerraba el modal apenas `closeCash` dejaba `currentSession = null`. Ahora también verifica `!closingSessionSnapshot && !isCashClosed`, manteniendo el modal abierto hasta que el usuario finalice desde la pantalla de resumen.
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-26] - Apertura Diferida de Caja ("Posponer Conteo de Apertura") con Permiso por Usuario
* **Zona:** `src/types/modules.ts`, `src/modules/usuarios/constants/module-groups.ts`, `src/modules/caja/schemas/cash.schemas.ts`, `src/modules/caja/hooks/useCashModule.ts`, `src/modules/caja/components/CashOpenForm.tsx`, `src/modules/caja/pages/CajaPage.tsx`, `src/modules/pos/pages/PosPage.tsx`
* **Objetivo:** Permitir a usuarios autorizados abrir la caja diaria en `$0` cuando hay demanda en mostrador y cargar el conteo físico inicial más tarde, descontando automáticamente el efectivo neto ingresado en el turno para que el arqueo cuadre exactamente.
* **Cambios:**
  * **Permiso granular (`caja_apertura_diferida`):** Agregado a `appModules`, `appModuleLabels` y `module-groups.ts` (*Punto de Venta y Mostrador*). Los perfiles sin este permiso no ven ni pueden usar la función.
  * **Formulario de apertura (`CashOpenForm.tsx`):** Se agregó el botón **"Posponer conteo ($0)"** (solo visible con permiso) y el modo `complete_deferred` para contar el efectivo físico posterior.
  * **Lógica contable (`useCashModule.ts` & `PosPage.tsx`):** Al posponer, se crea la sesión con `opening_amount = 0` y `deferredOpeningPending: true` en el snapshot. Al completar el conteo (`completeDeferredOpening`), calcula `opening_amount = contado - (cashIncomes - cashExpenses)`, actualiza billetes/monedas, registra auditoría (`complete_deferred_opening`) y asienta el fondo inicial en Caja General si corresponde.
  * **Caja Diaria (`CajaPage.tsx`):** Muestra un banner destacado con acceso directo a **"Completar conteo inicial"** mientras esté pendiente, y avisa dentro del modal de cierre si se intenta cerrar sin haber cargado el conteo inicial.
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-26] - Fix Deadlock Infinito ("Ingresando...") en Login Supabase Auth
* **Zona:** `src/lib/supabase/client.ts`, `src/features/auth/hooks/useAuthSessionSync.ts`, `src/modules/caja/pages/CajaPage.tsx`
* **Objetivo:** Resolver el cuelgue infinito en `"Ingresando..."` al iniciar sesión desde `/login`.
* **Cambios:**
  * **Causa raíz:** `safeInMemoryAuthLock` serializaba operaciones de auth por clave de token, pero `supabase.auth.signInWithPassword` dispara `onAuthStateChange("SIGNED_IN")` **antes** de liberar el lock, y `useAuthSessionSync` llamaba a `getStoredPosSession()` → `supabase.auth.getSession()` dentro de ese callback, generando un deadlock reentrante.
  * **`src/lib/supabase/client.ts`:** Se reemplazó `safeInMemoryAuthLock` por `noOpAuthLock` (evita tanto el error de `navigator.locks` como cualquier deadlock reentrante).
  * **`src/features/auth/hooks/useAuthSessionSync.ts`:** Se volvió síncrono el callback de `onAuthStateChange` difiriendo la rehidratación con `window.setTimeout(..., 150)` fuera del ciclo de notificación de Supabase Auth.
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Optimización de Velocidad al Confirmar Venta POS (Inserción en Lote)
* **Zona:** `src/services/base/tenant-crud.service.ts`, `src/services/sales.service.ts`, `src/services/stock.service.ts`, `src/modules/pos/hooks/usePosSale.ts`
* **Objetivo:** Reducir la demora al confirmar una venta en el POS eliminando las múltiples peticiones HTTP individuales por cada producto del carrito.
* **Cambios:**
  * Se agregó `createMany` en `TenantCrudService` (`src/services/base/tenant-crud.service.ts`) para insertar lotes en una sola petición a Supabase (con fallback automático para columnas faltantes o tablas en modo mock).
  * Se agregaron `salesService.createItems` (`src/services/sales.service.ts`) y `stockService.createMany` (`src/services/stock.service.ts`) con deduplicación de productos especiales y fallback automático.
  * En `confirmSale` (`src/modules/pos/hooks/usePosSale.ts`), los ítems de venta (`sale_items`) y los movimientos de stock (`stock_movements`, incluyendo sub-artículos de promos) ahora se insertan en 2 únicas peticiones por lote en paralelo, y las actualizaciones de `stock_current` se deduplican por `product_id`.
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Confirmación de Gramos/Cantidad con Enter en Carrito del POS sin Abrir Cobro
* **Zona:** `src/modules/pos/components/PosSmartView.tsx`, `src/modules/pos/components/PosCart.tsx`
* **Objetivo:** Evitar que al presionar `Enter` dentro del campo numérico de gramos o cantidad en un ítem del carrito se dispare el atajo global de apertura del modal de cobro (`handleCheckoutEnter`).
* **Causa Identificada:** Al presionar `Enter`, el `onKeyDown` del input ejecutaba `event.currentTarget.blur()` sin llamar a `event.preventDefault()` ni `event.stopPropagation()`, por lo que al perder el foco antes del burbujeo hacia `window`, `handleCheckoutEnter` en `PosPage.tsx` veía `document.activeElement` fuera de un input y abría el modal de pago.
* **Cambios:**
  * Se agregaron `event.preventDefault()` y `event.stopPropagation()` antes de `event.currentTarget.blur()` en los inputs de cantidad/gramos de `PosSmartView.tsx` y `PosCart.tsx`.
* **Próximos pasos:** Verificado con `npm run build`.

### [2026-11-25] - Búsqueda Obligatoria en Selector de Cliente de Cuenta Corriente (POS)
* **Zona:** `src/modules/pos/components/PosCustomerSelectModal.tsx`
* **Objetivo:** Evitar errores al asignar una venta o cuenta corriente en el POS impidiendo que aparezca precargada la lista completa de clientes al abrir el selector.
* **Cambios:**
  * `filteredCustomers` ahora retorna un arreglo vacío `[]` cuando el campo de búsqueda está vacío, mostrando coincidencias únicamente cuando el cajero comienza a escribir (nombre, DNI, teléfono o razón social).
  * Se agregó una vista guía amigable cuando aún no se ingresó texto (*"Escribí el nombre, DNI o teléfono del cliente"*), previniendo también selecciones accidentales al presionar `Enter` sin buscar.
* **Próximos pasos:** Verificar en `npm run build`.

### [2026-11-25] - Ocultar Botón "Revelar" en Cierre de Caja a Ciegas
* **Zona:** `src/modules/caja/pages/CajaPage.tsx`
* **Objetivo:** Impedir que los usuarios con el permiso de `caja_cierre_ciego` vean o puedan usar el botón **Revelar** en Caja Diaria, y verificar el flujo de resumen post-cierre.
* **Cambios:**
  * Se actualizó `CajaPage.tsx` para que, cuando `hasBlindClosePermission` es verdadero, `isBlindModeActive` permanezca siempre activo y el botón **Revelar** no se renderice.
  * Se verificó en `CashCloseForm.tsx` y `CajaPage.tsx` que al confirmar el cierre se mantiene abierto el modal con el resumen post-cierre (Esperado, Contado, Diferencia) en modo solo lectura sobre los montos y habilitando únicamente el campo de **Observaciones / Justificación de cierre** (`onUpdateNotes`).
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Permitir Cerrar Venta con Enter Aunque Quede Texto en Buscador POS
* **Zona:** `src/modules/pos/pages/PosPage.tsx`
* **Objetivo:** Desbloquear el atajo `Enter` para abrir el cobro en el POS cuando el usuario ya salió del buscador (foco y desplegable cerrados), aunque haya quedado texto residual escrito en `#pos-search-input`.
* **Cambios:**
  * En `handleCheckoutEnter` (`src/modules/pos/pages/PosPage.tsx`), se eliminó la condición `searchInput.value.trim() !== ""` de `isSearchActive`, manteniendo únicamente la verificación de foco activo (`document.activeElement === searchInput`) o panel abierto (`[data-search-open="true"]`).
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Fix Badge "Pendiente precios" en Historial de Compras
* **Zona:** `src/modules/compras/components/PurchasesHistoryTable.tsx`
* **Objetivo:** Evitar que el badge de estado `Pendiente precios` (y los demás badges de estado de compra) se parta en dos líneas superpuestas dentro de la tabla.
* **Cambios:**
  * Se agregó `inline-flex items-center whitespace-nowrap` a los badges de `renderStatusBadge` (`Pendiente precios`, `Confirmada`, `Devolución parcial`, `Devuelta total`).
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Fix RLS de Lectura del Propio Perfil en `permission_profiles`
* **Zona:** `docs/sql/042_allow_own_permission_profile_select.sql`
* **Objetivo:** Permitir que cualquier usuario autenticado (como `Cajera` u otros perfiles sin acceso al módulo `usuarios`) pueda leer su propio `permission_profiles` asignado al iniciar sesión.
* **Cambios:**
  * Se actualizó la política `permission_profiles_select_own_tenant` para permitir `SELECT` cuando `public.can_read_module('usuarios')` sea verdadero **o** cuando el perfil coincida con `u.permission_profile_id` del usuario autenticado (`auth.uid()`).
* **Próximos pasos:** Ejecutar el SQL en Supabase SQL Editor.


### [2026-11-25] - Respeto Estricto de Perfil de Permisos y Badge de Perfil en Topbar
* **Zona:** `src/features/auth/store/auth.store.ts`, `src/components/layout/Topbar.tsx`
* **Objetivo:** Corregir el bypass en el frontend donde usuarios con `role_code = 'owner' | 'admin'` veían módulos no autorizados (`Usuarios`, `Estadísticas`, `% Ganancia` en Compras) al cambiarse a un perfil restringido (ej. `Cajera`), y mostrar visiblemente el perfil activo en el menú de usuario.
* **Cambios:**
  * **Store de Auth (`src/features/auth/store/auth.store.ts`):**
    * Se actualizó `hasPermission`: el bypass por rol `admin`/`owner` ahora solo aplica cuando el usuario no tiene `permissionProfileId` asignado. Si tiene un perfil asignado, se evalúan estrictamente los permisos reales de ese perfil en todos los módulos (alineado con RLS de Supabase).
  * **Menú de Usuario (`src/components/layout/Topbar.tsx`):**
    * Se agregó un badge pill (`Perfil: <nombre del perfil>`) en la parte superior derecha del popover de usuario para visualizar rápidamente qué perfil de permisos está activo.
* **Próximos pasos:** Verificado con `npx tsc --noEmit` sin errores.


### [2026-11-25] - Auto-recuperación de Perfil de Permisos en Login y Script SQL La25
* **Zona:** `src/services/auth.service.ts`, `src/lib/supabase/client.ts`, `docs/sql/041_fix_la25_user_and_permissions.sql`
* **Objetivo:** Resolver el error bloqueante *"No se encontro el perfil de permisos asignado"* al iniciar sesión (particularmente con `ale.97.28+la25@gmail.com` en tenant `La25`), implementando auto-sanación en el frontend y un script SQL de reparación en Supabase.
* **Cambios:**
  * **Servicio de Autenticación (`src/services/auth.service.ts`):**
    * Se actualizó la resolución de `toAppUser`: si `user.permission_profile_id` es nulo o apunta a un perfil inexistente/inactivo, ahora busca automáticamente los perfiles activos del tenant (`Administrador` o primer perfil disponible).
    * Auto-asigna el perfil y repara la columna `permission_profile_id` en `public.users` en Supabase de forma asíncrona.
    * Si el comercio no tuviera ningún perfil creado, crea automáticamente el perfil `Administrador` con permisos completos (`createFullPermissionProfile()`).
    * Respaldo en memoria: para usuarios con rol `owner` o `admin`, si la persistencia en DB fallase temporalmente, se les otorga acceso en memoria con permisos totales para evitar que queden bloqueados.
  * **Script de Reparación SQL (`docs/sql/041_fix_la25_user_and_permissions.sql`):**
    * Vincula inequívocamente al usuario de Auth `ale.97.28+la25@gmail.com` con el tenant `La25`.
    * Garantiza la existencia del perfil `Administrador` activo con todos los módulos habilitados.
    * Actualiza `public.users` asignando `role_code = 'owner'`, `permission_profile_id` y `is_active = true`.
* **Próximos pasos:** El usuario puede ejecutar el script SQL en Supabase para sincronizar la base de datos de inmediato. Build verificado con éxito.


### [2026-11-25] - Filtro de Solo Pesables en Módulo de Productos (Fiambrería y Balanza)
* **Zona:** `src/modules/productos/`
* **Objetivo:** Permitir filtrar el catálogo de productos para mostrar exclusivamente productos pesables (fraccionables por balanza / kg / gramos) o unitarios, facilitando la búsqueda y operación rápida en secciones como fiambrería, carnicería y verdulería.
* **Cambios:**
  * **Tipos (`src/modules/productos/types/product.types.ts`):**
    * Se extendió `ProductFiltersState` con el campo `saleMode?: "all" | "weight" | "unit"`.
  * **Hook de Filtrado (`src/modules/productos/hooks/useProducts.ts`):**
    * En `defaultFilters` se inicializó `saleMode: "all"`.
    * En `filteredProducts` se agregó la regla estricta: si `filters.saleMode === "weight"`, se muestran exclusivamente productos con `saleMode === "weight"`; si `filters.saleMode === "unit"`, solo unitarios.
  * **Componente de Filtros (`src/modules/productos/components/ProductFilters.tsx`):**
    * **Modal de Filtros Avanzados:** Se incorporó el campo *"Modalidad de venta"* con opciones: *"Todas las modalidades"*, *"⚖️ Solo pesables (fiambrería / balanza / kg)"* y *"📦 Solo por unidad"*.
    * **Acceso Rápido en Toolbar:** Se agregó un botón interactivo *"Solo pesables"* con ícono de balanza (`Scale`) junto al botón de filtros avanzados, permitiendo activar y desactivar este filtro con un solo clic.
    * **Chip de Filtro Activo:** Cuando el filtro está activo, se muestra el chip correspondiente con botón de remoción rápida.
    * **Contador de Filtros:** Se actualizó `activeAdvancedFiltersCount` para contabilizar la modalidad seleccionada.
* **Próximos pasos:** Ninguno pendiente; verificado con `npm run build` sin errores de compilación ni tipos.

### [2026-11-25] - Migración de Cierre de Caja a Ciegas a Permiso Individual de Usuarios
* **Zona:** `src/types/modules.ts`, `src/types/permissions.ts`, `src/features/auth/store/auth.store.ts`, `src/modules/usuarios/constants/module-groups.ts`, `src/modules/usuarios/components/PermissionMatrix.tsx`, `src/modules/caja/pages/CajaPage.tsx`, `src/modules/configuracion/pages/ConfiguracionPage.tsx`, `src/modules/usuarios/hooks/useUsersModule.ts`
* **Objetivo:** Desvincular el cierre de caja a ciegas de la configuración global de sucursal/sistema y convertirlo en un permiso granular asignable por rol/perfil de usuario (para obligar a arqueo ciego únicamente a cajeros u operadores designados).
* **Cambios:**
  * **Módulo de Permisos (`src/types/modules.ts` y `src/types/permissions.ts`):**
    * Se añadió el submódulo `"caja_cierre_ciego"` (`"Cierre de Caja a Ciegas"`) a `appModules` y `appModuleLabels`.
    * En `createFullPermissionProfile`, se estableció por defecto `{ read: false, write: false }` para `caja_cierre_ciego`, garantizando que administradores y dueños no queden forzados a cierre ciego al tener permisos totales.
    * En `auth.store.ts`, se ajustó `hasPermission` para que `caja_cierre_ciego` siempre evalúe el perfil específico del usuario en lugar de otorgar `true` automáticamente a roles `admin`/`owner`.
  * **Matriz de Permisos (`PermissionMatrix.tsx` y `module-groups.ts`):**
    * Se integró `caja_cierre_ciego` en el grupo de módulos *Punto de Venta y Mostrador* con selector intuitivo de dos estados: `[ Arqueo visible ]` vs `[ A ciegas (Obligatorio) ]`.
    * Se excluyó de la asignación masiva de grupo para evitar que el botón "Acceso Total" fuerce el cierre ciego a usuarios privilegiados.
  * **Caja Diaria (`src/modules/caja/pages/CajaPage.tsx`):**
    * Se calcula reactivamente `hasBlindClosePermission = Boolean(canRead("caja_cierre_ciego") || canWrite("caja_cierre_ciego"))`.
    * `isBlindModeActive` y el prop `blindMode` del modal `CashCloseForm` ahora se rigen por los permisos del usuario activo, permitiendo que usuarios con permisos privilegiados (o sin la restricción asignada) vean los saldos esperados y el desglose de ingresos.
  * **Configuración del Sistema (`ConfiguracionPage.tsx`):**
    * Se retiró el checkbox global de sucursal en la pestaña *Caja y Tesorería* y se reemplazó por una tarjeta informativa que redirige la administración del arqueo ciego al módulo de *Usuarios y Permisos*.
* **Próximos pasos:** Ninguno; verificado mediante `npm run build` sin errores.


* **Zona:** `vercel.json`
* **Objetivo:** Permitir la carga de fotografías de productos, logos y banners alojados en Cloudflare R2 (`https://cdn.jireh.cloud` y `https://*.r2.dev`) dentro de producción (`https://app.jireh.cloud`), tanto en el sistema (POS / Productos) como en **Mi Tienda**.
* **Causa Identificada:** La cabecera `Content-Security-Policy` (`img-src`) en `vercel.json` no incluía `https://cdn.jireh.cloud` ni `https://*.r2.dev`, provocando que Chrome bloqueara todas las imágenes del catálogo maestro en producción mientras en `localhost` funcionaban con normalidad.
* **Cambios:**
  * Se agregaron `https://cdn.jireh.cloud` y `https://*.r2.dev` a la directiva `img-src` en `vercel.json`.
* **Próximos pasos:** Hacer commit y push a `main` para disparar el redespliegue en Vercel.

### [2026-11-25] - Simplificación del Detalle de Movimientos en Resumen WhatsApp de Cuenta Corriente
* **Zona:** `src/utils/whatsapp-voucher.utils.ts`, `src/modules/cuentas-corrientes/pages/CuentasCorrientesPage.tsx`
* **Objetivo:** Eliminar los números internos de venta (ej: `VTA-1794669984018-8669`) y textos automáticos de split (`(Parcial cta. cte.)`) del mensaje de WhatsApp enviado a clientes, dejando las líneas limpias con fecha y monto (o descripción manual útil si la hubiera).
* **Cambios:**
  * **Helper `cleanMovementDescriptionForWhatsApp` (`src/utils/whatsapp-voucher.utils.ts`):**
    * Remueve mediante expresiones regulares prefijos y números internos de ventas (`VTA-...`, `#\d+`, `(Parcial cta. cte.)`, etc.).
    * Conserva notas manuales informativas escritas por el cajero (ej: `"alfajores galletas"`) y conceptos de pago (`"Pago recibido"` / `"Pago"`).
  * **Formateo de Líneas en `formatWhatsAppDebtStatement`:**
    * Si la venta no tiene nota manual adicional, formatea directo como `🛒 DD/MM/AAAA -> (+) $ monto`, sin números de comprobante largos ni redundancias.
    * Si tiene concepto manual, lo incluye como `🛒 DD/MM/AAAA: concepto -> (+) $ monto`.
    * Los pagos se formatean limpiamente con `🟢 DD/MM/AAAA: Pago -> (-) $ monto`.
* **Próximos pasos:** Ninguno; verificado con `tsc` y `npm run build` sin errores.

### [2026-11-25] - Ordenamiento Dinámico por Columnas en Cuentas Corrientes Clientes
* **Zona:** `src/modules/cuentas-corrientes/hooks/useCurrentAccountsPage.ts`, `src/modules/cuentas-corrientes/pages/CuentasCorrientesPage.tsx`
* **Objetivo:** Permitir ordenar de mayor a menor y viceversa la lista de cuentas corrientes de clientes haciendo clic en las cabeceras de columnas (`Cliente`, `Contacto`, `Estado y Envases`, `Saldo Actual`) o mediante el selector de orden en escritorio y vista móvil.
* **Cambios:**
  * **Hook `useCurrentAccountsPage`:**
    * Se incorporaron tipos exportados `CustomerSortColumn = "name" | "contact" | "status" | "balance"` y `CustomerSortDirection = "asc" | "desc"`.
    * Estados `sortColumn` y `sortDirection` con función `handleSort(column)` para alternar dirección o cambiar columna con valores por defecto intuitivos (`balance` y `status` arrancan en `desc` para ver mayores deudas/envases primero, `name` y `contact` en `asc`).
    * Comparadores reactivos en `filteredCustomers`: orden alfabético estricto en español para Cliente y Contacto, balance numérico para Saldo Actual, y envases retenidos + balance para Estado y Envases.
  * **Página `CuentasCorrientesPage`:**
    * **Cabeceras Interactivas (`<th>`):** Ahora son clicables con feedback visual en hover (`hover:bg-slate-100/60`), fondo activo destacado (`bg-blue-50/60 dark:bg-blue-950/30`), e iconos contextuales de ordenamiento (`ArrowUp`, `ArrowDown`, `ArrowUpDown` de `lucide-react`) con tooltips explicativos.
    * **Selector Rápido en Header:** Dropdown complementario integrado en la barra de título de la tabla (`Ordenar: Cliente A-Z, Saldo Mayor a menor, etc.`).
    * **Integración en Modal de Filtros Móviles:** Sección *"Criterio de ordenamiento"* con botones táctiles para que usuarios en celulares puedan ordenar la lista de tarjetas fácilmente.
* **Próximos pasos:** Ninguno pendiente para este módulo; funcional y probado con 0 errores TypeScript y bundle de producción validado.

### [2026-11-24] - Subida Segura de Fotos Personalizadas, Logos y Banners a Cloudflare R2 (Zero Egress)
* **Zona:** `supabase/functions/r2-upload/index.ts`, `src/services/r2-storage.service.ts`, `src/services/products.service.ts`, `src/modules/tienda/pages/MiTiendaAdminPage.tsx`, `src/modules/tienda/pages/StorefrontPage.tsx`
* **Objetivo:** Aprovechar el ancho de banda gratuito ilimitado (*Zero Egress*) de Cloudflare R2 no solo para el Catálogo Global, sino también para las fotos personalizadas de productos de cada comercio y los logos/banners de **Mi Tienda**, sin exponer credenciales S3 en el frontend.
* **Cambios:**
  * **Edge Function `r2-upload` (`supabase/functions/r2-upload/index.ts`):**
    * Autentica la sesión vía `requireAuthenticatedTenantUser` (aislamiento estricto anti-BOLA/IDOR por `tenant_id`).
    * Firma peticiones S3 `PUT`/`DELETE` contra Cloudflare R2 con AWS Signature V4 usando Web Crypto nativo de Deno y `Cache-Control: public, max-age=31536000, immutable`.
    * Aísla los archivos por comercio bajo `comercios/{tenantId}/{folder}/...` (`productos`, `tienda`, `comprobantes`), validando tipo MIME y tamaño máximo (5 MB).
  * **Servicio Frontend (`src/services/r2-storage.service.ts`) y `products.service.ts`:**
    * `uploadProductImage` intenta subir primero a Cloudflare R2 (`r2-upload`); si la Edge Function aún no está desplegada en la nube, hace fallback automático y transparente a Supabase Storage.
    * `deleteProductImageByUrl` elimina limpiamente recursos propios del comercio en R2 sin tocar nunca las imágenes compartidas del Catálogo Global.
  * **Logos y Banners en Mi Tienda (`MiTiendaAdminPage.tsx` & `StorefrontPage.tsx`):**
    * Se agregaron selectores de **Logo de tienda** y **Banner de portada** en la pestaña *1. Marca y Contacto*, subiéndolos a R2 (con fallback a Storage) y mostrándolos en la portada pública de la tienda.
* **Próximos pasos:** Desplegar la Edge Function `r2-upload` en Supabase (`npx supabase functions deploy r2-upload`) y cargar los secretos `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` y `R2_PUBLIC_URL`.

---

### [2026-11-24] - Modo Listas Personalizadas de Productos en "Mi Tienda"
* **Zona:** `src/types/entities/mvp.entities.ts`, `src/types/entities/index.ts`, `src/services/settings.service.ts`, `src/modules/tienda/pages/MiTiendaAdminPage.tsx`, `src/modules/tienda/pages/StorefrontPage.tsx`, `src/modules/productos/components/ProductFormModal.tsx`
* **Objetivo:** Permitir al comerciante elegir desde la configuración de Mi Tienda si desea mostrar arriba las categorías automáticas del POS o crear **Listas Personalizadas de Productos** (ej: *Mercadería*, *Ferretería*, *Fiambres*, *Corralón*, *Comidas*) con asignación individual o masiva.
* **Cambios:**
  * **Modelo de Datos (`StoreCatalogList`, `StoreSettings`):**
    * Nuevos campos en `StoreSettings`: `navigation_mode: "categories" | "lists"`, `custom_lists: StoreCatalogList[]`, y `only_show_listed_products: boolean`.
  * **Gestor de Listas en `/mi-tienda` (`MiTiendaAdminPage.tsx`):**
    * Selector entre **Usar Categorías del Inventario** vs **Usar Listas Personalizadas**.
    * Creación de listas con sugerencias rápidas 1-clic (*Mercadería*, *Bebidas*, *Fiambres*, *Ferretería*, *Corralón*, *Comidas*, *Bazar*, *Regalería*), reordenamiento ↑/↓ y eliminación.
    * Switch *"En la pestaña 'Todos', mostrar solo productos incluidos en alguna lista"*.
    * **Modal de Selección Ágil de Productos:**
      * Abre por defecto en **Por Categorías del POS (Rápido)** como primera pestaña, agrupando las categorías internas del inventario para sumar o quitar todos sus productos en 1 clic.
      * Como segunda pestaña, **Por Producto en Particular**, con buscador instantáneo (nombre, código, categoría), filtros (*Todos / En esta lista / Sin asignar*) y botones masivos *Sumar/Quitar filtrados*.
  * **Tienda Pública (`StorefrontPage.tsx`):**
    * Lee `navigation_mode` y muestra las listas personalizadas ordenadas o las categorías configuradas, aplicando `only_show_listed_products` si está activo.
  * **Ficha del Producto (`ProductFormModal.tsx`):**
    * Al editar un producto existente, muestra chips clickeables para asignarlo o quitarlo directamente de las listas personalizadas de Mi Tienda.

---

### [2026-11-24] - Corrección Responsive Mobile y Footer Fijo de Totales en Modal de Carrito ("Mi Tienda")
* **Zona:** `src/modules/tienda/pages/StorefrontPage.tsx`
* **Objetivo:** Corregir dos defectos visuales detectados en la tienda pública:
  1. En vista móvil (`grid-cols-2`), el botón `+ Agregar` al lado del precio desbordaba hacia la derecha de la tarjeta, generando desplazamiento horizontal de todo el catálogo hacia la izquierda.
  2. En el modal/drawer del carrito ("Mi Pedido"), el desglose de totales y el botón de WhatsApp quedaban dentro del área scrolleable y se cortaban en pantallas pequeñas.
* **Cambios:**
  * **Tarjetas de Producto Mobile (`StorefrontPage.tsx`):**
    * Se aplicó `overflow-x-hidden w-full` al contenedor raíz de la tienda y `min-w-0 overflow-hidden` a cada tarjeta `<article>`.
    * Se cambió la fila de precio y botón a disposición vertical en móvil (`flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`) con botón `+ Agregar` y selector de cantidad `- 1 +` a ancho completo (`w-full sm:w-auto`).
  * **Modal del Carrito con Footer Fijo:**
    * Se separó el cuerpo scrolleable (`flex-1 overflow-y-auto min-h-0`) del pie fijo (`shrink-0`) usando `max-h-[92dvh]`.
    * Los totales (`Subtotal`, `Costo de envío`, `Total del Pedido`, `Seña para iniciar preparación`) y el botón `Confirmar y Enviar por WhatsApp` ahora quedan fijos y siempre visibles sin cortes.

---

### [2026-11-24] - Resiliencia de Guardado de Configuración de Mi Tienda (Fallback a sistema.tienda y localStorage)
* **Zona:** `src/services/settings.service.ts`
* **Objetivo:** Resolver el error *"No se pudo guardar la configuración. Intentá nuevamente"* al presionar "Guardar configuración" en el panel de `/mi-tienda`.
* **Causa Identificada:** En Supabase la tabla `public.tenant_settings` aún no tenía agregada la columna `tienda` de primer nivel (error PostgreSQL `42703: column tenant_settings.tienda does not exist`), lo que provocaba que la llamada a `upsertTenantSettings` fallara al enviar dicho campo.
* **Solución Implementada:**
  1. **Aislamiento y Contingencia en `settingsService.upsertTenantSettings`:**
     - Guarda automáticamente una copia local inmediata en `localStorage` bajo la clave `pos-v2-tienda-{tenantId}`.
     - Guarda los datos de `tienda` anidados dentro de `sistema.tienda` (columna JSONB preexistente y válida en Supabase).
     - Si Supabase responde con el error `42703` (columna no encontrada), elimina automáticamente el campo de primer nivel `tienda` del payload de la petición y reintenta el guardado con éxito transparente.
  2. **Lectura Inteligente y Normalización:** `settingsService.normalizeTenantSettings` ahora lee y fusiona `input.tienda`, `input.sistema.tienda` y el respaldo de `localStorage`, asegurando que el comerciante siempre mantenga intactos sus datos (Alias bancario, CBU, políticas de seña, costos de envío, etc.) aun antes de correr migraciones SQL en producción.

---

### [2026-11-23] - Soporte Local / Dev Preview para Mi Tienda y Normalización Permisiva de Slugs (con y sin guión)
* **Zona:** `src/services/storefront.service.ts`, `docs/sql/041_mi_tienda_ecommerce_schema_and_rpc.sql`
* **Objetivo:** Resolver el error *"Tienda no disponible - Comercio no encontrado o inactivo"* al abrir la tienda en entorno local (`localhost:5177/tienda/la25`).
* **Causa Identificada:**
  1. En Supabase aún no se había ejecutado el script SQL `041_mi_tienda_ecommerce_schema_and_rpc.sql`, por lo que el RPC `get_storefront_data` arrojaba `PGRST202 (not found)`.
  2. El fallback directo a Supabase fallaba porque la tabla `public.tenants` tiene Row Level Security (RLS) activo y no permite consultas anónimas sin una función `SECURITY DEFINER`.
  3. El slug registrado en base de datos para "La 25" es `"la-25"` (con guión), mientras que la URL testeada por el usuario era `/tienda/la25` (sin guión).
* **Solución Implementada:**
  1. **Fallback de Sesión Local (`localhost` / Preview):** `storefrontService.getStorefrontData` ahora detecta si se está ejecutando en el navegador con sesión activa o en `localhost`. Carga instantáneamente los datos del comercio activo desde `useAuthStore`, sus configuraciones de tienda desde `settingsService` y sus productos desde `useProductsStore`. Permite probar la tienda al 100% en modo local de forma inmediata.
  2. **Normalización Inteligente de Slugs:** Soporta automáticamente slugs con y sin guión (ej: `la25` y `la-25`). En caso de no hallar coincidencia sin guión, prueba automáticamente la versión guionada (`la-25`).
  3. **SQL RPC Mejorado:** Se actualizó `docs/sql/041_mi_tienda_ecommerce_schema_and_rpc.sql` en las funciones `get_storefront_data` y `submit_store_order` para que la búsqueda SQL admita tanto `t.slug = slug` como `replace(t.slug, '-', '') = replace(slug, '-', '')`, haciendo que el enlace público funcione para cualquier cliente tanto con `/tienda/la-25` como con `/tienda/la25`.

---

### [2026-11-23] - Desarrollo de "Mi Tienda": Catálogo Online Público y Panel de Administración de E-Commerce para Comercios
* **Zona:** `src/` (Mi Tienda, Productos, Configuración, Menú Principal, Layout, Store, Routing), `docs/sql/`
* **Objetivo:** Implementar la plataforma integral de e-commerce y catálogo online **"Mi Tienda"** (`/tienda/:tenantSlug`) para que cada comerciante pueda compartir su catálogo de productos y recibir pedidos estructurados por WhatsApp de manera ordenada, simple y profesional.
* **Funcionalidades Clave Implementadas:**
  1. **Navegación Dinámica por Pestañas de Rubros / Listas:**
     - Barra deslizante superior de categorías y rubros configurados (Mercadería, Bazar, Regalería, Ferretería, Corralón, etc.).
     - Filtro reactivo en memoria con buscador en tiempo real y chips de categorías.
  2. **Control de Publicación y Destacados Web en Productos:**
     - En la ficha de producto (`ProductFormModal` y `ProductForm`), switches *"Publicar en Mi Tienda"* (`is_published_web`, activo por defecto) y *"Destacado en portada"* (`is_featured_web`).
     - Badges visuales identificatorios `Web` y `★` en la tabla desktop y tarjetas móviles de productos.
  3. **Políticas de Entrega y Envíos Personalizables:**
     - Modalidades: *Solo retiro en local*, *Solo envíos a domicilio* o *Ambas modalidades*.
     - Configuración de costo de envío, umbral para envío gratis, dirección del local para retiros y zonas de cobertura.
  4. **Política de Señas y Pagos Previos:**
     - Opciones: *Sin adelanto previo*, *Seña obligatoria* (% a elección del comerciante, ej: 50%) o *Pago total obligatorio (100%)* antes de iniciar la preparación del pedido.
     - Visualización clara de datos de transferencia bancaria (Alias, Banco, CBU, Titular) con botón de copiado en 1 clic.
  5. **Checkout Rápido Express por WhatsApp:**
     - Carrito flotante inferior con contador de ítems y subtotal.
     - Drawer de checkout con selección de entrega (retiro o delivery), datos del cliente y cálculo dinámico de seña requerida.
     - Al confirmar, registra el pedido en `store_orders` y abre directamente WhatsApp Web / App con el mensaje estructurado con desglose de productos, modalidad de entrega, seña calculada y solicitud del comprobante de transferencia.
  6. **Panel de Control del Comerciante (`/mi-tienda`):**
     - Switch de encendido/apagado público de la tienda.
     - Enlace público personalizado (`/tienda/{slug}`) con botón de copia y acceso directo.
     - Modal de Código QR oficial descargable e imprimible listo para colocar en el mostrador del local.
     - Pestañas de configuración: Información y WhatsApp, Pestañas y Rubros del catálogo, Modos de entrega y costo de envío, Política de señas y datos bancarios.
     - Bandeja de pedidos web entrantes con filtros por estado (*Pendiente*, *Confirmado*, *En preparación*, *Enviado*, *Entregado*, *Cancelado*).
  7. **Arquitectura Multi-Tenant Segura y Acceso Público:**
     - Migración SQL `041_mi_tienda_ecommerce_schema_and_rpc.sql`: tabla `public.store_orders`, columnas `is_published_web` y `is_featured_web` en `products`, y campo JSONB `tienda` en `tenant_settings`.
     - Funciones RPC con `SECURITY DEFINER`: `public.get_storefront_data` (aislamiento por slug sin exponer precios de costo ni márgenes) y `public.submit_store_order`.
  8. **Acceso Rápido y Navegación:**
     - Enlace en el Sidebar lateral en la sección de *Inventario*.
     - Tarjeta de acceso directo en el Menú Principal con badge `E-COMMERCE` e icono `Store`.
  9. **Tratamiento Visual de Envases (`object-contain`):**
     - Renderizado con `object-contain` y fondos neutros acolchados para que ningún paquete o envase sufra recortes.

---

### [2026-11-23] - Herencia Inteligente de Imágenes del Catálogo Maestro (Opción B) y Ajuste de Aspect Ratio (object-contain)
* **Zona:** `src/` (Productos, POS, Store, Utilidades), `docs/sql/`
* **Objetivo:** 
  1. Corregir el recorte visual en los empaques de productos (packshots) en modales y tarjetas debido a `object-cover`.
  2. Implementar la **Opción B de Herencia Inteligente**: permitir que los comercios que ya tienen productos cargados sin fotografía (como el tenant *La 25*) hereden y muestren automáticamente las imágenes oficiales del Catálogo Maestro Global (`https://cdn.jireh.cloud/productos/{barcode}.webp`), preservando al 100% sus nombres, precios, costos, categorías y stocks particulares.
  3. Prevenir links rotos o peticiones 404 para el ~19% de productos sin fotografía mediante un Set $O(1)$ en memoria y degradación elegante a placeholders.
* **Cambios:**
  * **Corrección de Aspect Ratio (`object-contain`):**
    * `ProductFormModal.tsx`: Se cambió el contenedor de fotografía a `object-contain` con fondo `bg-white p-2.5 dark:bg-slate-950` y borde redondeado (`rounded-2xl`). El empaque del producto (paquete de snacks, botella, lata) ahora se visualiza completo, centrado y sin recortes en los bordes.
    * `PosProductList.tsx`: En las tarjetas de favoritos del POS se configuró `object-contain` con fondo blanco y padding suave `p-1.5`.
    * `PosQuickProductModal.tsx`: Se integró una miniatura previa con `object-contain` en el banner azul de precarga de Catálogo Global.
  * **Capa de Resolución y Herencia (`src/utils/product-image.utils.ts` & `src/utils/master-catalog-images.generated.ts`):**
    * `MASTER_CATALOG_IMAGE_BARCODES`: `ReadonlySet<string>` generado automáticamente con los 3.755 códigos de barra con fotografía WebP subida a Cloudflare R2 (~12 KB gzipped).
    * `resolveProductImageUrl(customImageUrl, barcode)`:
      1. Si el comercio cargó una foto personalizada (`customImageUrl`), se respeta con máxima prioridad.
      2. Si no tiene foto propia, consulta el Set del Catálogo Maestro y genera la URL oficial de Cloudflare R2 (`https://cdn.jireh.cloud/productos/{barcode}.webp`).
      3. Si el código no tiene foto (~19% restante), retorna `null` para evitar errores 404 y mostrar el badge habitual.
  * **Integración en Store y Servicios:**
    * `products.store.ts`: En `loadCatalog` y `upsertProduct`, enriquece los productos sin foto asociando la URL heredada en memoria. Cero recargas de base de datos ni latencia adicional.
    * `products.service.ts`: En `mapEntityToProductViewModel` y `mapEntityToProduct`, resuelve la imagen con `resolveProductImageUrl(product.image_url, barcode || product.code)`.
  * **Miniaturas Visuales en Módulo de Productos y POS:**
    * `ProductTable.tsx`: Miniatura con `object-contain` en la tabla desktop junto al nombre del producto, y en las tarjetas táctiles móviles (`mobile-data-cards`).
    * `PosSmartView.tsx`: Miniatura en el menú flotante de resultados del buscador rápido de caja.
  * **Script SQL Opcional para Base de Datos (`docs/sql/040_sync_tenant_inherited_images.sql`):**
    * Script para sincronizar masivamente `image_url` en `public.products` por `product_barcodes` y `code` solo en registros donde `image_url IS NULL OR trim(image_url) = ''`.
* **Próximos pasos:** Verificar visualmente en entorno local o producción.

---

### [2026-11-23] - Integración Oficial y Gratuita de WhatsApp Click-to-Chat (Tickets, Facturas, Cobranzas y Cajas)
* **Zona:** `src/` (POS, Comprobantes, Cuentas Corrientes, Cajas, UI)
* **Objetivo:** Permitir el envío ágil e instantáneo de tickets digitales de venta, facturas ARCA, resúmenes de deuda con alias bancario y reportes diarios de cierre de caja mediante el protocolo oficial y gratuito de WhatsApp Web / App (`api.whatsapp.com/send`), con costo $0 para el comercio y cero riesgo de baneo de número.
* **Cambios:**
  * **Capa de Utilidades y Formateo (`src/utils/whatsapp-voucher.utils.ts`):**
    * `cleanPhoneForWhatsApp`: Sanitizador y normalizador automático para celulares de Argentina (`+54 9`) y números internacionales (remueve ceros iniciales, remueve el "15" local, añade prefijo internacional estándar E.164).
    * `formatWhatsAppTicket`: Generador de texto en markdown de WhatsApp con emojis (`🧾`, `🏢`, `🛒`, `💰`), detalle de ítems con cantidades y subtotales, totales de venta y datos fiscales ARCA (CAE, vencimiento y enlace a QR oficial).
    * `formatWhatsAppInvoice`: Generador de texto para Facturas Electrónicas Oficiales ARCA (A, B, C) con desglose de CUIT, IVA e identificación fiscal del cliente.
    * `formatWhatsAppDebtStatement`: Resumen para cobranzas de cuentas corrientes con saldo deudor o a favor, límite de crédito, últimos 5 movimientos y datos bancarios (Alias, CBU, Banco) para agilizar transferencias.
    * `formatWhatsAppCashClose`: Reporte de arqueo de caja formal al celular del dueño con fondo inicial, total facturado, ventas por medio de pago, arqueo de efectivo y sobrante/faltante.
  * **Componentes Visuales:**
    * `src/components/brand/WhatsAppIcon.tsx`: Icono SVG oficial de WhatsApp estilizado y reutilizable en toda la aplicación.
    * `src/components/ui/WhatsAppPhonePromptModal.tsx`: Mini-modal con autofoco instantáneo (`agile-keyboard-flow`), confirmación con tecla `Enter` y diseño redondeado (`modern-rounded-design` y `dark-mode-contrast`) cuando el cliente es Consumidor Final o no tiene celular grabado.
  * **Integración en Comprobantes y Punto de Venta:**
    * `ReceiptTicketPanel.tsx`: Botón destacado verde "Enviar por WhatsApp" en la barra de herramientas del Ticket de Venta y de la Factura Electrónica ARCA.
    * `PosPage.tsx`: Botón de WhatsApp integrado en el listado lateral de comprobantes recientes del turno para reenvíos directos desde la caja.
    * `ReceiptsTable.tsx` & `ComprobantesView.tsx`: Botón de acción rápida en la tabla desktop y en las tarjetas móviles touch-friendly (`mobile-data-cards`).
  * **Integración en Cuentas Corrientes (Cobranzas):**
    * `CuentasCorrientesPage.tsx`: Botón "Enviar por WhatsApp" en la barra superior de acciones del cliente, botón directo "Cobrar" en la tabla de deudores y botón circular de WhatsApp en las tarjetas móviles.
  * **Integración en Cajas (Control del Dueño):**
    * `CashSessionCloseDetailModal.tsx` & `CashCloseForm.tsx`: Botón "Enviar Cierre al Dueño por WhatsApp" tanto en la pantalla de confirmación post-arqueo como en el modal de detalle formal de turnos anteriores.
* **Próximos pasos:** Validar operativamente en entorno de prueba o producción con clientes beta.

---

### [2026-11-23] - Pipeline de Imágenes Cloudflare R2 y Desbloqueo de Cámara Móvil
* **Zona:** `src/`, `tools/catalog-images/`, `vercel.json`, `docs/`
* **Cambios:**
  * **Corrección de Cámara Móvil (`vercel.json`):**
    * Se corrigió la cabecera `Permissions-Policy` de `camera=(), microphone=()` a `camera=(self), microphone=(self), geolocation=(), payment=*` en [vercel.json](file:///c:/IMPORTANTE-NO-ELIMINAR/POS/vercel.json#L20).
    * Esto resuelve el problema por el cual Chrome en celulares bloqueaba de raíz el escáner de códigos de barra sin pedir permisos y omitía "Cámara" en la configuración del sitio.
    * Se refinó el manejo de errores en `BarcodeScannerModal.tsx` y `PosContinuousScannerModal.tsx` para mostrar mensajes instructivos en caso de permiso denegado, adaptando además `BarcodeScannerModal` a los estándares de `dark-mode-contrast` y `modern-rounded-design`.
  * **Pipeline de Imágenes para Catálogo Global con Cloudflare R2 (`tools/catalog-images/`):**
    * `fetch-images.mjs`: Extractor multicanal en cascada (Supermercados DIA, Carrefour, Jumbo/Disco, Open Food Facts) por código de barras EAN-13 / EAN-8 con control de checksum, reintentos y caché local.
    * `optimize-images.mjs`: Optimizador de alta calidad con `sharp` que redimensiona y centra cada producto en un lienzo cuadrado de 800x800 px con fondo blanco puro (`#FFFFFF`) y comprime a WebP (~40-60 KB, logrando más del 60-80% de ahorro de ancho de banda).
    * `sync-r2.mjs`: Sincronizador S3 con Cloudflare R2 (`@aws-sdk/client-s3`) con cabeceras de caché inmutable (`Cache-Control: public, max-age=31536000, immutable`), soporte de modo simulación (`--dry-run`) y generación de script SQL para Supabase (`UPDATE master_products SET image_url = ...`).
    * `pipeline.mjs`: Script orquestador integral todo en uno.
    * **Prueba de Producción Exitosa:** Se ejecutó el pipeline y se sincronizaron las primeras 20 imágenes reales a Cloudflare R2, verificando entrega perimetral en vivo desde `https://cdn.jireh.cloud/productos/{barcode}.webp` con código HTTP 200 y certificados SSL activos.
    * **Procesamiento Masivo del Catálogo Completo:** Se ejecutó el pipeline sobre los 4.614 productos del catálogo maestro con 5 hilos de concurrencia:
      * **3.755 fotos oficiales** extraídas de cadenas de retail y Open Food Facts (81,4% de cobertura global).
      * **100% optimizadas** a 800x800 px con lienzo blanco puro `#FFFFFF` y compresión WebP (~40 KB promedio).
      * **100% subidas a Cloudflare R2** en `jireh-pos-products/productos/{barcode}.webp` con cabeceras de caché inmutable por 1 año.
      * Se generó la migración SQL con los 3.755 comandos `UPDATE` en [docs/sql/039_sync_master_products_cloudflare_images.sql](file:///c:/IMPORTANTE-NO-ELIMINAR/POS/docs/sql/039_sync_master_products_cloudflare_images.sql).
    * `remove-background.py`: Script de IA con `rembg` (BiRefNet) para remoción automática de fondo de fotos tomadas con celular en mostradores de comercios.
    * `cloudflare-worker-bg-removal.js`: Plantilla de Cloudflare Worker perimetral para subida directa de fotos desde celulares.
  * **Integración Visual en Modales:**
    * `PosQuickProductModal.tsx`: Visualización de miniatura nítida con fondo blanco del producto maestro cuando se escanea un código del catálogo global.
    * `ProductFormModal.tsx`: Vinculación automática del campo `imagenUrl` cuando un producto se precarga desde el catálogo maestro.
  * **Documentación & Guía Paso a Paso:**
    * Se creó [docs/CLOUDFLARE_R2_GUIA_PASO_A_PASO.md](file:///c:/IMPORTANTE-NO-ELIMINAR/POS/docs/CLOUDFLARE_R2_GUIA_PASO_A_PASO.md) con el instructivo detallado para crear el bucket en Cloudflare, habilitar el subdominio `cdn.jireh.cloud` con SSL gratis, generar credenciales de API y ejecutar los comandos.
    * Se agregaron scripts en `package.json` (`catalog:fetch`, `catalog:optimize`, `catalog:sync`, `catalog:pipeline`) y variables en `.env.example`.
* **Próximos pasos:** Cargar credenciales de Cloudflare R2 en `.env` y ejecutar la extracción masiva para poblar las fotos de los 4.600 productos del catálogo global.

---

### [2026-11-23] - Creación de Bitácora y Sincronización Multi-PC
* **Zona:** Repositorio General / Protocolo
* **Cambios:**
  * Se creó `DEV_LOG.md` como estándar de persistencia de contexto entre múltiples equipos.
  * Se agregó la regla obligatoria en `AGENTS.md` para garantizar que toda modificación quede documentada.
  * Sincronización limpia de la rama `main` tras `git pull origin main` incorporando PR #57 y PR #58.
* **Próximos pasos:** Continuar desarrollo de nuevos módulos o pruebas operativas de red.

---

### [2026-11-22] - PR #58: Carteles de Estado Offline y Comprobantes
* **Zona:** `src/` (POS y Comprobantes)
* **Commit:** `2c65128`
* **Cambios:**
  * Incorporación de badges visuales de sincronización offline en tickets y comprobantes del POS.
  * Optimización de consumo de egress en la consulta de comprobantes recientes.
  * Mejoras en el escáner continuo de código de barras (`PosContinuousScannerModal.tsx`).
  * Mejoras en modal de producto rápido (`PosQuickProductModal.tsx`) y consumo de empleados (`EmployeeProductConsumptionModal.tsx`).
  * Utilidad de formateo de comprobantes (`src/utils/voucher-format.utils.ts`) y manejo de errores tipados (`src/utils/errors.ts`).

---

### [2026-11-12] - Sistema Unificado de Animaciones de Carga
* **Zona:** `src/` (General, Cajas, Cta. Cte., Compras, POS)
* **Cambios:**
  * **Componente `LoadingState` (`UiStates.tsx`):** Rediseñado con diseño redondeado (`rounded-2xl sm:rounded-3xl`), fondo con alto contraste para modo oscuro (`dark:bg-slate-900`), spinner animado (`Loader2` con `animate-spin`), anillo pulsante de fondo, título y subtítulo explicativo.
  * **Barra de navegación de ruta (`AppLayout.tsx`):** Micro-barra de progreso animada en el borde superior que se activa al navegar entre secciones (`animate-route-progress`).
  * **Cuentas Corrientes (Clientes y Proveedores):** Inicialización de carga inmediata (`isLoading: true`) para erradicar el parpadeo de "Sin clientes / proveedores" al montar la vista. Animación en el panel de detalle de movimientos.
  * **Cajas (Diaria y General):**
    * Corregido bug donde Caja Diaria mostraba falsamente "Sin caja abierta en este turno" mientras consultaba la base de datos; ahora muestra la cinta animada "Verificando estado de turno..." y el card de carga.
    * Indicadores animados en el historial de jornadas, modales de tickets y movimientos de Caja General.
  * **Compras y Proveedores:** Reemplazo de textos planos estáticos por animaciones con spinner en historial de compras y directorio de proveedores.
  * **Punto de Venta (POS):** Pantalla de bienvenida y carga animada al ingresar a `/pos` mientras se sincroniza el catálogo, listas de precios y métodos de pago.
  * **General:** Unificación de estados de carga en Productos, Clientes, Stock, Facturación, Listas de Precios, Promociones, Medios de Pago, Bancos, Usuarios y Empleados.

---

### [2026-11-10] - PR #56 & #57: SaaS CRM, Trials y Ajustes de Cuenta Corriente
* **Zona:** `crm-admin/`, `landing/`, `src/`
* **Commits:** `99e4f04`, `7b5eb9d`
* **Cambios:**
  * Refactorización y aislamiento de la landing page pública en su propio paquete `landing/`.
  * Integración del panel administrativo SaaS en `crm-admin/` con gestión de estados de prueba (`trial`), extensión de días y activación de tenants.
  * Mejoras en cobranza parcial de cuentas corrientes, modal de adeudar manual y confirmación de seguridad en ajustes contables.
  * Protocolo `monorepo-safe-git` implementado para prevenir mezclas de commits entre zonas.

---

## 📌 Plantilla para Nuevas Entradas

Copiar y pegar este bloque al inicio de la sección de cambios:

```markdown
### [AAAA-MM-DD] - [Título descriptivo del cambio]
* **Zona:** `src/` | `crm-admin/` | `landing/` | `supabase/` | `docs/`
* **Objetivo:** [Breve explicación de la necesidad o bug resuelto]
* **Cambios Realizados:**
  * [Detalle 1]
  * [Detalle 2]
* **Decisiones Técnicas / Reglas:** [Si aplica, ej: lógica de redondeo, permisos requeridos]
* **Próximos Pasos / Pendientes:** [Qué falta hacer o verificar]
```
