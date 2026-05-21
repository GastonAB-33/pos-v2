-- Guarda en cada cliente la regla vigente para mostrar saldo actualizado
-- de cuenta corriente sin crear movimientos contables de recargo/ajuste.
--
-- La deuda original y los pagos siguen en current_account_movements.
-- Estas columnas solo indican como recalcular visualmente el saldo actualizado.

alter table public.customers
  add column if not exists current_account_pricing_mode text not null default 'original',
  add column if not exists current_account_surcharge_percent numeric,
  add column if not exists current_account_surcharge_amount numeric,
  add column if not exists current_account_pricing_updated_at timestamptz;

alter table public.customers
  drop constraint if exists customers_current_account_pricing_mode_check;

alter table public.customers
  add constraint customers_current_account_pricing_mode_check
  check (
    current_account_pricing_mode in (
      'original',
      'today_prices',
      'surcharge_percentage',
      'surcharge_fixed'
    )
  );

update public.customers
set current_account_pricing_mode = 'original'
where current_account_pricing_mode is null;

select
  id,
  full_name,
  current_account_pricing_mode,
  current_account_surcharge_percent,
  current_account_surcharge_amount,
  current_account_pricing_updated_at
from public.customers
where current_account_enabled is true
order by full_name;
