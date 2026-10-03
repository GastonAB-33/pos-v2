import { replaceSpokenSpanishNumbers } from "@/features/voice/utils/voice-normalizer";

export interface ProductVoiceSuggestions {
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  sale_mode: "unit" | "weight" | null;
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
  transcribeAudio?: (
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

/**
 * Parser inteligente offline basado en reglas fonéticas y números en español.
 */
export const parseTranscriptToSuggestions = (rawTranscript: string): ProductVoiceSuggestions => {
  // Primero convertimos números hablados a números arábigos:
  // "precio mil quinientos costo novecientos" -> "precio 1500 costo 900"
  const transcriptWithNumbers = replaceSpokenSpanishNumbers(rawTranscript);
  const transcript = normalizeText(transcriptWithNumbers);
  const lower = transcript.toLowerCase();

  const barcodeMatch = lower.match(/\b\d{8,14}\b/);
  const priceText =
    matchText(lower, /(?:precio|vale|venta|precio final)\s*(?:de)?\s*\$?\s*([\d.,]+)/i) ??
    matchText(lower, /(?:a|por)\s*\$?\s*([\d.,]+)\s*(?:pesos)?/i);

  const costText =
    matchText(lower, /(?:costo|coste|costo de compra)\s*(?:de)?\s*\$?\s*([\d.,]+)/i);

  const stockText =
    matchText(lower, /(?:stock(?:\s*inicial)?|cantidad|unidades)\s*(?:de)?\s*([\d.,]+)/i) ??
    matchText(lower, /(?:arranca|inicia|hay|tenemos)\s*(?:con)?\s*([\d.,]+)\s*(?:unidades|u|paquetes|cajas)?/i);

  let name =
    matchText(lower, /(?:nombre|producto|articulo|artículo)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i) ??
    matchText(lower, /^([^.,;]{3,80})/i);

  const description = matchText(
    lower,
    /(?:descripcion|descripción|detalle)\s*(?:es)?\s*[:\-]?\s*([^.;]+)/i
  );
  const category = matchText(
    lower,
    /(?:categoria|categoría|rubro)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i
  );
  const subcategory = matchText(
    lower,
    /(?:subcategoria|subcategoría|subrubro)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i
  );
  const brand = matchText(lower, /(?:marca)\s*(?:es)?\s*[:\-]?\s*([^.,;]+)/i);

  let saleMode: "unit" | "weight" = "unit";
  if (/\b(peso|pesable|granel|kilo|kilos|kilogramo|kilogramos|kg|gramos|gr)\b/i.test(lower)) {
    saleMode = "weight";
  }

  // Si el nombre capturado incluye frases clave de otros campos, limpiarlo
  if (name) {
    name = name
      .replace(/\b(precio|costo|stock|marca|categoria|codigo|código)\b.*$/i, "")
      .trim();
    // Capitalizar nombre de producto
    name = name.charAt(0).toUpperCase() + name.slice(1);
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

/**
 * Proveedor offline rápido (0ms latencia, sin costos)
 */
const smartOfflineProvider: ProductVoiceProvider = {
  name: "ia-pos-voice-v2",
  parseTranscript: async (transcript) => parseTranscriptToSuggestions(transcript),
};

/**
 * Proveedor con Gemini AI si la API Key está disponible en el entorno
 */
const geminiAiProvider: ProductVoiceProvider = {
  name: "gemini-flash-voice-v2",
  parseTranscript: async (transcript) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-gemini-api-key") {
      return parseTranscriptToSuggestions(transcript);
    }

    try {
      const prompt = `Actúa como asistente de punto de venta (POS) para un comercio en Argentina.
Analiza la siguiente transcripción de voz dictada por un comerciante y extrae la información del producto en formato JSON:
"${transcript}"

Responde EXCLUSIVAMENTE un objeto JSON válido con estas claves:
{
  "name": string o null (nombre del producto limpio y capitalizado),
  "description": string o null,
  "category": string o null,
  "subcategory": string o null,
  "brand": string o null,
  "sale_mode": "unit" o "weight",
  "barcode": string o null,
  "price": number o null,
  "cost": number o null,
  "stock_initial": number o null
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (!response.ok) {
        return parseTranscriptToSuggestions(transcript);
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return parseTranscriptToSuggestions(transcript);

      const parsed = JSON.parse(rawText) as ProductVoiceSuggestions;
      return parsed;
    } catch {
      return parseTranscriptToSuggestions(transcript);
    }
  },
};

export const productVoiceService = {
  async analyzeTranscript(
    transcript: string,
    options: ProductVoiceParserOptions = {}
  ): Promise<ProductVoiceAnalyzeResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const hasValidGeminiKey = Boolean(apiKey && apiKey !== "your-gemini-api-key");

    const defaultProvider = hasValidGeminiKey ? geminiAiProvider : smartOfflineProvider;
    const provider = options.provider ?? defaultProvider;
    const suggestions = await provider.parseTranscript(transcript);

    const warnings: string[] = [];
    if (!suggestions.name) warnings.push("No se pudo inferir el nombre del producto.");
    if (!suggestions.category) warnings.push("No se detectó la categoría.");
    if (suggestions.price == null) warnings.push("No se detectó un precio de venta.");

    return {
      provider: provider.name,
      transcript,
      suggestions,
      warnings,
    };
  },
};
