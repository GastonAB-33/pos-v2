-- Configura La25 para etiquetas EAN13 de balanza por importe total.
-- Ejemplo real de etiqueta: 2001015160008
-- Formato interpretado: 20 + PLU(4) + importe(6, 2 decimales) + digito EAN13
--
-- 2001015160008 => PLU 0101, total 5160.00.
-- Si el producto 0101 cuesta 24000.00 por kg, el POS calcula 0.215 kg.

update public.tenant_settings
set
  codigos_balanza = jsonb_build_object(
    'scale_parser_enabled', true,
    'scale_mode', 'total_price',
    'scale_prefix', '20',
    'code_length', 13,
    'plu_start', 3,
    'plu_length', 4,
    'weight_start', 7,
    'weight_length', 5,
    'weight_decimals', 3,
    'amount_start', 7,
    'amount_length', 6,
    'amount_decimals', 2,
    'ean13_enabled', true
  ),
  updated_at = now()
where tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe';

select
  tenant_id,
  codigos_balanza
from public.tenant_settings
where tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe';
