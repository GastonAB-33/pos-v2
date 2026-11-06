-- ==============================================================================
-- 034_saas_subscriptions_and_crm.sql
-- MIGRACIÓN SAAS V2: SUSCRIPCIONES, CONTROL DE TRIAL (7 DÍAS) Y TABLAS DE CRM
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. EXTENDER TABLA 'tenants' CON CAMPOS DE LICENCIAMIENTO Y SUSCRIPCIÓN
-- ------------------------------------------------------------------------------
alter table public.tenants
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists trial_ends_at timestamptz default (now() + interval '7 days'),
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists plan_id text default 'formalizando',
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists mrr_amount numeric(12,2) default 40000.00,
  add column if not exists max_branches integer default 1,
  add column if not exists max_users integer default 5,
  add column if not exists notes text;

-- Restricción de estados válidos de suscripción
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_tenants_subscription_status'
  ) then
    alter table public.tenants
      add constraint check_tenants_subscription_status
      check (subscription_status in ('trial', 'active', 'past_due', 'suspended', 'cancelled'));
  end if;
end $$;

-- Asegurar que los tenants existentes tengan fechas válidas
update public.tenants
set 
  subscription_status = coalesce(subscription_status, 'active'),
  trial_ends_at = coalesce(trial_ends_at, now() + interval '30 days'),
  subscription_ends_at = coalesce(subscription_ends_at, now() + interval '1 year'),
  plan_id = coalesce(plan_id, 'formalizando')
where subscription_status is null or trial_ends_at is null;

-- ------------------------------------------------------------------------------
-- 2. TABLA DE LEADS Y CONTACTOS DEL CRM (crm_leads)
-- ------------------------------------------------------------------------------
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id text references public.tenants(id) on delete set null,
  business_name text not null,
  contact_name text not null,
  email text,
  phone text not null,
  category text default 'Almacén y Kiosco',
  city text,
  province text,
  stage text not null default 'trial', -- 'lead', 'trial', 'contacted', 'won', 'lost'
  selected_plan text default 'Plan "Me Estoy Formalizando"',
  estimated_mrr numeric(12,2) default 40000.00,
  source text default 'landing_page', -- 'landing_page', 'whatsapp', 'referral', 'direct'
  trial_started_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '7 days'),
  converted_at timestamptz,
  lost_reason text,
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. TABLA DE ACTIVIDADES Y NOTAS DEL CRM (crm_activities)
-- ------------------------------------------------------------------------------
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  tenant_id text references public.tenants(id) on delete cascade,
  activity_type text not null, -- 'call', 'whatsapp', 'email', 'note', 'trial_extended', 'manual_activation'
  title text not null,
  description text,
  author_name text default 'SuperAdmin',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. HISTORIAL DE FACTURACIÓN Y COBRANZAS (tenant_billing_transactions)
-- ------------------------------------------------------------------------------
create table if not exists public.tenant_billing_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'ARS',
  payment_method text not null, -- 'mercadopago', 'transfer', 'cash', 'card'
  payment_status text not null default 'approved', -- 'pending', 'approved', 'rejected', 'refunded'
  plan_id text not null,
  billing_cycle text not null default 'monthly', -- 'monthly', 'annual'
  period_start timestamptz not null,
  period_end timestamptz not null,
  gateway_payment_id text, -- ID de transacción de Mercado Pago
  gateway_receipt_url text,
  manual_reference text,   -- Comprobante bancario / número de transferencia
  verified_by text,        -- Quién verificó la transferencia
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. ÍNDICES DE RENDIMIENTO PARA CRM Y DASHBOARD
-- ------------------------------------------------------------------------------
create index if not exists idx_tenants_subscription_status on public.tenants(subscription_status);
create index if not exists idx_tenants_trial_ends_at on public.tenants(trial_ends_at);
create index if not exists idx_crm_leads_stage on public.crm_leads(stage);
create index if not exists idx_crm_leads_tenant_id on public.crm_leads(tenant_id);
create index if not exists idx_billing_transactions_tenant on public.tenant_billing_transactions(tenant_id);

-- ------------------------------------------------------------------------------
-- 6. SEGURIDAD Y POLÍTICAS RLS (AISLAMIENTO TOTAL)
-- ------------------------------------------------------------------------------
-- Solo usuarios con rol 'superadmin' o la service_role key pueden acceder al CRM
alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
alter table public.tenant_billing_transactions enable row level security;

-- Política para crm_leads: Los tenants normales no pueden leer leads de otros ni de su propio CRM
create policy "SuperAdmin full access on crm_leads"
  on public.crm_leads
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_user_id = auth.uid()
      and u.role = 'superadmin'
    )
  );

create policy "SuperAdmin full access on crm_activities"
  on public.crm_activities
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_user_id = auth.uid()
      and u.role = 'superadmin'
    )
  );

create policy "SuperAdmin full access on tenant_billing_transactions"
  on public.tenant_billing_transactions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_user_id = auth.uid()
      and u.role = 'superadmin'
    )
  );

-- Cada tenant puede ver ÚNICAMENTE sus propias transacciones de pago
create policy "Tenants can view own billing transactions"
  on public.tenant_billing_transactions
  for select
  to authenticated
  using (
    tenant_id in (
      select u.tenant_id from public.users u
      where u.auth_user_id = auth.uid()
    )
  );

commit;
