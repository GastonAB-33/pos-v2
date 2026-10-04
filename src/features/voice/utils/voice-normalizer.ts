/**
 * Utilidades avanzadas para la normalización, deduplicación y corrección
 * fonética de texto proveniente de dictado por voz en español (Web Speech API).
 */

const SPANISH_DIGITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiún: 21,
  veintiuna: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

/**
 * Convierte frases de números en español a dígitos numéricos:
 * ej. "dos mil quinientos" -> "2500"
 * ej. "veinticinco con cincuenta" -> "25.50"
 * ej. "diez coma cinco" -> "10.5"
 */
export const replaceSpokenSpanishNumbers = (text: string): string => {
  if (!text.trim()) return text;

  // 1. Reemplazos directos con conectores decimales ("con", "coma", "punto")
  // ej: "veinticinco con cincuenta" -> "25.50"
  let processed = text;

  // Manejo de decimales hablados: "X con Y", "X coma Y", "X punto Y"
  processed = processed.replace(
    /\b(\d+|[a-záéíóúñ]+)\s+(?:con|coma|punto)\s+(\d+|[a-záéíóúñ]+)\b/gi,
    (match, integerPart, decimalPart) => {
      const intNum = parseSpokenNumberWords(integerPart);
      const decNum = parseSpokenNumberWords(decimalPart);
      if (intNum !== null && decNum !== null) {
        return `${intNum}.${decNum}`;
      }
      return match;
    }
  );

  // 2. Parser secuencial de bloques de palabras numéricas en español
  const words = processed.split(/\s+/);
  const resultWords: string[] = [];
  let numBuffer: string[] = [];

  const flushBuffer = () => {
    if (numBuffer.length === 0) return;
    const phrase = numBuffer.join(" ");
    const parsed = parseSpokenNumberWords(phrase);
    if (parsed !== null) {
      resultWords.push(String(parsed));
    } else {
      resultWords.push(...numBuffer);
    }
    numBuffer = [];
  };

  const isNumericWord = (w: string): boolean => {
    const clean = w.toLowerCase().replace(/[,.:;]/g, "");
    return clean in SPANISH_DIGITS || clean === "mil" || clean === "millon" || clean === "millones" || clean === "y";
  };

  for (const word of words) {
    if (isNumericWord(word)) {
      numBuffer.push(word);
    } else {
      flushBuffer();
      resultWords.push(word);
    }
  }
  flushBuffer();

  return resultWords.join(" ");
};

/**
 * Parsea un conjunto de palabras numéricas en español ("treinta y cinco", "dos mil") a número.
 */
export const parseSpokenNumberWords = (phrase: string): number | null => {
  const clean = phrase.toLowerCase().trim();
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return Number(clean);
  }

  const tokens = clean.split(/\s+/).filter((t) => t !== "y");
  if (tokens.length === 0) return null;

  let total = 0;
  let currentGroup = 0;
  let matchedAny = false;

  for (const token of tokens) {
    if (token in SPANISH_DIGITS) {
      currentGroup += SPANISH_DIGITS[token];
      matchedAny = true;
    } else if (token === "mil") {
      currentGroup = currentGroup === 0 ? 1000 : currentGroup * 1000;
      total += currentGroup;
      currentGroup = 0;
      matchedAny = true;
    } else if (token === "millon" || token === "millones") {
      currentGroup = currentGroup === 0 ? 1000000 : currentGroup * 1000000;
      total += currentGroup;
      currentGroup = 0;
      matchedAny = true;
    } else if (/^\d+$/.test(token)) {
      currentGroup += Number(token);
      matchedAny = true;
    } else {
      return null;
    }
  }

  if (!matchedAny) return null;
  return total + currentGroup;
};

export const normalizeVoiceWord = (w: string): string => {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "");
};

/**
 * Deduplica palabras o frases consecutivas que el motor de voz repite por error:
 * ej. "coca cola coca cola" -> "coca cola"
 * ej. "arroz largo fino arroz largo fino" -> "arroz largo fino"
 * ej. "pilas pilas" -> "pilas"
 * ej. "azúcar azúcar ledesma" -> "azúcar ledesma"
 */
