export type ProductSearchScope = "all" | "name" | "code" | "barcode";

export interface ProductSearchItem {
  name: string;
  code?: string | null;
  barcode?: string | null;
  barcodes?: string[];
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  supplier?: string | null;
}

export const PRODUCT_SEARCH_SCOPE_OPTIONS: Array<{ value: ProductSearchScope; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "name", label: "Solo nombre" },
  { value: "code", label: "Solo código" },
  { value: "barcode", label: "Solo código de barras" },
];

export const getSearchPlaceholder = (scope: ProductSearchScope = "all"): string => {
  switch (scope) {
    case "name":
      return "Buscar solo por nombre...";
    case "code":
      return "Buscar solo por código de producto o PLU...";
    case "barcode":
      return "Buscar solo por código de barras...";
    case "all":
    default:
      return "Buscar por nombre, código o barra...";
  }
};

/**
 * Normaliza un texto para búsquedas insensibles a mayúsculas, minúsculas,
 * tildes y signos diacríticos (ej: "Jamón" -> "jamon", "PIÑA" -> "pina").
 */
export const normalizeSearchQuery = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Comprueba si un producto cumple con los criterios de búsqueda según el ámbito seleccionado.
 */
export const matchesProductSearch = (
  item: ProductSearchItem,
  query: string,
  scope: ProductSearchScope = "all"
): boolean => {
  const normQuery = normalizeSearchQuery(query);
  if (!normQuery) return true;

  const compactQuery = normQuery.replace(/\s+/g, "");
  const normCode = normalizeSearchQuery(item.code);
  const compactCode = normCode.replace(/\s+/g, "");

  const allBarcodes = [
    ...(item.barcode ? [item.barcode] : []),
    ...(item.barcodes ?? []),
  ]
    .map((b) => normalizeSearchQuery(b))
    .filter(Boolean);
  const compactBarcodes = allBarcodes.map((b) => b.replace(/\s+/g, ""));

  // 1. Ámbito: Solo por nombre
  if (scope === "name") {
    const normName = normalizeSearchQuery(item.name);
    return normName.includes(normQuery);
  }

  // 2. Ámbito: Solo por código de producto (o PLU)
  if (scope === "code") {
    if (!compactCode) return false;
    const strippedQuery = compactQuery.replace(/^0+/, "");
    const strippedCode = compactCode.replace(/^0+/, "");

    return (
      compactCode.includes(compactQuery) ||
      compactQuery.includes(compactCode) ||
      (Boolean(strippedQuery) && Boolean(strippedCode) && strippedCode === strippedQuery)
    );
  }

  // 3. Ámbito: Solo por código de barras
  if (scope === "barcode") {
    if (!compactBarcodes.length) return false;
    return compactBarcodes.some(
      (b) => b.includes(compactQuery) || compactQuery.includes(b)
    );
  }

  // 4. Ámbito: "all" (búsqueda general por nombre, código o barra)
  // Coincidencia por código de producto o PLU
  if (compactCode) {
    if (compactCode.includes(compactQuery) || compactQuery.includes(compactCode)) return true;
    const strippedQuery = compactQuery.replace(/^0+/, "");
    const strippedCode = compactCode.replace(/^0+/, "");
    if (strippedQuery && strippedCode && strippedCode === strippedQuery) return true;
  }

  // Coincidencia por códigos de barras
  if (compactBarcodes.some((b) => b.includes(compactQuery) || compactQuery.includes(b))) {
    return true;
  }

  // Coincidencia por nombre
  const normName = normalizeSearchQuery(item.name);
  if (normName.includes(normQuery)) return true;

  // Coincidencia por categoría, subcategoría, marca o proveedor
  const normCategory = normalizeSearchQuery(item.category);
  if (normCategory.includes(normQuery)) return true;

  const normSubcategory = normalizeSearchQuery(item.subcategory);
  if (normSubcategory.includes(normQuery)) return true;

  const normBrand = normalizeSearchQuery(item.brand);
  if (normBrand.includes(normQuery)) return true;

  const normSupplier = normalizeSearchQuery(item.supplier);
  if (normSupplier.includes(normQuery)) return true;

  return false;
};
