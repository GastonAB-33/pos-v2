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
    nombre: product.name,
    codigoProducto: product.code,
    codigoBarras: barcode ?? "",
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
      description: row.description,
    }));
};

export const productsModuleService = {
  ...baseProductsService,
  getProductAuditLog,
};
