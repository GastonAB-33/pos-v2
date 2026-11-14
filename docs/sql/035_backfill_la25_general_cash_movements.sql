-- 035_backfill_la25_general_cash_movements.sql
-- Migración retroactiva: Carga el histórico de aperturas y cierres de Caja Diaria en Caja General para La25.

do $$
declare
  v_tenant_id text;
  v_inserted_count int;
begin
  -- 1. Obtener ID del tenant La25
  select id into v_tenant_id
  from public.tenants
  where lower(trade_name) in ('la25', 'la 25') or id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
  limit 1;

  if v_tenant_id is null then
    raise exception 'No se encontró el tenant La25.';
  end if;

  -- 2. Limpiar registros automáticos previos en general_cash_movements para La25 (idempotencia)
  delete from public.general_cash_movements
  where tenant_id = v_tenant_id
    and origin_type in ('daily_cash_open', 'daily_cash_close');

  -- 3. Insertar eventos históricos con cálculo de saldo acumulado (balance_after)
  with raw_events as (
    -- Egresos por fondos de apertura entregados a Caja Diaria
    select
      gen_random_uuid()::text as id,
      tenant_id,
      'expense'::text as type,
      opening_amount as amount,
      'daily_cash_open'::text as origin_type,
      ('Fondo inicial para apertura de Caja diaria - Sesión #' || right(id, 6))::text as concept,
      id as reference_id,
      'Migración histórica de apertura'::text as notes,
      opened_by_user_id as created_by,
      opened_at as created_at,
      opened_at as updated_at
    from public.cash_sessions
    where tenant_id = v_tenant_id
      and opening_amount > 0

    union all

    -- Ingresos por recaudación de cierre de Caja Diaria
    select
      gen_random_uuid()::text as id,
      tenant_id,
      'income'::text as type,
      closing_amount as amount,
      'daily_cash_close'::text as origin_type,
      ('Ingreso por cierre de Caja diaria - Sesión #' || right(id, 6))::text as concept,
      id as reference_id,
      'Migración histórica de cierre'::text as notes,
      coalesce(closed_by_user_id, opened_by_user_id) as created_by,
      coalesce(closed_at, opened_at + interval '8 hours') as created_at,
      coalesce(closed_at, opened_at + interval '8 hours') as updated_at
    from public.cash_sessions
    where tenant_id = v_tenant_id
      and status = 'closed'
      and closing_amount > 0
  ),
  ordered_events as (
    select
      id,
      tenant_id,
      type,
      amount,
      origin_type,
      concept,
      reference_id,
      notes,
      created_by,
      created_at,
      updated_at,
      round(
        sum(case when type = 'income' then amount else -amount end)
        over (order by created_at asc, id asc),
        2
      ) as balance_after
    from raw_events
  )
  insert into public.general_cash_movements (
    id,
    tenant_id,
    type,
    amount,
    origin_type,
    concept,
    balance_after,
    reference_id,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    id,
    tenant_id,
    type,
    amount,
    origin_type,
    concept,
    balance_after,
    reference_id,
    notes,
    created_by,
    created_at,
    updated_at
  from ordered_events;

  get diagnostics v_inserted_count = row_count;
  raise notice 'Se migraron exitosamente % movimientos a Caja General para La25.', v_inserted_count;
end $$;
