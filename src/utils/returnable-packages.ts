import { useState, useEffect, useCallback } from "react";
import { settingsService } from "@/services/settings.service";
import { productsService } from "@/services/products.service";
import type { ReturnablePackageType } from "@/types/entities";
/**
 * Utilidades y helpers para la gestión de envases retornables
 * (Garrafas de gas, bidones de agua, botellas de cerveza y gaseosas).
 */

export interface ReturnableConfig {
  enabled: boolean;
  packageName: string;
  packagePrice: number;
}

export type ReturnableCartStatus = "exchange" | "charge" | "owe";

export const COMMON_RETURNABLE_PACKAGES: Array<{ name: string; suggestedPrice: number }> = [
  { name: "Garrafa 10kg", suggestedPrice: 45000 },
  { name: "Garrafa 15kg", suggestedPrice: 60000 },
  { name: "Tubo de Gas 45kg", suggestedPrice: 120000 },
  { name: "Bidón 20L Agua", suggestedPrice: 8000 },
  { name: "Bidón 12L / 10L Agua", suggestedPrice: 6000 },
  { name: "Botella Cerveza 1L", suggestedPrice: 800 },
  { name: "Botella Coca 2L / 2.5L", suggestedPrice: 1200 },
  { name: "Cajón Cerveza x 12", suggestedPrice: 12000 },
  { name: "Sifón de Soda", suggestedPrice: 3500 },
];

const RETURNABLE_REGEX = /\[ENV_RETORNABLE:([^:]+):([0-9.]+)\]/;
const PACKAGE_DEBTS_REGEX = /\[ENV_DEUDA:(\{.*?\})\]/;

/**
 * Extrae la configuración de envase retornable desde la descripción del producto.
 */
export const parseReturnableConfig = (
  description: string | null | undefined
): ReturnableConfig | null => {
  if (!description) return null;
  const match = description.match(RETURNABLE_REGEX);
  if (!match) return null;

  return {
    enabled: true,
    packageName: match[1].trim(),
    packagePrice: Number(match[2]) || 0,
  };
};

/**
 * Serializa la configuración de envase retornable dentro de la descripción del producto,
 * preservando cualquier texto que el usuario haya ingresado.
 */
export const serializeReturnableConfig = (
  baseDescription: string | null | undefined,
  config: ReturnableConfig | null
): string => {
  const clean = (baseDescription ?? "")
    .replace(/\s*\[ENV_RETORNABLE:[^\]]+\]\s*/g, " ")
    .trim();

  if (!config || !config.enabled || !config.packageName.trim()) {
    return clean;
  }

  const tag = `[ENV_RETORNABLE:${config.packageName.trim()}:${Math.max(0, config.packagePrice)}]`;
  return clean ? `${clean} ${tag}` : tag;
};

/**
 * Limpia la descripción para mostrar al usuario sin las etiquetas técnicas internas.
 */
export const getCleanDescription = (description: string | null | undefined): string => {
  if (!description) return "";
  return description
    .replace(/\s*\[ENV_RETORNABLE:[^\]]+\]\s*/g, " ")
    .replace(/\s*\[NO_STOCK_TRACK\]\s*/g, " ")
    .replace(/\s*__ARCHIVED_DELETED__\s*/g, " ")
    .trim();
};

/**
 * Extrae las deudas de envases físicos desde las observaciones del cliente.
 * Formato devuelto: Record<packageName, quantityOwed>
 */
export const parseCustomerPackageDebts = (
  observations: string | null | undefined
): Record<string, number> => {
  if (!observations) return {};
  const match = observations.match(PACKAGE_DEBTS_REGEX);
  if (!match) return {};

  try {
    const parsed = JSON.parse(match[1]);
    if (typeof parsed !== "object" || parsed === null) return {};

    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed)) {
      const qty = Number(val);
      if (Number.isFinite(qty) && qty > 0) {
        result[key] = qty;
      }
    }
    return result;
  } catch {
    return {};
  }
};

/**
 * Serializa las deudas de envases en las observaciones del cliente preservando el texto libre.
 */
export const serializeCustomerPackageDebts = (
  baseObservations: string | null | undefined,
  debts: Record<string, number>
): string => {
  const clean = (baseObservations ?? "")
    .replace(/\s*\[ENV_DEUDA:\{.*?\}\]\s*/g, " ")
    .trim();

  // Filtrar solo las que tengan saldo > 0
  const activeDebts: Record<string, number> = {};
  for (const [key, val] of Object.entries(debts)) {
    const qty = Number(val);
    if (Number.isFinite(qty) && qty > 0) {
      activeDebts[key] = qty;
    }
  }

  if (Object.keys(activeDebts).length === 0) {
    return clean;
  }

  const tag = `[ENV_DEUDA:${JSON.stringify(activeDebts)}]`;
  return clean ? `${clean}\n${tag}` : tag;
};

/**
 * Limpia las observaciones del cliente para mostrar en pantalla sin el bloque técnico.
 */
export const getCleanCustomerObservations = (
  observations: string | null | undefined
): string => {
  if (!observations) return "";
  return observations.replace(/\s*\[ENV_DEUDA:\{.*?\}\]\s*/g, " ").trim();
};

/**
 * Obtiene los tipos de envases retornables configurados para el comercio (tenant).
 * Si no están explícitamente en la configuración de stock, inspecciona los productos del catálogo.
 */
export const fetchTenantReturnablePackages = async (
  tenantId: string
): Promise<ReturnablePackageType[]> => {
  try {
    const settings = await settingsService.getByTenant(tenantId);
    const configured = settings?.stock?.returnable_packages;

    if (Array.isArray(configured) && configured.length > 0) {
      return configured;
    }

    // Si no hay lista en configuración, extraer envases usados en productos
    const products = await productsService.getAllByTenant(tenantId);
    const map = new Map<string, ReturnablePackageType>();

    for (const p of products) {
      const config = parseReturnableConfig(p.description);
      if (config && config.enabled && config.packageName.trim()) {
        const key = config.packageName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: config.packageName.trim(),
            suggestedPrice: config.packagePrice,
          });
        }
      }
    }

    return Array.from(map.values());
  } catch (err) {
    console.error("Error al obtener envases retornables del tenant:", err);
    return [];
  }
};

/**
 * Hook para cargar los envases retornables reales del comercio.
 */
export const useTenantReturnablePackages = (tenantId: string | null) => {
  const [packages, setPackages] = useState<ReturnablePackageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) {
      setPackages([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await fetchTenantReturnablePackages(tenantId);
      setPackages(list);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    packages,
    isLoading,
    reload: load,
  };
};

/**
 * Registra automáticamente un nuevo tipo de envase en la configuración de stock si no existe aún.
 */
export const ensureTenantReturnablePackage = async (
  tenantId: string,
  packageName: string,
  suggestedPrice?: number
): Promise<void> => {
  const clean = packageName.trim();
  if (!clean || !tenantId) return;

  try {
    const settings = await settingsService.getByTenant(tenantId);
    const existing = settings?.stock?.returnable_packages ?? [];
    const lower = clean.toLowerCase();

    if (!existing.some((p) => p.name.toLowerCase() === lower)) {
      const price = typeof suggestedPrice === "number" ? Math.max(0, suggestedPrice) : 0;
      const updated = [...existing, { name: clean, suggestedPrice: price }];
      await settingsService.updateSection(tenantId, "stock", {
        returnable_packages: updated,
      });
    }
  } catch (err) {
    console.error("Error al registrar automáticamente tipo de envase:", err);
  }
};
