import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { auditService } from "@/services/audit.service";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import type { PriceList, Product, ProductBarcode } from "@/types/entities";
import { downloadCsv } from "@/utils/csv";
import { downloadXlsx, parseXlsxFile, type XlsxRow } from "@/utils/xlsx";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";
import {
  computePricingForward,
  DEFAULT_IVA_PERCENT,
  roundMoney,
  roundPercent,
} from "@/modules/productos/utils/product-pricing";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const isProductDeleteConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    status?: unknown;
  };

  const code = typeof candidate.code === "string" ? candidate.code : "";
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.status === "string"
        ? Number(candidate.status)
        : NaN;
  const message =
    `${typeof candidate.message === "string" ? candidate.message : ""} ${
      typeof candidate.details === "string" ? candidate.details : ""
    }`.toLowerCase();

  if (status === 409) return true;
  if (code === "23503") return true;
  return message.includes("foreign key") || message.includes("update or delete on table");
};

export type ProductImportMode = "create_only" | "upsert";

export interface ProductImportParsedRow {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  subcategory: string | null;
  barcode: string | null;
  sale_mode: "unit" | "weight";
  price_final: number;
  price_without_vat: number;
  cost_price: number;
  profit_percent: number;
  vat_percent: number;
  stock_current: number;
  is_favorite: boolean | null;
  is_active: boolean;
}

export interface ProductImportErrorRow {
  rowNumber: number;
  message: string;
  column?: string;
  expected?: string;
  value?: string;
}

export interface ProductImportPreview {
  fileName: string;
  totalRows: number;
  validRows: ProductImportParsedRow[];
  errorRows: ProductImportErrorRow[];
}

export interface ProductImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorRows: ProductImportErrorRow[];
}

type ProductWriteValues = ProductFormValues & {
  imagenFile?: File | null;
  imagenEliminada?: boolean;
};

const buildProductCode = (name: string): string => {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join("");

  return `${normalized || "PRD"}-${Date.now().toString().slice(-6)}`;
};

const toServiceInput = (
  values: ProductFormValues,
  options?: {
    existingCode?: string | null;
    existingName?: string | null;
    existingCategory?: string | null;
    existingSubcategory?: string | null;
    existingBrand?: string | null;
    existingSupplier?: string | null;
    existingDescription?: string | null;
    existingSaleMode?: "unit" | "weight" | null;
    existingStockMin?: number | null;
    existingStockMax?: number | null;
    isActive?: boolean;
    isFavorite?: boolean;
    forcedImageUrl?: string | null;
  }
) => {
  const normalizedImageUrl =
    typeof values.imagenUrl === "string" ? values.imagenUrl.trim() : undefined;
  const hasForcedImageUrl = options && Object.prototype.hasOwnProperty.call(options, "forcedImageUrl");

  return {
    code: values.codigoProducto || options?.existingCode || buildProductCode(values.nombre),
    name: values.nombre || options?.existingName || "Producto",
    image_url: hasForcedImageUrl
      ? options?.forcedImageUrl ?? null
      : normalizedImageUrl === undefined
        ? null
        : normalizedImageUrl || null,
    brand: options?.existingBrand ?? null,
    supplier: options?.existingSupplier ?? null,
    is_favorite: options?.isFavorite ?? false,
    description: options?.existingDescription ?? null,
    price: roundMoney(values.precioFinal),
    cost_price: roundMoney(values.precioCosto),
    stock_current: values.stock,
    stock_min: options?.existingStockMin ?? null,
    stock_max: options?.existingStockMax ?? null,
    category: values.categoria || options?.existingCategory || "General",
    subcategory: values.subcategoria?.trim() ? values.subcategoria.trim() : options?.existingSubcategory ?? null,
    sale_mode: values.saleMode ?? options?.existingSaleMode ?? "unit",
    currency_code: "ARS",
    price_without_vat: roundMoney(values.precioSinIva),
    vat_percent: roundPercent(values.porcentajeIva),
    profit_percent: roundPercent(values.porcentajeGanancia),
    is_active: options?.isActive ?? true,
  };
};

const toTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const normalizeImportKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeBarcode = (value: string | null): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "").trim();
  return cleaned || null;
};

const normalizeProductIdentity = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const parseNumericCell = (value: unknown): { value: number | null; invalid: boolean; raw: string } => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, invalid: false, raw: String(value) };
  }

  const raw = toTrimmedString(value);
  if (!raw) return { value: null, invalid: false, raw: "" };

  const compact = raw.replace(/\s+/g, "").replace(/[^0-9,.-]/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const normalized =
    lastComma >= 0 && lastDot >= 0
      ? lastComma > lastDot
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "")
      : lastComma >= 0
        ? compact.replace(",", ".")
        : compact;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, invalid: true, raw };
  return { value: parsed, invalid: false, raw };
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;

  const raw = toTrimmedString(value).toLowerCase();
  if (!raw) return null;

  if (["1", "true", "si", "yes", "activo", "active"].includes(raw)) return true;
  if (["0", "false", "no", "inactivo", "inactive"].includes(raw)) return false;

  return null;
};

