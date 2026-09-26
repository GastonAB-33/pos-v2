-- ========================================================
-- Migración 030: Cierre de Caja Ciego, Desglose de Billetes y Verificación en 2 Pasos
-- ========================================================

ALTER TABLE IF EXISTS public.cash_sessions
  ADD COLUMN IF NOT EXISTS is_blind_close BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS counted_denominations JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS declared_other_payments JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_verification_status
  ON public.cash_sessions (tenant_id, verification_status);
