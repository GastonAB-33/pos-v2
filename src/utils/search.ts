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

/**
 * Calcula un puntaje de relevancia (score) para ordenar productos según la consulta del usuario.
 * Prioriza coincidencias exactas por nombre, palabras completas (ej: "PAPA" antes que "PAPAS FRITAS"),
 * códigos exactos, productos pesables/frescos, y penaliza nombres excesivamente largos.
 */
export const calculateProductSearchScore = (
  item: ProductSearchItem & { sale_mode?: string },
  query: string
): number => {
  const normQuery = normalizeSearchQuery(query);
  if (!normQuery) return 0;

  const normName = normalizeSearchQuery(item.name);
  const compactQuery = normQuery.replace(/\s+/g, "");
  const normCode = normalizeSearchQuery(item.code);
  const compactCode = normCode.replace(/\s+/g, "");

  const allBarcodes = [
    ...(item.barcode ? [item.barcode] : []),
    ...(item.barcodes ?? []),
  ]
    .map((b) => normalizeSearchQuery(b))
    .filter(Boolean);

  let score = 0;

  // 1. Coincidencia exacta de código o código de barras (prioridad máxima)
  if (compactCode && compactCode === compactQuery) {
    score += 1500;
  } else if (allBarcodes.some((b) => b === compactQuery || b.replace(/\s+/g, "") === compactQuery)) {
    score += 1500;
  } else if (compactCode && compactCode.startsWith(compactQuery)) {
    score += 1200;
  } else if (allBarcodes.some((b) => b.startsWith(compactQuery))) {
    score += 1200;
  }

  // 2. Coincidencia por Nombre
  if (normName === normQuery) {
    // Nombre idéntico exacto: ej. "PAPA" === "PAPA"
    score += 1000;
  } else if (normName.startsWith(normQuery + " ") || normName.startsWith(normQuery + "-")) {
    // Empieza con la palabra exacta: ej. "PAPA NEGRA", "PAPA BLANCA", "PAPA CEPILLADA"
    score += 850;
  } else {
    // Contiene la palabra exacta aislada: ej. "BOLSA DE PAPA CEPILLADA"
    const wordBoundaryRegex = new RegExp(`(^|\\s|[-_/])${normQuery}(\\s|[-_/]|$)`, "i");
    if (wordBoundaryRegex.test(normName)) {
      score += 700;
    } else if (normName.startsWith(normQuery)) {
      // Empieza con el prefijo: ej. "PAPAS FRITAS"
      score += 500;
    } else if (normName.includes(normQuery)) {
      // Contiene la subcadena en cualquier parte: ej. "PAN DE PANCHO DE PAPA"
      score += 300;
    }
  }

  // 3. Bonus para productos pesables / frescos cuando la búsqueda coincide con el nombre
  // (Muchas verduras y frutas se llaman exactamente con 1 sola palabra, ej "PAPA", "CEBOLLA", "TOMATE")
  if (score > 0 && item.sale_mode === "weight") {
    score += 150;
  }

  const categoryNorm = normalizeSearchQuery(item.category);
  if (score > 0 && (categoryNorm.includes("verdura") || categoryNorm.includes("fruta") || categoryNorm.includes("pesable") || categoryNorm.includes("fresco"))) {
    score += 100;
  }

  // 4. Bonus por concisión: nombres más cortos y directos son más relevantes que descripciones largas
  if (score > 0) {
    score += Math.max(0, 40 - normName.length);
  }

  return score;
};

/**
 * Filtra y ordena productos por relevancia de búsqueda inteligente.
 */
export const searchAndRankProducts = <T extends ProductSearchItem & { id: string; sale_mode?: string }>(
  items: T[],
  query: string,
  scope: ProductSearchScope = "all",
  barcodesByProductId?: Map<string, string[]>,
  limit: number = 30
): T[] => {
  const rawQuery = query.trim();
  if (!rawQuery) return [];

  // 1. Filtrar los que coinciden
  const matching = items.filter((item) => {
    const barcodes = barcodesByProductId?.get(item.id) ?? (item.barcodes ?? []);
    return matchesProductSearch(
      {
        ...item,
        barcodes,
      },
      rawQuery,
      scope
    );
  });

  // 2. Ordenar por score de relevancia descendente
  matching.sort((a, b) => {
    const barcodesA = barcodesByProductId?.get(a.id) ?? (a.barcodes ?? []);
    const barcodesB = barcodesByProductId?.get(b.id) ?? (b.barcodes ?? []);

    const scoreA = calculateProductSearchScore(
      { ...a, barcodes: barcodesA },
      rawQuery
    );
    const scoreB = calculateProductSearchScore(
      { ...b, barcodes: barcodesB },
      rawQuery
    );

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // Desempate por orden alfabético
    return a.name.localeCompare(b.name, "es-AR");
  });

  return matching.slice(0, limit);
};