const getRowValueByAlias = (row: XlsxRow, aliases: string[]): unknown => {
  for (const alias of aliases) {
    const normalizedAlias = normalizeImportKey(alias);
    if (normalizedAlias in row) return row[normalizedAlias];
  }
  return undefined;
};

const importFieldAliases = {
  code: ["code", "codigo", "codigo_producto", "codigo de producto", "código de producto", "cÃ³digo de producto", "c?digo de producto"],
  name: ["name", "nombre", "nombre (obligatorio)"],
  category: ["category", "categoria", "categoría", "categorÃ­a", "categor?a", "categoria (obligatoria)", "categoría (obligatoria)", "categorÃ­a (obligatoria)", "categor?a (obligatoria)"],
  subcategory: ["subcategory", "subcategoria", "subcategoría", "subcategorÃ­a", "subcategor?a"],
  barcode: ["barcode", "codigo_barras", "codigo de barras", "código de barras", "cÃ³digo de barras", "c?digo de barras"],
  sale_mode: ["sale_mode", "tipo_venta", "tipo de venta", "modo_venta", "modo de venta", "unidad de venta"],
  stock_current: ["stock_current", "stock"],
  cost_price: ["cost_price", "precio_costo", "precio costo", "precio de costo", "costo"],
  profit_percent: ["profit_percent", "porcentaje_ganancia", "% ganancia", "ganancia", "porcentaje de ganancia"],
  price_without_vat: ["price_without_vat", "precio_sin_iva", "precio sin iva", "precio sin iva"],
  vat_percent: ["vat_percent", "porcentaje_iva", "% iva", "iva", "porcentaje de iva"],
  price_final: ["price_final", "precio_final", "precio final"],
  is_active: ["is_active", "activo", "estado_activo"],
  is_favorite: ["is_favorite", "favorito"],
  price_list: ["lista de precio", "lista_precio", "price_list", "fuente de precio"],
} as const;

const rowSchema = z
  .object({
    code: z.string().max(80),
    name: z.string().min(1, "Nombre obligatorio"),
    category: z.string().min(1, "Categoría obligatoria"),
    subcategory: z.string().max(120).nullable(),
    barcode: z
      .string()
      .max(64)
      .regex(/^$|^[A-Za-z0-9\-\._]*$/, "Código de barras inválido")
      .nullable(),
    sale_mode: z.enum(["unit", "weight"]),
    price_final: z.number().min(0, "Precio final >= 0"),
    price_without_vat: z.number().min(0, "Precio sin IVA >= 0"),
    cost_price: z.number().min(0, "Costo >= 0"),
    profit_percent: z.number().min(0, "Ganancia >= 0"),
    vat_percent: z.number().min(0, "IVA >= 0"),
    stock_current: z.number(),
    is_favorite: z.boolean().nullable(),
    is_active: z.boolean(),
  });

const toNullableString = (value: unknown): string | null => {
  const normalized = toTrimmedString(value);
  return normalized || null;
};

const parseSaleMode = (value: unknown): "unit" | "weight" => {
  const raw = toTrimmedString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return ["weight", "peso", "pesable", "kg", "kilo", "kilos", "gramo", "gramos"].includes(raw)
    ? "weight"
    : "unit";
};

type ProductImportRowParseResult =
  | { ok: true; row: ProductImportParsedRow }
  | { ok: false; errors: ProductImportErrorRow[] };

const validateImportFileDuplicates = (rows: ProductImportParsedRow[]): ProductImportErrorRow[] => {
  const errors: ProductImportErrorRow[] = [];
  const rowsByCode = new Map<string, ProductImportParsedRow[]>();
  const rowsByBarcode = new Map<string, ProductImportParsedRow[]>();

  for (const row of rows) {
    const normalizedCode = row.code.trim().toUpperCase();
    if (normalizedCode) {
      rowsByCode.set(normalizedCode, [...(rowsByCode.get(normalizedCode) ?? []), row]);
    }

    const normalizedBarcode = normalizeBarcode(row.barcode);
    if (normalizedBarcode) {
      rowsByBarcode.set(normalizedBarcode, [...(rowsByBarcode.get(normalizedBarcode) ?? []), row]);
    }
  }

  const pushDuplicateErrors = (
    entries: Map<string, ProductImportParsedRow[]>,
    label: string,
    column: string
  ) => {
    for (const [value, duplicatedRows] of entries) {
      if (duplicatedRows.length < 2) continue;
      const rowNumbers = duplicatedRows.map((row) => row.rowNumber).join(", ");
      for (const row of duplicatedRows) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `${label} duplicado dentro del archivo`,
          column,
          value,
          expected: `Debe aparecer una sola vez. Filas repetidas: ${rowNumbers}`,
        });
      }
    }
  };

  pushDuplicateErrors(rowsByCode, "Código de producto", "codigo de producto");
  pushDuplicateErrors(rowsByBarcode, "Código de barras", "codigo de barras");

  return errors;
};

