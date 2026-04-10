import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

export interface ProductVoiceSuggestions {
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  sale_mode: ProductFormValues["saleMode"] | null;
  barcode: string | null;
  price: number | null;
  cost: number | null;
  stock_initial: number | null;
}

export interface ProductVoiceTranscriptionResult {
  provider: string;
  transcript: string;
}

export interface ProductVoiceAnalyzeResult {
  provider: string;
  transcript: string;
  suggestions: ProductVoiceSuggestions;
  warnings: string[];
}

export interface ProductVoiceTranscribeOptions {
  signal?: AbortSignal;
}

export interface ProductVoiceParserOptions {
  provider?: ProductVoiceProvider;
}

export interface ProductVoiceProvider {
  name: string;
  transcribeAudio: (
    audioBlob: Blob,
    options?: ProductVoiceTranscribeOptions
  ) => Promise<ProductVoiceTranscriptionResult>;
  parseTranscript: (transcript: string) => Promise<ProductVoiceSuggestions>;
}

const normalizeText = (value: string) => value.trim();

const toNumber = (raw: string): number | null => {
  const normalized = raw.trim().replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const matchText = (transcript: string, pattern: RegExp): string | null => {
  const match = transcript.match(pattern);
  if (!match?.[1]) return null;
  return normalizeText(match[1]);
};

const parseTranscriptToSuggestions = (rawTranscript: string): ProductVoiceSuggestions => {
  const transcript = normalizeText(rawTranscript);
  const lower = transcript.toLowerCase();

  const barcodeMatch = lower.match(/\b\d{8,14}\b/);
  const priceText =
    matchText(lower, /(?:precio|vale|venta)\s*(?:de)?\s*\$?\s*([\d.,]+)/i) ??
    matchText(lower, /(?:precio)\s*final\s*(?:de)?\s*\$?\s*([\d.,]+)/i);
  const costText = matchText(lower, /(?:costo|coste)\s*(?:de)?\s*\$?\s*([\d.,]+)/i);
  const stockText =
    matchText(lower, /(?:stock(?:\s*inicial)?|cantidad)\s*(?:de)?\s*([\d.,]+)/i) ??
    matchText(lower, /(?:arranca|inicia)\s*(?:con)?\s*([\d.,]+)\s*(?:unidades|u)?/i);

  const name =
    matchText(lower, /(?:nombre|producto)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i) ??
    matchText(lower, /^([^.,;]{3,80})/i);

  const description = matchText(
    lower,
    /(?:descripcion|detalle)\s*(?:es)?\s*[:\-]?\s*([^.;]+)/i
  );
  const category = matchText(lower, /(?:categoria|rubro)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i);
  const subcategory = matchText(
    lower,
    /(?:subcategoria|subrubro)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i
  );
  const brand = matchText(lower, /(?:marca)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i);

  let saleMode: ProductFormValues["saleMode"] = "unit";
  if (/\b(peso|granel|kilo|kilogramo|kg)\b/i.test(lower)) {
    saleMode = "weight";
  }

  return {
    name: name ? name.replace(/\s+/g, " ").trim() : null,
    description: description ? description.replace(/\s+/g, " ").trim() : null,
    category: category ? category.replace(/\s+/g, " ").trim() : null,
    subcategory: subcategory ? subcategory.replace(/\s+/g, " ").trim() : null,
    brand: brand ? brand.replace(/\s+/g, " ").trim() : null,
    sale_mode: saleMode,
    barcode: barcodeMatch?.[0] ?? null,
    price: priceText ? toNumber(priceText) : null,
    cost: costText ? toNumber(costText) : null,
    stock_initial: stockText ? toNumber(stockText) : null,
  };
};

const mockProvider: ProductVoiceProvider = {
  name: "mock-voice-v1",
  transcribeAudio: async (audioBlob, options) => {
    if (options?.signal?.aborted) {
      throw new DOMException("Operacion cancelada", "AbortError");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const transcript =
      audioBlob.size > 0
        ? "producto nombre arroz largo fino marca molinos categoria almacen subcategoria secos precio 2400 costo 1900 stock inicial 10"
        : "";

    return {
      provider: "mock-voice-v1-transcriber",
      transcript,
    };
  },
  parseTranscript: async (transcript) => parseTranscriptToSuggestions(transcript),
};

export const productVoiceService = {
  async transcribeAudio(
    audioBlob: Blob,
    options: ProductVoiceTranscribeOptions = {},
    provider: ProductVoiceProvider = mockProvider
  ): Promise<ProductVoiceTranscriptionResult> {
    return provider.transcribeAudio(audioBlob, options);
  },

  async analyzeTranscript(
    transcript: string,
    options: ProductVoiceParserOptions = {}
  ): Promise<ProductVoiceAnalyzeResult> {
    const provider = options.provider ?? mockProvider;
    const suggestions = await provider.parseTranscript(transcript);

    const warnings: string[] = [];
    if (!suggestions.name) warnings.push("No se pudo inferir el nombre del producto.");
    if (!suggestions.category) warnings.push("No se pudo inferir la categoria.");
    if (suggestions.price == null) warnings.push("No se detecto un precio.");

    return {
      provider: provider.name,
      transcript,
      suggestions,
      warnings,
    };
  },
};

