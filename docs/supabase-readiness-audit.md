# Auditoria de preparacion Supabase / multi-tenant

Fecha: 2026-05-09

## Objetivo

Determinar que falta para que el POS funcione con datos reales en Supabase, con tenants independientes:

- Tenant demo propio para pruebas.
- Tenant del comercio real de la madre del propietario.
- Usuarios y contrasenas reales por comercio.
- Aislamiento fuerte: cada comercio solo ve sus clientes, productos, ventas, caja y cuentas corrientes.

## Estado actual observado

El frontend esta preparado conceptualmente para multi-tenant: casi todos los servicios operativos reciben `tenantId` y escriben/leen usando `tenant_id`.

El repositorio no contiene migraciones SQL completas. Solo existe `docs/sql/fix-missing-tenants-for-pos.sql`, que es un script de reparacion para tenants faltantes, no un esquema inicial completo.

El login actual no usa Supabase Auth. En modo mock crea un tenant demo y un usuario admin de desarrollo. En modo Supabase valida usuarios contra tablas propias (`tenants`, `users`, `permission_profiles`), pero no hay autenticacion real de contrasena en el contrato de servicios actual.

El formulario de usuarios pide `password` y `confirmPassword`, pero `useUsersModule.createUser` y `useUsersModule.updateUser` no envian esos campos a ningun servicio de autenticacion ni a Supabase Auth.

## Tablas requeridas por el frontend

Segun `src/lib/database/tables.ts` y `src/types/entities/mvp.entities.ts`, el sistema espera estas tablas:

### Global

- `tenants`

### Tenant-scoped

- `permission_profiles`
- `users`
- `products`
- `product_barcodes`
- `customers`
- `suppliers`
- `payment_methods`
- `bank_accounts`
- `origin_banks`
- `installment_plans`
- `price_lists`
- `price_list_items`
- `promotions`
- `purchases`
- `purchase_items`
- `current_account_movements`
- `sales`
- `sale_items`
- `sale_payments`
- `receipts`
- `invoices`
- `credit_notes`
- `tenant_settings`
- `stock_movements`
- `cash_sessions`
- `cash_movements`

Todas las tenant-scoped deben tener:

- `id`
- `tenant_id`
- `created_at`
- `updated_at`
- FK a `tenants(id)`
- indice por `tenant_id`
- RLS habilitado

Excepcion: `audit_logs` tambien es tenant-scoped, pero no extiende `TenantScopedEntity` porque no tiene `updated_at`.

## Brechas bloqueantes para datos reales

### 1. Migraciones SQL completas

Falta versionar el esquema completo. Sin esto no hay forma confiable de recrear la base ni auditar drift entre frontend y Supabase.

Requerido:

- `CREATE TABLE` de todas las tablas.
- Tipos correctos: `numeric`, `boolean`, `text`, `jsonb`, `timestamptz`.
- Defaults para `id`, `created_at`, `updated_at`.
- Foreign keys.
- Unique constraints por tenant.
- Indices de lectura habituales.

### 2. Supabase Auth

Para usuarios reales con contrasena, se recomienda usar Supabase Auth como fuente de identidad:

- `auth.users` guarda credenciales.
- `public.users.auth_user_id` debe referenciar `auth.users.id`.
- `public.users.tenant_id` define a que comercio pertenece.
- `public.users.permission_profile_id` define permisos dentro del sistema.

El alta de usuarios desde el sistema no puede hacerse de forma segura solo desde el frontend con anon key. Crear usuarios Auth para empleadas requiere una operacion privilegiada:

- Edge Function con service role, o
- backend propio, o
- flujo de invitacion de Supabase Auth.

### 3. RLS por tenant

No alcanza con filtrar desde React. Cada tabla debe tener Row Level Security.

Modelo recomendado:

- Funcion `public.current_tenant_id()` que obtenga el tenant del usuario autenticado desde `public.users`.
- Politicas `select/insert/update/delete` que comparen `tenant_id = public.current_tenant_id()`.
- Politica especial para `tenants`: el usuario solo puede leer su propio tenant.
- Politicas especiales para bootstrap/admin, si existen.

### 4. Alta inicial del comercio real