const parseImportRow = (row: XlsxRow, rowNumber: number): ProductImportRowParseResult => {
  const errors: ProductImportErrorRow[] = [];
  const pushError = (message: string, column?: string, expected?: string, value?: string) => {
    errors.push({ rowNumber, message, column, expected, value });
  };

  const code = toTrimmedString(getRowValueByAlias(row, [...importFieldAliases.code]));
  const name = toTrimmedString(getRowValueByAlias(row, [...importFieldAliases.name]));
  const category = toTrimmedString(getRowValueByAlias(row, [...importFieldAliases.category]));

  const stockRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.stock_current]));
  const costRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.cost_price]));
  const profitRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.profit_percent]));
  const vatRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.vat_percent]));
  const priceFinalRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.price_final]));
  const priceWithoutVatRaw = parseNumericCell(getRowValueByAlias(row, [...importFieldAliases.price_without_vat]));

  if (!name) {
    pushError("Nombre obligatorio", "nombre", "Texto no vacío");
  }

  if (!category) {
    pushError("Categoría obligatoria", "categoría", "Texto no vacío");
  }

  if (stockRaw.invalid) {
    pushError("Stock inválido", "stock", "Número", stockRaw.raw);
  }
  if (costRaw.invalid) {
    pushError("Precio costo inválido", "precio costo", "Número", costRaw.raw);
  }
  if (profitRaw.invalid) {
    pushError("Porcentaje de ganancia inválido", "% ganancia", "Número", profitRaw.raw);
  }
  if (vatRaw.invalid) {
    pushError("Porcentaje de IVA inválido", "% IVA", "Número", vatRaw.raw);
  }
  if (priceFinalRaw.invalid) {
    pushError("Precio final inválido", "precio final", "Número", priceFinalRaw.raw);
  }
  if (priceWithoutVatRaw.invalid) {
    pushError("Precio sin IVA inválido", "precio sin IVA", "Número", priceWithoutVatRaw.raw);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const costPrice = costRaw.value ?? 0;
  const stockCurrent = stockRaw.value ?? 0;
  const vatPercent = vatRaw.value ?? DEFAULT_IVA_PERCENT;
  const profitPercent = profitRaw.value ?? null;
  const priceFinal = priceFinalRaw.value;
  const priceWithoutVat = priceWithoutVatRaw.value;

  const forwardFromCost = computePricingForward({
    precioCosto: costPrice,
    porcentajeGanancia: profitPercent ?? 0,
    porcentajeIva: vatPercent,
  });

  const resolvedPriceWithoutVat = roundMoney(
    priceWithoutVat ?? (priceFinal != null ? priceFinal / (1 + vatPercent / 100) : forwardFromCost.precioSinIva)
  );
  const resolvedPriceFinal = roundMoney(priceFinal ?? resolvedPriceWithoutVat * (1 + vatPercent / 100));

  const parsedBoolean = parseBoolean(getRowValueByAlias(row, [...importFieldAliases.is_active]));
  const parsedFavorite = parseBoolean(getRowValueByAlias(row, [...importFieldAliases.is_favorite]));

  const candidate = {
    code,
    name,
    category,
    subcategory: toNullableString(getRowValueByAlias(row, [...importFieldAliases.subcategory])),
    barcode: normalizeBarcode(toNullableString(getRowValueByAlias(row, [...importFieldAliases.barcode]))),
    sale_mode: parseSaleMode(getRowValueByAlias(row, [...importFieldAliases.sale_mode])),
    price_final: resolvedPriceFinal,
    price_without_vat: resolvedPriceWithoutVat,
    cost_price: costPrice,
    profit_percent: roundPercent(
      profitPercent ?? (costPrice > 0 ? ((resolvedPriceWithoutVat - costPrice) / costPrice) * 100 : 0)
    ),
    vat_percent: roundPercent(vatPercent),
    stock_current: stockCurrent,
    is_favorite: parsedFavorite,
    is_active: parsedBoolean ?? true,
  };

  const validated = rowSchema.safeParse(candidate);
  if (!validated.success) {
    return {
      ok: false,
      errors: validated.error.issues.map((issue) => ({
        rowNumber,
        message: issue.message,
        column: issue.path?.[0] ? String(issue.path[0]) : undefined,
      })),
    };
  }

  return {
    ok: true,
    row: {
      rowNumber,
      ...validated.data,
    },
  };
};

