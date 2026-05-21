import { auditService } from "@/services/audit.service";
import { productsService as baseProductsService } from "@/services/products.service";
import { usersService } from "@/services/users.service";
import type { Product as ProductEntity } from "@/types/entities";
import type { Product, ProductAuditEntry, ProductViewModel } from "@/modules/productos/types/product.types";
import { DEFAULT_IVA_PERCENT, roundMoney, roundPercent } from "@/modules/productos/utils/product-pricing";

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? "";

const resolvePriceWithoutVat = (product: ProductEntity): number => {
  if (typeof product.price_without_vat === "number") {
    return roundMoney(product.price_without_vat);
  }

  const iva = typeof product.vat_percent === "number" ? product.vat_percent : DEFAULT_IVA_PERCENT;
  return roundMoney(product.price / (1 + iva / 100));
};

const resolveProfitPercent = (product: ProductEntity, precioSinIva: number): number => {
  if (typeof product.profit_percent === "number") {
    return roundPercent(product.profit_percent);
  }

  if (product.cost_price <= 0) {
    return 0;
  }

  const gain = ((precioSinIva - product.cost_price) / product.cost_price) * 100;
  return roundPercent(gain);
};

const PRODUCT_AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Alta de producto",
  update: "Actualizacion de producto",
  bulk_import: "Carga masiva",
  toggle_active: "Cambio de estado",
  toggle_favorite: "Cambio de favorito",
};

const PRODUCT_AUDIT_ALLOWED_ACTIONS = new Set(Object.keys(PRODUCT_AUDIT_ACTION_LABELS));

type MetadataRecord = Record<string, unknown>;

const formatAuditValue = (value: unknown, kind: "text" | "money" | "number" | "boolean"): string => {
  if (kind === "boolean") {
    if (typeof value !== "boolean") return "-";
    return value ? "Sí" : "No";
  }

  if (kind === "money") {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (kind === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(value);
  }

  if (typeof value !== "string") return "-";
  return value.trim() || "-";
};

const sameAuditValue = (left: unknown, right: unknown): boolean => {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.0001;
  }

  if (typeof left === "string" && typeof right === "string") {
    return left.trim() === right.trim();
  }

  return left === right;
};

const summarizeProductUpdate = (description: string, metadata: Record<string, unknown> | null): string => {
  if (!metadata) return description;
  const productName = formatAuditValue(metadata.next_name ?? metadata.previous_name, "text");

  const fields: Array<{
    label: string;
    previousKey: string;
    nextKey: string;
    kind: "text" | "money" | "number" | "boolean";
  }> = [
    { label: "precio final", previousKey: "previous_price", nextKey: "next_price", kind: "money" },
    { label: "precio costo", previousKey: "previous_cost_price", nextKey: "next_cost_price", kind: "money" },
    { label: "stock", previousKey: "previous_stock_current", nextKey: "next_stock_current", kind: "number" },
    { label: "categoría", previousKey: "previous_category", nextKey: "next_category", kind: "text" },
    { label: "subcategoría", previousKey: "previous_subcategory", nextKey: "next_subcategory", kind: "text" },
    { label: "código", previousKey: "previous_code", nextKey: "next_code", kind: "text" },
    { label: "cód. barras", previousKey: "previous_barcode", nextKey: "next_barcode", kind: "text" },
    { label: "nombre", previousKey: "previous_name", nextKey: "next_name", kind: "text" },
    { label: "% IVA", previousKey: "previous_vat_percent", nextKey: "next_vat_percent", kind: "number" },
    { label: "% ganancia", previousKey: "previous_profit_percent", nextKey: "next_profit_percent", kind: "number" },
    {
      label: "precio sin IVA",
      previousKey: "previous_price_without_vat",
      nextKey: "next_price_without_vat",
      kind: "money",
    },
    { label: "activo", previousKey: "previous_is_active", nextKey: "next_is_active", kind: "boolean" },
    { label: "favorito", previousKey: "previous_is_favorite", nextKey: "next_is_favorite", kind: "boolean" },
  ];

  const firstChange = fields
    .filter((field) => field.previousKey in metadata && field.nextKey in metadata)
    .filter((field) => !sameAuditValue(metadata[field.previousKey], metadata[field.nextKey]))
    .map((field) => {
      const previous = formatAuditValue(metadata[field.previousKey], field.kind);
      const next = formatAuditValue(metadata[field.nextKey], field.kind);
      return `${field.label}: ${previous} -> ${next}`;
    })[0];

  if (!firstChange) return description;
  if (productName !== "-") return `${productName} - ${firstChange}`;
  return firstChange;
};

export const getProductAuditActionLabel = (action: string): string => {
  return PRODUCT_AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ");
};

export const mapEntityToProductViewModel = (
  product: ProductEntity,
  barcode: string | null | undefined
): ProductViewModel => {
  const precioSinIva = resolvePriceWithoutVat(product);
  const porcentajeIva = roundPercent(product.vat_percent ?? DEFAULT_IVA_PERCENT);
  const porcentajeGanancia = resolveProfitPercent(product, precioSinIva);

  return {
    entity: product,
    barcode: barcode ?? "",
    imagenUrl: product.image_url ?? "",
    nombre: product.name,
    codigoProducto: product.code,
    codigoBarras: barcode ?? "",
    saleMode: product.sale_mode,
    categoria: product.category,
    subcategoria: product.subcategory ?? "",
    proveedor: product.supplier ?? "",
    precioCosto: roundMoney(product.cost_price),
    porcentajeGanancia,
    precioSinIva,
    porcentajeIva,
    precioFinal: roundMoney(product.price),
    stock: product.stock_current,
    favorito: product.is_favorite,
    activo: product.is_active,
  };
};

export const mapEntityToProduct = (
  product: ProductEntity,
  barcode: string | null | undefined
): Product => {
  const vm = mapEntityToProductViewModel(product, barcode);

  return {
    id: product.id,
    tenant_id: product.tenant_id,
    imagen_url: product.image_url ?? "",
    nombre: vm.nombre,
    codigo_barras: vm.codigoBarras,
    codigo_producto: vm.codigoProducto,
    categoria: vm.categoria,
    subcategoria: vm.subcategoria,
    precio_costo: vm.precioCosto,
    porcentaje_ganancia: vm.porcentajeGanancia,
    precio_sin_iva: vm.precioSinIva,
    porcentaje_iva: vm.porcentajeIva,
    precio_final: vm.precioFinal,
    stock: vm.stock,
    is_favorite: vm.favorito,
    is_active: vm.activo,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
};

export const getProductAuditLog = async (tenantId: string, limit = 24): Promise<ProductAuditEntry[]> => {
  const [logs, users] = await Promise.all([
    auditService.getByFilters(tenantId, { module: "productos" }),
    usersService.getAllByTenant(tenantId),
  ]);

  const userById = new Map(users.map((user) => [user.id, normalizeText(user.full_name) || normalizeText(user.username) || normalizeText(user.email)]));

  return logs
    .filter((row) => PRODUCT_AUDIT_ALLOWED_ACTIONS.has(row.action))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      date: row.created_at,
      user: userById.get(row.user_id ?? "") || "Sistema",
      action: getProductAuditActionLabel(row.action),
      description:
        row.action === "update"
          ? summarizeProductUpdate(row.description, (row.metadata as MetadataRecord | null) ?? null)
          : row.description,
    }));
};

export const productsModuleService = {
  ...baseProductsService,
  getProductAuditLog,
};