Debe existir un bootstrap controlado para:

- Crear tenant del comercio de tu madre.
- Crear usuario admin/duena en Supabase Auth.
- Crear fila en `public.users` vinculada a ese `auth.users.id`.
- Crear perfil `Administrador`.
- Crear `tenant_settings`.
- Crear medios de pago por defecto.
- Crear bancos/planes por defecto si corresponde.

### 5. Modulo usuarios incompleto para contrasenas reales

El UI ya pide contrasena, pero hoy no se usa. Hay que conectar:

- Crear usuario: crear `auth.users` + crear `public.users`.
- Editar usuario: actualizar datos propios; si se cambia contrasena, llamar endpoint privilegiado.
- Desactivar usuario: marcar `public.users.is_active=false`; opcionalmente bloquear auth.
- Eliminar usuario: preferible desactivar, no borrar si tiene ventas/caja/auditoria.

## SQL de auditoria para ejecutar en Supabase

Ejecutar en Supabase SQL Editor para comparar la base real con el contrato esperado.

### Tablas existentes

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

### Columnas por tabla POS

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tenants',
    'permission_profiles',
    'users',
    'products',
    'product_barcodes',
    'customers',
    'suppliers',
    'payment_methods',
    'bank_accounts',
    'origin_banks',
    'installment_plans',
    'price_lists',
    'price_list_items',
    'promotions',
    'purchases',
    'purchase_items',
    'current_account_movements',
    'sales',
    'sale_items',
    'sale_payments',
    'receipts',
    'invoices',
    'credit_notes',
    'audit_logs',
    'tenant_settings',
    'stock_movements',
    'cash_sessions',
    'cash_movements'
  )
order by table_name, ordinal_position;
```

### Foreign keys

```sql
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;
```

### RLS habilitado

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

### Politicas RLS

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### Indices relevantes

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### Usuarios vinculados a Auth

Si se adopta Supabase Auth, esta consulta debe mostrar usuarios internos con identidad Auth:

```sql
select
  u.id,
  u.tenant_id,
  t.trade_name,
  u.email,
  u.username,
  u.full_name,
  u.permission_profile_id,
  u.is_active,
  u.auth_user_id,
  au.email as auth_email,
  au.created_at as auth_created_at
from public.users u
left join auth.users au on au.id = u.auth_user_id
left join public.tenants t on t.id = u.tenant_id
order by t.trade_name, u.full_name;
```

## Flujo objetivo de produccion

1. El propietario entra con su tenant demo.
2. La madre entra con su email/contrasena y cae en el tenant de su comercio.
3. Desde `Usuarios`, la madre crea 3 empleadas.
4. Cada empleada recibe credenciales propias o invitacion.
5. Cada empleada solo ve el tenant del comercio.
6. Ventas, clientes, productos, caja y cuentas corrientes quedan con `tenant_id` del comercio.
7. El propietario no mezcla datos de demo con datos reales.

## Prueba de aceptacion minima

Crear dos tenants:

- `Demo POS`
- Comercio real de la madre

Crear usuarios:

- Admin demo.
- Admin madre.
- Empleada 1, 2 y 3 del comercio real.

Validar:

- Admin demo crea un producto y cliente demo.
- Admin madre no ve producto ni cliente demo.
- Admin madre crea producto, cliente, abre caja y vende.
- Empleada puede vender si su perfil tiene permiso POS.
- Empleada sin permiso `usuarios.write` no puede crear usuarios.
- Venta real crea registros en `sales`, `sale_items`, `sale_payments`, `stock_movements`, `cash_movements`, `receipts`.
- Venta a cuenta corriente crea `current_account_movements` y actualiza `customers.current_balance`.
- Cierre de caja refleja ventas reales del tenant correcto.

## Recomendacion de implementacion

Orden recomendado:

1. Crear migracion SQL base completa.
2. Agregar RLS y funciones helper de tenant.
3. Cambiar login a Supabase Auth.
4. Implementar bootstrap de tenant + usuario admin.
5. Implementar alta de usuarios con Edge Function/backend.
6. Correr prueba multi-tenant cruzada.
7. Recien despues habilitar uso con ventas reales.
