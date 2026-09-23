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

  const strippedQuery = compactQuery.replace(/^0+/, "");
  const strippedCode = compactCode.replace(/^0+/, "");
  const hasLeadingZeros = compactQuery.length > strippedQuery.length;

  const matchesCode = Boolean(
    compactCode &&
    (
      compactCode.startsWith(compactQuery) ||
      (strippedQuery && strippedCode && strippedCode === strippedQuery) ||
      (!hasLeadingZeros && strippedQuery && strippedCode && strippedCode.startsWith(strippedQuery))
    )
  );

  const matchesBarcode = compactBarcodes.some((b) => {
    const strippedB = b.replace(/^0+/, "");
    return (
      b.startsWith(compactQuery) ||
      (strippedQuery && strippedB && strippedB === strippedQuery) ||
      (!hasLeadingZeros && strippedQuery && strippedB && strippedB.startsWith(strippedQuery))
    );
  });

  // 1. Ámbito: Solo por nombre
  if (scope === "name") {
    const normName = normalizeSearchQuery(item.name);
    if (normName.includes(normQuery)) return true;
    const queryWords = normQuery.split(/\s+/).filter(Boolean);
    return queryWords.length > 1 && queryWords.every((word) => normName.includes(word));
  }

  // 2. Ámbito: Solo por código de producto (o PLU)
  if (scope === "code") {
    return matchesCode;
  }

  // 3. Ámbito: Solo por código de barras
  if (scope === "barcode") {
    return matchesBarcode;
  }

  // 4. Ámbito: "all" (búsqueda general por nombre, código o barra)
  if (matchesCode || matchesBarcode) {
    return true;
  }

  // Coincidencia por nombre
  const normName = normalizeSearchQuery(item.name);
  if (normName.includes(normQuery)) return true;

  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  if (queryWords.length > 1 && queryWords.every((word) => normName.includes(word))) {
    return true;
  }

  // Coincidencia por categoría, subcategoría, marca o proveedor
  const otherFields = [item.category, item.subcategory, item.brand, item.supplier]
    .map((f) => normalizeSearchQuery(f))
    .filter(Boolean);

  if (otherFields.some((f) => f.includes(normQuery))) {
    return true;
  }

  return false;
};
