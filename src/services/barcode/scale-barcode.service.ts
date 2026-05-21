import type { BarcodeScaleSettings } from "@/types/entities";

export interface ParsedScaleBarcode {
  raw: string;
  productCode: string;
  mode: "weight" | "total_price";
  weight: number | null;
  totalPrice: number | null;
}

const digitsOnly = (value: string): string => value.replace(/\D+/g, "");

const round = (value: number, decimals = 3): number => Number(value.toFixed(decimals));

const safeSlice = (value: string, start: number, length: number): string => {
  if (start < 0 || length <= 0) return "";
  return value.slice(start, start + length);
};

const isValidEan13 = (value: string): boolean => {
  if (!/^\d{13}$/.test(value)) return false;

  const digits = [...value].map(Number);
  const checkDigit = digits[12];
  const checksumBase = digits
    .slice(0, 12)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
  const expectedCheckDigit = (10 - (checksumBase % 10)) % 10;
  return checkDigit === expectedCheckDigit;
};

const parseDecimalValue = (raw: string, decimals: number): number | null => {
  if (!raw) return null;
  const numeric = Number.parseInt(raw, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const divisor = 10 ** Math.max(0, decimals);
  return round(numeric / divisor, decimals);
};

const parseWeight = (raw: string, decimals: number): number | null =>
  parseDecimalValue(raw, decimals);

const parseTotalPrice = (raw: string, decimals: number): number | null =>
  parseDecimalValue(raw, decimals);

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

  if (settings.ean13_enabled && !isValidEan13(normalized)) {
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
  const mode = settings.scale_mode ?? "weight";

  const weight =
    mode === "weight" ? parseWeight(weightRaw, settings.weight_decimals ?? 3) : null;
  const totalPrice =
    mode === "total_price" || amountRaw !== weightRaw
      ? parseTotalPrice(amountRaw, settings.amount_decimals ?? 2)
      : null;

  if (mode === "weight" && weight == null) return null;
  if (mode === "total_price" && totalPrice == null) return null;

  return {
    raw: normalized,
    productCode,
    mode,
    weight,
    totalPrice,
  };
};
