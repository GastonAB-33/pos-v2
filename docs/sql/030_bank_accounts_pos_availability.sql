-- 030_bank_accounts_pos_availability.sql
-- Habilita el control de disponibilidad de cuentas bancarias en el modal de cobro del POS.

begin;

alter table public.bank_accounts
add column if not exists is_pos_available boolean not null default true;

comment on column public.bank_accounts.is_pos_available is
  'Indica si esta cuenta bancaria o billetera está disponible para recibir transferencias en el modal de cobro del POS';

commit;
