import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

export interface ProductImageSuggestions {
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  sale_mode: ProductFormValues["saleMode"] | null;
  barcode: string | null;
  suggested_price: number | null;
}

export interface ProductImageAnalyzeResult {
  provider: string;
  suggestions: ProductImageSuggestions;
  processed_image: {
    width: number;
    height: number;
    mime_type: string;
    bytes: number;
  };
  warnings: string[];
}

export interface ProductImageAnalyzeOptions {
  signal?: AbortSignal;
  maxOriginalBytes?: number;
  maxAnalyzeBytes?: number;
  maxDimension?: number;
  jpegQuality?: number;
  provider?: ProductImageAiProvider;
}

interface PreparedImagePayload {
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  blob: Blob;
  dataUrl: string;
}

export interface ProductImageAiProvider {
  name: string;
  analyze: (input: PreparedImagePayload, signal?: AbortSignal) => Promise<ProductImageSuggestions>;
}

const DEFAULT_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_ANALYZE_BYTES = 1_500_000;
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.82;

const toDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen procesada"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });

const blobFromCanvas = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo preparar la imagen para analisis"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });

const preprocessImage = async (
  file: File,
  options: Required<Pick<ProductImageAnalyzeOptions, "maxAnalyzeBytes" | "maxDimension" | "jpegQuality">>
): Promise<PreparedImagePayload> => {
  const imageBitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, options.maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
    const width = Math.max(1, Math.round(imageBitmap.width * scale));
    const height = Math.max(1, Math.round(imageBitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo inicializar el canvas para analisis de imagen");
    }

    ctx.drawImage(imageBitmap, 0, 0, width, height);

    let quality = options.jpegQuality;
    let processed = await blobFromCanvas(canvas, quality);

    while (processed.size > options.maxAnalyzeBytes && quality > 0.45) {
      quality = Number((quality - 0.1).toFixed(2));
      processed = await blobFromCanvas(canvas, quality);
    }

    if (processed.size > options.maxAnalyzeBytes) {
      throw new Error("La imagen sigue siendo muy pesada despues de comprimir");
    }

    return {
      fileName: file.name,
      mimeType: processed.type || "image/jpeg",
      width,
      height,
      bytes: processed.size,
      blob: processed,
      dataUrl: await toDataUrl(processed),
    };
  } finally {
    imageBitmap.close();
  }
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const inferMockSuggestions = (fileName: string): ProductImageSuggestions => {
  const normalized = normalizeText(fileName.replace(/\.[^.]+$/, ""));

  const barcodeMatch = normalized.match(/\b\d{8,14}\b/);

  const brandCandidates = [
    "coca cola",
    "coca-cola",
    "pepsi",
    "arcor",
    "la serenisima",
    "serenisima",
    "quilmes",
    "natura",
    "bagley",
    "molinos",
  ];

  const brand = brandCandidates.find((candidate) => normalized.includes(candidate));

  const categoryRules: Array<{
    terms: string[];
    category: string;
    subcategory: string;
    saleMode: ProductFormValues["saleMode"];
    price: number;
  }> = [
    {
      terms: ["yerba", "mate"],
      category: "Almacen",
      subcategory: "Infusiones",
      saleMode: "weight",
      price: 5500,
    },
    {
      terms: ["cafe"],
      category: "Almacen",
      subcategory: "Infusiones",
      saleMode: "weight",
      price: 6900,
    },
    {
      terms: ["gaseosa", "cola", "bebida"],
      category: "Bebidas",
      subcategory: "Gaseosas",
      saleMode: "unit",
      price: 2800,
    },
    {
      terms: ["galleta", "cookie", "bizcocho"],
      category: "Almacen",
      subcategory: "Galletitas",
      saleMode: "unit",
      price: 1900,
    },
    {
      terms: ["detergente", "lavandina", "limpieza"],
      category: "Limpieza",
      subcategory: "Hogar",
      saleMode: "unit",
      price: 3400,
    },
    {
      terms: ["arroz", "fideo", "harina", "azucar"],
      category: "Almacen",
      subcategory: "Secos",
      saleMode: "weight",
      price: 2400,
    },
  ];

  const matchedRule = categoryRules.find((rule) => rule.terms.some((term) => normalized.includes(term)));

  const nameBase = normalized
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const name = nameBase
    ? nameBase
        .split(" ")
        .slice(0, 6)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;

  const safeBrand = brand
    ? brand
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;

  const description = name
    ? `Producto sugerido por analisis de imagen: ${name}${safeBrand ? ` - Marca ${safeBrand}` : ""}.`
    : null;

  return {
    name,
    description,
    category: matchedRule?.category ?? null,
    subcategory: matchedRule?.subcategory ?? null,
    brand: safeBrand,
    sale_mode: matchedRule?.saleMode ?? "unit",
    barcode: barcodeMatch?.[0] ?? null,
    suggested_price: matchedRule?.price ?? null,
  };
};

const mockProvider: ProductImageAiProvider = {
  name: "mock-vision-v1",
  analyze: async (input, signal) => {
    if (signal?.aborted) {
      throw new DOMException("Operacion cancelada", "AbortError");
    }

    await new Promise((resolve) => setTimeout(resolve, 850));

    if (signal?.aborted) {
      throw new DOMException("Operacion cancelada", "AbortError");
    }

    return inferMockSuggestions(input.fileName);
  },
};

export const productImageService = {
  async analyzeImage(file: File, options: ProductImageAnalyzeOptions = {}): Promise<ProductImageAnalyzeResult> {
    const maxOriginalBytes = options.maxOriginalBytes ?? DEFAULT_MAX_ORIGINAL_BYTES;
    const maxAnalyzeBytes = options.maxAnalyzeBytes ?? DEFAULT_MAX_ANALYZE_BYTES;
    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;

    if (file.size > maxOriginalBytes) {
      throw new Error(`La imagen supera el maximo permitido (${Math.round(maxOriginalBytes / 1024 / 1024)}MB)`);
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("El archivo seleccionado no es una imagen valida");
    }

    const prepared = await preprocessImage(file, {
      maxAnalyzeBytes,
      maxDimension,
      jpegQuality,
    });

    const provider = options.provider ?? mockProvider;
    const suggestions = await provider.analyze(prepared, options.signal);

    const warnings: string[] = [];
    if (!suggestions.name) warnings.push("No se detecto nombre con confianza.");
    if (!suggestions.barcode) warnings.push("No se detecto codigo de barras.");

    return {
      provider: provider.name,
      suggestions,
      processed_image: {
        width: prepared.width,
        height: prepared.height,
        mime_type: prepared.mimeType,
        bytes: prepared.bytes,
      },
      warnings,
    };
  },
};