export const deduplicateRepeatedPhrases = (text: string): string => {
  if (!text || !text.trim()) return text;

  const rawWords = text.trim().split(/\s+/);
  if (rawWords.length <= 1) return text;

  let words = [...rawWords];
  let changed = true;

  // Repetir mientras se detecten frases o palabras duplicadas
  while (changed) {
    changed = false;
    const n = words.length;

    // Probar tamaños de frase k desde n/2 hacia abajo hasta 1 (máximo 10 palabras por frase)
    const maxK = Math.min(Math.floor(n / 2), 10);

    for (let k = maxK; k >= 1; k -= 1) {
      for (let i = 0; i <= words.length - 2 * k; i += 1) {
        let match = true;
        for (let j = 0; j < k; j += 1) {
          const w1 = normalizeVoiceWord(words[i + j]);
          const w2 = normalizeVoiceWord(words[i + k + j]);
          if (!w1 || !w2 || w1 !== w2) {
            match = false;
            break;
          }
        }

        if (match) {
          // Eliminar la segunda ocurrencia de la frase repetida de k palabras
          words.splice(i + k, k);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return words.join(" ");
};

/**
 * Une dos fragmentos de transcripción evitando solapamiento (overlap) en la frontera:
 * ej. base: "aceite de" + nuevo: "de girasol natura" -> "aceite de girasol natura"
 * ej. base: "coca cola" + nuevo: "coca cola" -> "coca cola"
 * ej. base: "arroz" + nuevo: "arroz largo fino" -> "arroz largo fino"
 */
export const mergeTranscriptsWithoutOverlap = (base: string, addition: string): string => {
  const cleanBase = base.trim();
  const cleanAddition = addition.trim();

  if (!cleanBase) return cleanAddition;
  if (!cleanAddition) return cleanBase;

  const baseWords = cleanBase.split(/\s+/);
  const addWords = cleanAddition.split(/\s+/);

  // Buscar coincidencia de sufijo en base con prefijo en addition (hasta 8 palabras de solapamiento)
  const maxOverlap = Math.min(baseWords.length, addWords.length, 8);

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const baseTail = baseWords.slice(-overlap).map((w) => normalizeVoiceWord(w)).join(" ");
    const addHead = addWords.slice(0, overlap).map((w) => normalizeVoiceWord(w)).join(" ");

    if (baseTail === addHead) {
      const nonOverlappingAddition = addWords.slice(overlap).join(" ");
      return nonOverlappingAddition ? `${cleanBase} ${nonOverlappingAddition}` : cleanBase;
    }
  }

  // Si addition contiene completamente a base desde el inicio
  const normBase = baseWords.map((w) => normalizeVoiceWord(w)).join(" ");
  const normAdd = addWords.map((w) => normalizeVoiceWord(w)).join(" ");
  if (normAdd.startsWith(normBase)) {
    return cleanAddition;
  }

  // Si base contiene completamente a addition desde el final
  if (normBase.endsWith(normAdd)) {
    return cleanBase;
  }

  return `${cleanBase} ${cleanAddition}`;
};

/**
 * Reemplaza comandos de voz y signos de puntuación dictados:
 * ej. "arroz con leche coma dos kilos punto" -> "arroz con leche, dos kilos."
 */
export const processVoicePunctuationAndCommands = (text: string): { text: string; isReset: boolean } => {
  if (!text) return { text: "", isReset: false };

  const lower = text.toLowerCase().trim();

  // Detección de comandos de borrado o reinicio
  if (
    lower === "borrar todo" ||
    lower === "limpiar" ||
    lower === "limpiar campo" ||
    lower === "borrar" ||
    lower === "cancelar"
  ) {
    return { text: "", isReset: true };
  }

  let formatted = text;

  // Puntuación hablada
  const replacements: Array<[RegExp, string]> = [
    [/\s+\bpunto y aparte\b/gi, "\n"],
    [/\s+\bpunto seguido\b/gi, ". "],
    [/\s+\bpunto y coma\b/gi, "; "],
    [/\s+\bdos puntos\b/gi, ": "],
    [/\s+\bcoma\b/gi, ", "],
    [/\s+\bpunto\b/gi, ". "],
    [/\s+\barroba\b/gi, "@"],
    [/\s+\bguion medio\b|\s+\bguión medio\b|\s+\bguion\b/gi, "-"],
    [/\s+\bguion bajo\b|\s+\bguión bajo\b/gi, "_"],
    [/\s+\bsigno de pregunta\b|\s+\bsigno de interrogacion\b|\s+\bsigno de interrogación\b/gi, "?"],
    [/\s+\bsigno de admiracion\b|\s+\bsigno de admiración\b|\s+\bsigno de exclamacion\b/gi, "!"],
  ];

  for (const [pattern, replacement] of replacements) {
    formatted = formatted.replace(pattern, replacement);
  }

  // Limpiar espacios dobles y espacios huérfanos antes de signos de puntuación
  formatted = formatted
    .replace(/\s+([,.:;?!])/g, "$1")
    .replace(/([,.:;?!])(?=[^\s\d])/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { text: formatted, isReset: false };
};

/**
 * Capitaliza apropiadamente la primera letra de las oraciones:
 * ej. "coca cola zero. botella retornable." -> "Coca cola zero. Botella retornable."
 */
export const autoCapitalizeSentences = (text: string): string => {
  if (!text) return "";
  return text.replace(/(^\s*|\.\s+|\n\s*)([a-záéíóúñ])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
};

export type VoiceFieldType = "text" | "number" | "code" | "currency";

/**
 * Pipeline integral de normalización fonética y contextual para dictado de campos:
 */
export const normalizeVoiceInput = (
  text: string,
  options: {
    fieldType?: VoiceFieldType;
    autoNumbers?: boolean;
    autoPunctuation?: boolean;
    capitalize?: boolean;
  } = {}
): { value: string; isReset: boolean } => {
  const {
    fieldType = "text",
    autoNumbers = true,
    autoPunctuation = true,
    capitalize = true,
  } = options;

  if (!text) return { value: "", isReset: false };

  // 1. Deduplicación de repeticiones continuas del motor
  let processed = deduplicateRepeatedPhrases(text);

  // 2. Comandos y puntuación
  let isReset = false;
  if (autoPunctuation) {
    const punctResult = processVoicePunctuationAndCommands(processed);
    processed = punctResult.text;
    isReset = punctResult.isReset;
  }

  if (isReset) {
    return { value: "", isReset: true };
  }

  // 3. Conversión de números hablados
  if (autoNumbers || fieldType === "number" || fieldType === "currency" || fieldType === "code") {
    processed = replaceSpokenSpanishNumbers(processed);
  }

  // 4. Tratamiento según el tipo de campo
  if (fieldType === "number") {
    // Extraer solo dígitos y punto decimal
    const numMatch = processed.replace(/[^\d.,]/g, "").replace(/,/g, ".");
    return { value: numMatch, isReset: false };
  }

  if (fieldType === "code") {
    // Alfanumérico limpio sin espacios, mayúsculas (código de barras o de producto)
    const codeClean = processed.toUpperCase().replace(/[^A-Z0-9\-_]/g, "");
    return { value: codeClean, isReset: false };
  }

  // 5. Capitalización para campos de texto
  if (capitalize) {
    processed = autoCapitalizeSentences(processed);
  }

  return { value: processed.trim(), isReset: false };
};
