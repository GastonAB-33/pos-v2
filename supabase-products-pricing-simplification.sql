-- POS V2 - Ajuste progresivo para modulo Productos simplificado
-- No elimina columnas legacy. Solo agrega y completa datos de pricing.

BEGIN;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS price_without_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS vat_percent numeric(10,2),
  ADD COLUMN IF NOT EXISTS profit_percent numeric(10,2);

UPDATE public.products
SET vat_percent = COALESCE(vat_percent, 21)
WHERE vat_percent IS NULL;

UPDATE public.products
SET price_without_vat = ROUND(
  (
    COALESCE(price, 0) / NULLIF(1 + (COALESCE(vat_percent, 21) / 100.0), 0)
  )::numeric,
  2
)
WHERE price_without_vat IS NULL;

UPDATE public.products
SET profit_percent = CASE
  WHEN COALESCE(cost_price, 0) > 0 THEN
    ROUND((((COALESCE(price_without_vat, 0) - cost_price) / cost_price) * 100)::numeric, 2)
  ELSE
    0
END
WHERE profit_percent IS NULL;

COMMIT;