export const useProductsCrud = (tenantId: string | null, userId: string | null) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [allBarcodes, setAllBarcodes] = useState<ProductBarcode[]>([]);
  const [primaryBarcodes, setPrimaryBarcodes] = useState<Record<string, string>>({});
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const sortByName = useCallback((rows: Product[]) => {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const upsertProductInState = useCallback((product: Product) => {
    const safeProduct = { ...product };

    setProducts((current) => {
      const withoutCurrent = current.filter((item) => item.id !== safeProduct.id);
      return sortByName([...withoutCurrent, safeProduct]);
    });
  }, [sortByName]);

  const removeProductFromState = useCallback((productId: string) => {
    setProducts((current) => current.filter((item) => item.id !== productId));
    setPrimaryBarcodes((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setAllBarcodes((current) => current.filter((row) => row.product_id !== productId));
  }, []);

  const patchPrimaryBarcodeState = useCallback((productId: string, barcodeValue: string) => {
    const normalized = normalizeBarcode(barcodeValue) ?? "";

    setPrimaryBarcodes((current) => {
      const next = { ...current };
      if (!normalized) {
        delete next[productId];
      } else {
        next[productId] = normalized;
      }
      return next;
    });
  }, []);

  const loadProducts = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setAllBarcodes([]);
      setPrimaryBarcodes({});
      setPriceLists([]);
      return;
    }

    setIsLoading(true);
    try {
      const [list, barcodeMap, barcodes, lists] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        productsService.getPrimaryBarcodesMapByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
        priceListsService.getAllByTenant(tenantId),
      ]);
      setProducts(sortByName(list.map((row) => ({ ...row }))));
      setAllBarcodes(barcodes.map((row) => ({ ...row })));
      setPrimaryBarcodes({ ...barcodeMap });
      setPriceLists(lists.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los productos" });
    } finally {
      setIsLoading(false);
    }
  }, [sortByName, tenantId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const createProduct = async (
    values: ProductWriteValues,
    options?: {
      isActive?: boolean;
      isFavorite?: boolean;
    }
  ) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const createdBase = await productsService.create(
        tenantId,
        toServiceInput(values, {
          isActive: options?.isActive ?? true,
          isFavorite: options?.isFavorite ?? false,
          forcedImageUrl: null,
        })
      );
      let created = createdBase;

      let imageUploadWarning: string | null = null;
      if (values.imagenFile) {
        try {
          const uploadedImageUrl = await productsService.uploadProductImage(
            tenantId,
            createdBase.id,
            values.imagenFile
          );
          const updatedWithImage = await productsService.update(tenantId, createdBase.id, {
            image_url: uploadedImageUrl,
          });
          created = updatedWithImage ?? { ...createdBase, image_url: uploadedImageUrl };
        } catch (reason) {
          imageUploadWarning =
            reason instanceof Error && reason.message
              ? reason.message
              : "No se pudo subir la imagen del producto";
        }
      }

      await productsService.setPrimaryBarcode(tenantId, created.id, values.codigoBarras ?? "");
      upsertProductInState(created);
      patchPrimaryBarcodeState(created.id, values.codigoBarras ?? "");
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "create",
        entity_type: "product",
        entity_id: created.id,
        description: `Producto creado: ${created.name}`,
        metadata: {
          code: created.code,
          category: created.category,
          subcategory: created.subcategory,
          stock_current: created.stock_current,
          cost_price: created.cost_price,
          price: created.price,
          vat_percent: created.vat_percent ?? null,
          profit_percent: created.profit_percent ?? null,
          price_without_vat: created.price_without_vat ?? null,
          is_active: created.is_active,
        },
      });
      setFeedback({
        type: imageUploadWarning ? "error" : "success",
        message: imageUploadWarning
          ? `Producto creado sin imagen. ${imageUploadWarning}`
          : "Producto creado",
      });
      await loadProducts();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Error al crear producto";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProduct = async (
    productId: string,
    values: ProductWriteValues,
    options?: {
      isActive?: boolean;
      isFavorite?: boolean;
    }
  ) => {
    if (!tenantId) return;

    const existing = products.find((product) => product.id === productId);
    if (!existing) return;

    setIsSubmitting(true);
    try {
      const previousImageUrl = existing.image_url ?? null;
      let nextImageUrl = previousImageUrl;

      if (values.imagenFile) {
        nextImageUrl = await productsService.uploadProductImage(tenantId, productId, values.imagenFile);
      } else if (values.imagenEliminada) {
        nextImageUrl = null;
      }

      const updated = await productsService.update(
        tenantId,
        productId,
        toServiceInput(values, {
          existingCode: existing.code,
          existingName: existing.name,
          existingCategory: existing.category,
          existingSubcategory: existing.subcategory,
          existingBrand: existing.brand,
          existingSupplier: existing.supplier,
          existingDescription: existing.description,
          forcedImageUrl: nextImageUrl,
          existingSaleMode: existing.sale_mode,
          existingStockMin: existing.stock_min,
          existingStockMax: existing.stock_max,
          isActive: options?.isActive ?? existing.is_active,
          isFavorite: options?.isFavorite ?? existing.is_favorite,
        })
      );
      await productsService.setPrimaryBarcode(tenantId, productId, values.codigoBarras ?? "");
      const optimisticUpdated: Product = {
        ...existing,
        ...toServiceInput(values, {
          existingCode: existing.code,
          existingName: existing.name,
          existingCategory: existing.category,
          existingSubcategory: existing.subcategory,
          existingBrand: existing.brand,
          existingSupplier: existing.supplier,
          existingDescription: existing.description,
          forcedImageUrl: nextImageUrl,
          existingSaleMode: existing.sale_mode,
          existingStockMin: existing.stock_min,
          existingStockMax: existing.stock_max,
          isActive: options?.isActive ?? existing.is_active,
          isFavorite: options?.isFavorite ?? existing.is_favorite,
        }),
        updated_at: updated?.updated_at ?? new Date().toISOString(),
      };

      upsertProductInState(updated ?? optimisticUpdated);

      if (previousImageUrl && previousImageUrl !== nextImageUrl) {
        void productsService.deleteProductImageByUrl(previousImageUrl).catch(() => undefined);
      }

      patchPrimaryBarcodeState(productId, values.codigoBarras ?? "");
      const previousBarcode = normalizeBarcode(primaryBarcodes[productId] ?? null) ?? null;
      const nextBarcode = normalizeBarcode(values.codigoBarras ?? null) ?? null;
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "update",
        entity_type: "product",
        entity_id: updated?.id ?? productId,
        description: `Producto actualizado: ${values.nombre}`,
        metadata: {
          previous_name: existing.name,
          next_name: values.nombre,
          previous_code: existing.code,
          next_code: values.codigoProducto || existing.code,
          previous_barcode: previousBarcode,
          next_barcode: nextBarcode,
          previous_category: existing.category,
          next_category: values.categoria,
          previous_subcategory: existing.subcategory ?? null,
          next_subcategory: values.subcategoria?.trim() || null,
          previous_stock_current: existing.stock_current,
          next_stock_current: values.stock,
          previous_cost_price: existing.cost_price,
          next_cost_price: values.precioCosto,
          previous_price: existing.price,
          next_price: values.precioFinal,
          previous_vat_percent: existing.vat_percent ?? DEFAULT_IVA_PERCENT,
          next_vat_percent: values.porcentajeIva,
          previous_profit_percent: existing.profit_percent ?? 0,
          next_profit_percent: values.porcentajeGanancia,
          previous_price_without_vat: existing.price_without_vat ?? 0,
          next_price_without_vat: values.precioSinIva,
          previous_is_active: existing.is_active,
          next_is_active: options?.isActive ?? existing.is_active,
          previous_is_favorite: existing.is_favorite,
          next_is_favorite: options?.isFavorite ?? existing.is_favorite,
        },
      });
      setFeedback({ type: "success", message: "Producto actualizado" });
      await loadProducts();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Error al actualizar producto";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      await productsService.delete(tenantId, productId);
      removeProductFromState(productId);
      setFeedback({ type: "success", message: "Producto eliminado" });
      await loadProducts();
    } catch (error) {
      if (isProductDeleteConflictError(error)) {
        const updated = await productsService.update(tenantId, productId, {
          is_active: false,
          is_favorite: false,
        });

        if (updated) {
          upsertProductInState(updated);
        }

        setFeedback({
          type: "success",
          message: "Producto con movimientos previos: se desactivo en lugar de eliminarse",
        });
        await loadProducts();
        return;
      }

      setFeedback({ type: "error", message: "Error al eliminar producto" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProductsBulk = async (productIds: string[]): Promise<{ deleted: number; failed: number }> => {
    if (!tenantId) return { deleted: 0, failed: productIds.length };

    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) return { deleted: 0, failed: 0 };

    setIsSubmitting(true);

    let deleted = 0;
    let deactivated = 0;
    let failed = 0;

    try {
      for (const productId of uniqueIds) {
        try {
          const ok = await productsService.delete(tenantId, productId);
          if (ok) {
            deleted += 1;
            removeProductFromState(productId);
            continue;
          }

          failed += 1;
        } catch (error) {
          if (isProductDeleteConflictError(error)) {
            const updated = await productsService.update(tenantId, productId, {
              is_active: false,
              is_favorite: false,
            });

            if (updated) {
              deactivated += 1;
              upsertProductInState(updated);
              continue;
            }
          }

          failed += 1;
        }
      }

      if (failed > 0) {
        setFeedback({
          type: "error",
          message: `Eliminacion masiva parcial. Eliminados: ${deleted} | Desactivados: ${deactivated} | Errores: ${failed}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `Proceso finalizado. Eliminados: ${deleted} | Desactivados: ${deactivated}`,
        });
      }

      await loadProducts();
      return { deleted, failed };
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductActive = async (productId: string) => {
    if (!tenantId) return;

    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const nextIsActive = !product.is_active;

    setIsSubmitting(true);
    try {
      const updated = await productsService.update(tenantId, productId, { is_active: nextIsActive });
      upsertProductInState(updated ?? { ...product, is_active: nextIsActive });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "toggle_active",
        entity_type: "product",
        entity_id: productId,
        description: `Producto ${nextIsActive ? "activado" : "desactivado"}: ${product.name}`,
        metadata: {
          previous_is_active: product.is_active,
          next_is_active: nextIsActive,
        },
      });
      setFeedback({
        type: "success",
        message: product.is_active ? "Producto desactivado" : "Producto activado",
      });
      await loadProducts();
    } catch {
      setFeedback({ type: "error", message: "Error al cambiar estado del producto" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductFavorite = async (productId: string) => {
    if (!tenantId) return;

    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const nextIsFavorite = !product.is_favorite;

    setIsSubmitting(true);
    try {
      const updated = await productsService.update(tenantId, productId, { is_favorite: nextIsFavorite });
      upsertProductInState(updated ?? { ...product, is_favorite: nextIsFavorite });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "toggle_favorite",
        entity_type: "product",
        entity_id: productId,
        description: `Producto ${nextIsFavorite ? "marcado" : "desmarcado"} como favorito: ${product.name}`,
        metadata: {
          previous_is_favorite: product.is_favorite,
          next_is_favorite: nextIsFavorite,
        },
      });
      setFeedback({
        type: "success",
        message: nextIsFavorite ? "Producto marcado como favorito" : "Producto quitado de favoritos",
      });
      await loadProducts();
    } catch {
      setFeedback({ type: "error", message: "Error al actualizar favorito" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadImportTemplate = async (): Promise<boolean> => {
    const templateRow: Record<string, string | number | boolean> = {
      "nombre (obligatorio)": "Yerba 1kg",
      "codigo de barras": "7791234567890",
      "codigo de producto": "PRD-0001",
      "categoria (obligatoria)": "Almacen",
      subcategoria: "Yerba",
      "precio costo": 1200,
      "% ganancia": 20,
      "% iva": 21,
      "precio final": 1742.4,
      stock: 20,
      "tipo de venta": "unit",
      "lista de precio": "BASE (solo lectura - no editar)",
    };

    return downloadXlsx("plantilla-productos", "Plantilla Productos", [templateRow]);
  };

  const downloadImportErrors = async (errors: ProductImportErrorRow[]): Promise<boolean> => {
    if (!errors.length) return false;

    return downloadXlsx(
      `errores-importacion-productos-${new Date().toISOString().slice(0, 10)}`,
      "Errores Importacion",
      errors.map((error) => ({
        fila: error.rowNumber,
        error: error.message,
        columna: error.column ?? "",
        valor: error.value ?? "",
        esperado: error.expected ?? "",
      }))
    );
  };

  const parseImportFile = async (file: File): Promise<ProductImportPreview> => {
    const rawRows = await parseXlsxFile(file);

    const validRows: ProductImportParsedRow[] = [];
    const errorRows: ProductImportErrorRow[] = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalized: XlsxRow = {};

      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeImportKey(key)] = value;
      }

      const parsed = parseImportRow(normalized, rowNumber);
      if (!parsed.ok) {
        errorRows.push(...parsed.errors);
        return;
      }

      validRows.push(parsed.row);
    });

    const duplicateErrors = validateImportFileDuplicates(validRows);
    if (duplicateErrors.length > 0) {
      errorRows.push(...duplicateErrors);
    }

    const invalidRowNumbers = new Set(errorRows.map((error) => error.rowNumber));

    return {
      fileName: file.name,
      totalRows: rawRows.length,
      validRows: validRows.filter((row) => !invalidRowNumbers.has(row.rowNumber)),
      errorRows,
    };
  };

  const applyImportPreview = async (
    preview: ProductImportPreview,
    mode: ProductImportMode
  ): Promise<ProductImportResult> => {
    if (!tenantId) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: preview.validRows.length,
        errorRows: preview.validRows.map((row) => ({
          rowNumber: row.rowNumber,
          message: "Tenant no disponible",
        })),
      };
    }

    setIsSubmitting(true);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const importErrors: ProductImportErrorRow[] = [];

    const codeToProductId = new Map<string, string>();
    for (const product of products) {
      if (!product.code) continue;
      codeToProductId.set(product.code.trim().toUpperCase(), product.id);
    }

    const barcodeToProductId = new Map<string, string>();
    for (const barcodeRow of allBarcodes) {
      const normalizedBarcode = normalizeBarcode(barcodeRow.barcode);
      if (!normalizedBarcode) continue;
      barcodeToProductId.set(normalizedBarcode, barcodeRow.product_id);
    }

    const productIdsByName = new Map<string, string[]>();
    for (const product of products) {
      const normalizedName = normalizeProductIdentity(product.name);
      if (!normalizedName) continue;
      productIdsByName.set(normalizedName, [
        ...(productIdsByName.get(normalizedName) ?? []),
        product.id,
      ]);
    }

    try {
      if (preview.errorRows.length > 0 && preview.validRows.length === 0) {
        const result = {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: preview.errorRows.length,
          errorRows: preview.errorRows,
        };

        setFeedback({
          type: "error",
          message: `Importación bloqueada. Corregí ${preview.errorRows.length} errores antes de importar.`,
        });

        return result;
      }

      for (const row of preview.validRows) {
        const normalizedCode = row.code.trim().toUpperCase();
        const normalizedBarcode = normalizeBarcode(row.barcode);
        const codeMatch = normalizedCode ? codeToProductId.get(normalizedCode) ?? null : null;
        const barcodeMatch = normalizedBarcode
          ? barcodeToProductId.get(normalizedBarcode) ?? null
          : null;

        if (codeMatch && barcodeMatch && codeMatch !== barcodeMatch) {
          importErrors.push({
            rowNumber: row.rowNumber,
            message: "Conflicto entre código y código de barras: apuntan a productos distintos",
          });
          continue;
        }

        const normalizedName = normalizeProductIdentity(row.name);
        const nameMatches = productIdsByName.get(normalizedName) ?? [];
        const nameMatch = nameMatches.length === 1 ? nameMatches[0] : null;
        const matchedProductId = codeMatch ?? barcodeMatch ?? (mode === "upsert" ? nameMatch : null);
        if (mode === "upsert" && matchedProductId) {
          const existing = products.find((product) => product.id === matchedProductId);
          if (!existing) {
            importErrors.push({
              rowNumber: row.rowNumber,
              message: "No se encontró el producto para actualizar",
            });
          }
        }
      }

      if (importErrors.length > 0) {
        const result = {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: importErrors.length,
          errorRows: importErrors,
        };

        setFeedback({
          type: "error",
          message: `Importación bloqueada. No se creó ni actualizó ningún producto. Errores: ${importErrors.length}`,
        });

        return result;
      }

      for (const row of preview.validRows) {
        const normalizedCode = row.code.trim().toUpperCase();
        const normalizedBarcode = normalizeBarcode(row.barcode);

        const codeMatch = normalizedCode ? codeToProductId.get(normalizedCode) ?? null : null;
        const barcodeMatch = normalizedBarcode
          ? barcodeToProductId.get(normalizedBarcode) ?? null
          : null;

        if (codeMatch && barcodeMatch && codeMatch !== barcodeMatch) {
          importErrors.push({
            rowNumber: row.rowNumber,
            message: "Conflicto entre código y código de barras: apuntan a productos distintos",
          });
          continue;
        }

        const normalizedName = normalizeProductIdentity(row.name);
        const nameMatches = productIdsByName.get(normalizedName) ?? [];
        const nameMatch = nameMatches.length === 1 ? nameMatches[0] : null;
        const matchedProductId = codeMatch ?? barcodeMatch ?? (mode === "upsert" ? nameMatch : null);

        if (mode === "create_only" && matchedProductId) {
          skipped += 1;
          continue;
        }

        try {
          if (matchedProductId) {
            const existing = products.find((product) => product.id === matchedProductId);
            if (!existing) {
              importErrors.push({
                rowNumber: row.rowNumber,
                message: "No se encontró el producto para actualizar",
              });
              continue;
            }

            await productsService.update(tenantId, matchedProductId, {
              code: row.code || existing.code,
              name: row.name,
              brand: existing.brand,
              supplier: existing.supplier,
              is_favorite: row.is_favorite ?? existing.is_favorite,
              description: existing.description,
              category: row.category,
              subcategory: row.subcategory,
              sale_mode: row.sale_mode,
              price: row.price_final,
              cost_price: row.cost_price,
              stock_current: row.stock_current,
              stock_min: existing.stock_min,
              stock_max: existing.stock_max,
              price_without_vat: row.price_without_vat,
              vat_percent: row.vat_percent,
              profit_percent: row.profit_percent,
              is_active: row.is_active,
            });

            if (normalizedBarcode) {
              await productsService.setPrimaryBarcode(tenantId, matchedProductId, normalizedBarcode);
              barcodeToProductId.set(normalizedBarcode, matchedProductId);
            }

            const nextCode = (row.code || existing.code).trim().toUpperCase();
            if (nextCode) {
              codeToProductId.set(nextCode, matchedProductId);
            }
            productIdsByName.set(normalizedName, [matchedProductId]);

            updated += 1;
            continue;
          }

          const createdProduct = await productsService.create(tenantId, {
            code: row.code || buildProductCode(row.name),
            name: row.name,
            brand: null,
            supplier: null,
            is_favorite: row.is_favorite ?? false,
            description: null,
            price: row.price_final,
            cost_price: row.cost_price,
            stock_current: row.stock_current,
            stock_min: null,
            stock_max: null,
            category: row.category,
            subcategory: row.subcategory,
            sale_mode: row.sale_mode,
            currency_code: "ARS",
            price_without_vat: row.price_without_vat,
            vat_percent: row.vat_percent,
            profit_percent: row.profit_percent,
            is_active: row.is_active,
          });

          if (normalizedBarcode) {
            await productsService.setPrimaryBarcode(tenantId, createdProduct.id, normalizedBarcode);
            barcodeToProductId.set(normalizedBarcode, createdProduct.id);
          }

          if (createdProduct.code) {
            codeToProductId.set(createdProduct.code.trim().toUpperCase(), createdProduct.id);
          }
          productIdsByName.set(normalizedName, [createdProduct.id]);

          created += 1;
        } catch (error) {
          importErrors.push({
            rowNumber: row.rowNumber,
            message: error instanceof Error && error.message ? error.message : "Error al importar fila",
          });
        }
      }

      const allImportErrors = [...preview.errorRows, ...importErrors];

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "bulk_import",
        entity_type: "product",
        entity_id: null,
        description: `Importacion masiva de productos (${mode})`,
        metadata: {
          file_name: preview.fileName,
          total_rows: preview.totalRows,
          valid_rows: preview.validRows.length,
          created,
          updated,
          skipped,
          errors: allImportErrors.length,
        },
      });

      await loadProducts();

      if (allImportErrors.length > 0) {
        setFeedback({
          type: "error",
          message: `Importacion parcial. Creados: ${created} | Actualizados: ${updated} | Saltados: ${skipped} | Errores: ${allImportErrors.length}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `Importacion completa. Creados: ${created} | Actualizados: ${updated} | Saltados: ${skipped}`,
        });
      }

      return {
        created,
        updated,
        skipped,
        errors: allImportErrors.length,
        errorRows: allImportErrors,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportProducts = async (options: {
    format: "xlsx" | "csv";
    priceListId: string | "base";
    productIds?: string[];
  }): Promise<boolean> => {
    if (!tenantId) return false;

    const targetProducts = options.productIds?.length
      ? products.filter((product) => options.productIds?.includes(product.id))
      : products;

    if (!targetProducts.length) return false;

    setIsSubmitting(true);
    try {
      const selectedPriceList =
        options.priceListId === "base"
          ? null
          : priceLists.find((priceList) => priceList.id === options.priceListId) ?? null;

      const rows = [] as Array<Record<string, string | number | boolean | null>>;

      for (const product of targetProducts) {
        const barcode = primaryBarcodes[product.id] ?? null;
        const resolvedPrice = selectedPriceList
          ? await priceListsService.resolveProductPrice(
              tenantId,
              selectedPriceList.id,
              product.id,
              product.price
            )
          : product.price;

        rows.push({
          nombre: product.name,
          "codigo de barras": barcode,
          "codigo de producto": product.code,
          categoria: product.category,
          subcategoria: product.subcategory,
          "precio costo": product.cost_price,
          "% ganancia":
            product.profit_percent != null
              ? product.profit_percent
              : product.cost_price > 0
                ? roundPercent((((product.price_without_vat ?? product.price) - product.cost_price) / product.cost_price) * 100)
                : 0,
          "% iva": product.vat_percent ?? DEFAULT_IVA_PERCENT,
          "precio final": resolvedPrice,
          stock: product.stock_current,
          "lista de precio": selectedPriceList ? selectedPriceList.name : "Base",
        });
      }

      const fileSuffix = selectedPriceList ? `lista-${selectedPriceList.code}` : "precio-base";
      const fileName = `productos-${fileSuffix}-${new Date().toISOString().slice(0, 10)}`;

      const ok =
        options.format === "xlsx"
          ? await downloadXlsx(fileName, "Productos", rows)
          : downloadCsv(fileName, rows);

      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  return {
    products: sortedProducts,
    primaryBarcodes,
    priceLists,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    deleteProductsBulk,
    toggleProductActive,
    toggleProductFavorite,
    downloadImportTemplate,
    downloadImportErrors,
    parseImportFile,
    applyImportPreview,
    exportProducts,
  };
};
