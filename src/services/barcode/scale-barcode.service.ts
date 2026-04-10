import type { BarcodeScaleSettings } from "@/types/entities";

export interface ParsedScaleBarcode {
  raw: string;
  productCode: string;
  weight: number | null;
  totalPrice: number | null;
}

const digitsOnly = (value: string): string => value.replace(/\D+/g, "");

const round = (value: number, decimals = 3): number => Number(value.toFixed(decimals));

const safeSlice = (value: string, start: number, length: number): string => {
  if (start < 0 || length <= 0) return "";
  return value.slice(start, start + length);
};

const parseWeight = (raw: string): number | null => {
  if (!raw) return null;
  const numeric = Number.parseInt(raw, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  // Convencion base EAN13 balanza: gramos en 3 decimales.
  return round(numeric / 1000, 3);
};

const parseTotalPrice = (raw: string): number | null => {
  if (!raw) return null;
  const numeric = Number.parseInt(raw, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  // Convencion base: importe con 2 decimales.
  return round(numeric / 100, 2);
};

export const parseScaleBarcode = (
  barcode: string,
  settings: BarcodeScaleSettings
): ParsedScaleBarcode | null => {
  if (!settings.scale_parser_enabled) return null;

  const normalized = digitsOnly(barcode.trim());
  if (!normalized) return null;

  if (settings.ean13_enabled && normalized.length !== 13) {
    return null;
  }

  if (settings.code_length > 0 && normalized.length !== settings.code_length) {
    return null;
  }

  const prefix = digitsOnly(settings.scale_prefix);
  if (prefix && !normalized.startsWith(prefix)) {
    return null;
  }

  const pluStart = Math.max(0, settings.plu_start - 1);
  const weightStart = Math.max(0, settings.weight_start - 1);
  const amountStart = Math.max(0, settings.amount_start - 1);

  const productCode = safeSlice(normalized, pluStart, settings.plu_length);
  if (!productCode) return null;

  const weightRaw = safeSlice(normalized, weightStart, settings.weight_length);
  const amountRaw = safeSlice(normalized, amountStart, settings.amount_length);

  const weight = parseWeight(weightRaw);
  const totalPrice = parseTotalPrice(amountRaw);

  return {
    raw: normalized,
    productCode,
    weight,
    totalPrice,
  };
};
