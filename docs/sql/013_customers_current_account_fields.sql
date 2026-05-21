-- 013_customers_current_account_fields.sql
-- POS V2 - Persistencia real de cuenta corriente por cliente.
--
-- Ejecutar despues de 010_fix_tenant_rls_policies.sql.
-- Agrega configuracion de cuenta corriente al cliente para que no dependa
-- de localStorage del navegador.

begin;

alter table public.customers
  add column if not exists current_account_enabled boolean not null default false,
  add column if not exists current_account_limit numeric null;

update public.customers
set current_account_enabled = true,
    current_account_limit = null,
    updated_at = now()
where tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
  and document_number = '99900001'
  and full_name = 'Cliente Prueba Codex';

commit;

select
  id,
  tenant_id,
  full_name,
  document_number,
  current_balance,
  current_account_enabled,
  current_account_limit
from public.customers
where tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
order by created_at desc;
