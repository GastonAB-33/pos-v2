import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { auditService } from "@/services/audit.service";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import type { PriceList, Product, ProductBarcode } from "@/types/entities";
import { downloadCsv } from "@/utils/csv";
import { downloadXlsx, parseXlsxFile, type XlsxRow } from "@/utils/xlsx";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

export type ProductImportMode = "create_only" | "upsert";

export interface ProductImportParsedRow {
  rowNumber: number;
  code: string;
  name: string;
  brand: string | null;
  supplier: string | null;
  is_favorite: boolean;
  description: string | null;
  category: string;
  subcategory: string | null;
  barcode: string | null;
  sale_mode: "unit" | "weight";
  price: number;
  cost_price: number;
  stock_current: number;
  stock_min: number | null;
  stock_max: number | null;
  is_active: boolean;
}

export interface ProductImportErrorRow {
  rowNumber: number;
  message: string;
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
    existingCode?: string;
    isActive?: boolean;
    isFavorite?: boolean;
    stockMin?: number | null;
    stockMax?: number | null;
  }
) => ({
  code: options?.existingCode ?? buildProductCode(values.name),
  name: values.name,
  brand: values.brand?.trim() ? values.brand.trim() : null,
  supplier: values.supplier?.trim() ? values.supplier.trim() : null,
  is_favorite: options?.isFavorite ?? false,
  description: values.description?.trim() ? values.description.trim() : null,
  price: values.price,
  cost_price: values.cost,
  stock_current: values.stockInitial,
  stock_min: options?.stockMin ?? 5,
  stock_max: options?.stockMax ?? null,
  category: values.category,
  subcategory: values.subcategory?.trim() ? values.subcategory.trim() : null,
  sale_mode: values.saleMode,
  currency_code: "ARS",
  is_active: options?.isActive ?? true,
});

const toTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const normalizeBarcode = (value: string | null): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "").trim();
  return cleaned || null;
};

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = toTrimmedString(value);
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;

  const raw = toTrimmedString(value).toLowerCase();
  if (!raw) return null;

  if (["1", "true", "si", "yes", "activo", "active"].includes(raw)) return true;
  if (["0", "false", "no", "inactivo", "inactive"].includes(raw)) return false;

  return null;
};

const parseSaleMode = (value: unknown): "unit" | "weight" | null => {
  const raw = toTrimmedString(value).toLowerCase();
  if (!raw) return "unit";

  if (["unit", "unidad", "u"].includes(raw)) return "unit";
  if (["weight", "peso", "kg"].includes(raw)) return "weight";
  return null;
};

const rowSchema = z
  .object({
    code: z.string().max(80),
    name: z.string().min(2, "Nombre obligatorio"),
    brand: z.string().max(120).nullable(),
    supplier: z.string().max(160).nullable(),
    is_favorite: z.boolean(),
    description: z.string().max(500).nullable(),
    category: z.string().min(2, "Categoria obligatoria"),
    subcategory: z.string().max(120).nullable(),
    barcode: z
      .string()
      .max(64)
      .regex(/^[A-Za-z0-9\-\._]*$/, "Barcode invalido")
      .nullable(),
    sale_mode: z.enum(["unit", "weight"]),
    price: z.number().min(0, "Precio >= 0"),
    cost_price: z.number().min(0, "Costo >= 0"),
    stock_current: z.number().min(0, "Stock >= 0"),
    stock_min: z.number().min(0).nullable(),
    stock_max: z.number().min(0).nullable(),
    is_active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.stock_min != null && value.stock_max != null && value.stock_max < value.stock_min) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stock_max no puede ser menor a stock_min",
        path: ["stock_max"],
      });
    }
  });

const templateColumns = [
  "code",
  "name",
  "brand",
  "is_favorite",
  "description",
  "category",
  "subcategory",
  "supplier",
  "barcode",
  "sale_mode",
  "price",
  "cost_price",
  "stock_current",
  "stock_min",
  "stock_max",
  "is_active",
] as const;

const toNullableString = (value: unknown): string | null => {
  const normalized = toTrimmedString(value);
  return normalized || null;
};

const parseImportRow = (row: XlsxRow, rowNumber: number): ProductImportParsedRow | ProductImportErrorRow => {
  const code = toTrimmedString(row.code);
  const name = toTrimmedString(row.name);
  const category = toTrimmedString(row.category);

  const saleMode = parseSaleMode(row.sale_mode);
  if (!saleMode) {
    return {
      rowNumber,
      message: "sale_mode invalido. Usa unit o weight",
    };
  }

  const price = parseNumeric(row.price);
  const costPrice = parseNumeric(row.cost_price);
  const stockCurrent = parseNumeric(row.stock_current);

  if (price == null || costPrice == null || stockCurrent == null) {
    return {
      rowNumber,
      message: "price, cost_price y stock_current son obligatorios y numericos",
    };
  }

  const stockMin = parseNumeric(row.stock_min);
  const stockMax = parseNumeric(row.stock_max);
  const parsedBoolean = parseBoolean(row.is_active);

  const candidate = {
    code,
    name,
    brand: toNullableString(row.brand),
    supplier: toNullableString(row.supplier),
    is_favorite: parseBoolean(row.is_favorite) ?? false,
    description: toNullableString(row.description),
    category,
    subcategory: toNullableString(row.subcategory),
    barcode: normalizeBarcode(toNullableString(row.barcode)),
    sale_mode: saleMode,
    price,
    cost_price: costPrice,
    stock_current: stockCurrent,
    stock_min: stockMin,
    stock_max: stockMax,
    is_active: parsedBoolean ?? true,
  };

  const validated = rowSchema.safeParse(candidate);
  if (!validated.success) {
    return {
      rowNumber,
      message: validated.error.issues.map((issue) => issue.message).join(". "),
    };
  }

  return {
    rowNumber,
    ...validated.data,
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
      setProducts(list);
      setAllBarcodes(barcodes);
      setPrimaryBarcodes(barcodeMap);
      setPriceLists(lists.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los productos" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const createProduct = async (values: ProductFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await productsService.create(tenantId, toServiceInput(values));
      await productsService.setPrimaryBarcode(tenantId, created.id, values.barcode ?? "");
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
          sale_mode: created.sale_mode,
          supplier: created.supplier,
          is_favorite: created.is_favorite,
          is_active: created.is_active,
        },
      });
      setFeedback({ type: "success", message: "Producto creado" });
      await loadProducts();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Error al crear producto";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProduct = async (productId: string, values: ProductFormValues) => {
    if (!tenantId) return;

    const existing = products.find((product) => product.id === productId);
    if (!existing) return;

    setIsSubmitting(true);
    try {
      const updated = await productsService.update(
        tenantId,
        productId,
        toServiceInput(values, {
          existingCode: existing.code,
          isActive: existing.is_active,
          isFavorite: existing.is_favorite,
          stockMin: existing.stock_min,
          stockMax: existing.stock_max,
        })
      );
      await productsService.setPrimaryBarcode(tenantId, productId, values.barcode ?? "");
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "update",
        entity_type: "product",
        entity_id: updated?.id ?? productId,
        description: `Producto actualizado: ${values.name}`,
        metadata: {
          previous_name: existing.name,
          next_name: values.name,
          category: values.category,
          sale_mode: values.saleMode,
          supplier: values.supplier?.trim() || null,
          is_favorite: existing.is_favorite,
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
    const target = products.find((product) => product.id === productId);

    setIsSubmitting(true);
    try {
      await productsService.delete(tenantId, productId);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "productos",
        action: "delete",
        entity_type: "product",
        entity_id: productId,
        description: `Producto eliminado${target ? `: ${target.name}` : ""}`,
        metadata: target
          ? {
              code: target.code,
              category: target.category,
            }
          : null,
      });
      setFeedback({ type: "success", message: "Producto eliminado" });
      await loadProducts();
    } catch {
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
    let failed = 0;

    try {
      for (const productId of uniqueIds) {
        const target = products.find((product) => product.id === productId) ?? null;

        try {
          const ok = await productsService.delete(tenantId, productId);
          if (!ok) {
            failed += 1;
            continue;
          }

          deleted += 1;
          await auditService.createSafe(tenantId, {
            user_id: userId,
            module: "productos",
            action: "bulk_delete",
            entity_type: "product",
            entity_id: productId,
            description: `Producto eliminado en lote${target ? `: ${target.name}` : ""}`,
            metadata: target
              ? {
                  code: target.code,
                  category: target.category,
                }
              : null,
          });
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setFeedback({
          type: "error",
          message: `Eliminacion masiva parcial. Eliminados: ${deleted} | Errores: ${failed}`,
        });
      } else {
        setFeedback({ type: "success", message: `Se eliminaron ${deleted} productos` });
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
      await productsService.update(tenantId, productId, { is_active: nextIsActive });
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
      await productsService.update(tenantId, productId, { is_favorite: nextIsFavorite });
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
    const templateRow: Record<(typeof templateColumns)[number], string | number | boolean> = {
      code: "PRD-0001",
      name: "Yerba 1kg",
      brand: "Marca demo",
      is_favorite: false,
      description: "Producto de ejemplo",
      category: "Almacen",
      subcategory: "Yerba",
      supplier: "Proveedor demo",
      barcode: "7791234567890",
      sale_mode: "unit",
      price: 1850,
      cost_price: 1200,
      stock_current: 20,
      stock_min: 5,
      stock_max: 80,
      is_active: true,
    };

    return downloadXlsx("plantilla-productos", "Plantilla", [templateRow]);
  };

  const parseImportFile = async (file: File): Promise<ProductImportPreview> => {
    const rawRows = await parseXlsxFile(file);

    const validRows: ProductImportParsedRow[] = [];
    const errorRows: ProductImportErrorRow[] = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalized: XlsxRow = {};

      for (const [key, value] of Object.entries(row)) {
        normalized[key.toLowerCase().trim()] = value;
      }

      const parsed = parseImportRow(normalized, rowNumber);
      if ("message" in parsed) {
        errorRows.push(parsed);
        return;
      }

      validRows.push(parsed);
    });

    return {
      fileName: file.name,
      totalRows: rawRows.length,
      validRows,
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

    try {
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
            message: "Conflicto entre code y barcode: apuntan a productos distintos",
          });
          continue;
        }

        const matchedProductId = codeMatch ?? barcodeMatch;

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
                message: "No se encontro el producto para actualizar",
              });
              continue;
            }

            await productsService.update(tenantId, matchedProductId, {
              code: row.code || existing.code,
              name: row.name,
              brand: row.brand,
              supplier: row.supplier,
              is_favorite: row.is_favorite,
              description: row.description,
              category: row.category,
              subcategory: row.subcategory,
              sale_mode: row.sale_mode,
              price: row.price,
              cost_price: row.cost_price,
              stock_current: row.stock_current,
              stock_min: row.stock_min,
              stock_max: row.stock_max,
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

            updated += 1;
            continue;
          }

          const createdProduct = await productsService.create(tenantId, {
            code: row.code || buildProductCode(row.name),
            name: row.name,
            brand: row.brand,
            supplier: row.supplier,
            is_favorite: row.is_favorite,
            description: row.description,
            price: row.price,
            cost_price: row.cost_price,
            stock_current: row.stock_current,
            stock_min: row.stock_min,
            stock_max: row.stock_max,
            category: row.category,
            subcategory: row.subcategory,
            sale_mode: row.sale_mode,
            currency_code: "ARS",
            is_active: row.is_active,
          });

          if (normalizedBarcode) {
            await productsService.setPrimaryBarcode(tenantId, createdProduct.id, normalizedBarcode);
            barcodeToProductId.set(normalizedBarcode, createdProduct.id);
          }

          if (createdProduct.code) {
            codeToProductId.set(createdProduct.code.trim().toUpperCase(), createdProduct.id);
          }

          created += 1;
        } catch (error) {
          importErrors.push({
            rowNumber: row.rowNumber,
            message: error instanceof Error && error.message ? error.message : "Error al importar fila",
          });
        }
      }

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
          errors: importErrors.length,
        },
      });

      await loadProducts();

      if (importErrors.length > 0) {
        setFeedback({
          type: "error",
          message: `Importacion parcial. Creados: ${created} | Actualizados: ${updated} | Saltados: ${skipped} | Errores: ${importErrors.length}`,
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
        errors: importErrors.length,
        errorRows: importErrors,
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
          code: product.code,
          name: product.name,
          brand: product.brand,
          supplier: product.supplier,
          is_favorite: product.is_favorite,
          description: product.description,
          category: product.category,
          subcategory: product.subcategory,
          barcode,
          sale_mode: product.sale_mode,
          price_exported: resolvedPrice,
          price_base: product.price,
          cost_price: product.cost_price,
          stock_current: product.stock_current,
          stock_min: product.stock_min,
          stock_max: product.stock_max,
          is_active: product.is_active,
          price_source: selectedPriceList ? `lista:${selectedPriceList.name}` : "base",
        });
      }

      const fileSuffix = selectedPriceList ? `lista-${selectedPriceList.code}` : "precio-base";
      const fileName = `productos-${fileSuffix}-${new Date().toISOString().slice(0, 10)}`;

      const ok =
        options.format === "xlsx"
          ? await downloadXlsx(fileName, "Productos", rows)
          : downloadCsv(fileName, rows);

      if (ok) {
        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "productos",
          action: "export",
          entity_type: "product",
          entity_id: null,
          description: `Exportacion de productos (${options.format.toUpperCase()})`,
          metadata: {
            rows: rows.length,
            format: options.format,
            price_source: selectedPriceList ? selectedPriceList.id : "base",
          },
        });
      }

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
    parseImportFile,
    applyImportPreview,
    exportProducts,
  };
};
