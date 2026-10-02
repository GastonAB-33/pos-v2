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

/**
 * Deduplica palabras o frases consecutivas que el motor de voz repite por error:
 * ej. "coca coca cola" -> "coca cola"
 * ej. "arroz largo arroz largo" -> "arroz largo"
 */
export const deduplicateRepeatedPhrases = (text: string): string => {
  if (!text) return "";

  let cleaned = text;

  // 1. Frases de 2 a 4 palabras repetidas consecutivamente:
  // "arroz largo fino arroz largo fino" -> "arroz largo fino"
  cleaned = cleaned.replace(/\b([a-záéíóúñ0-9]+(?:\s+[a-záéíóúñ0-9]+){1,3})\s+\1\b/gi, "$1");

  // 2. Palabras individuales consecutivas repetidas:
  // "tres tres" -> "tres", "coca coca" -> "coca"
  cleaned = cleaned.replace(/\b([a-záéíóúñ0-9]+)\s+\1\b/gi, "$1");

  // Repetir una vez más para casos anidados (ej: "hola hola hola" -> "hola")
  cleaned = cleaned.replace(/\b([a-záéíóúñ0-9]+)\s+\1\b/gi, "$1");

  return cleaned;
};

/**
 * Une dos fragmentos de transcripción evitando solapamiento (overlap) en la frontera:
 * ej. base: "Coca Cola" + nuevo: "Cola Zero" -> "Coca Cola Zero"
 */
export const mergeTranscriptsWithoutOverlap = (base: string, addition: string): string => {
  const cleanBase = base.trim();
  const cleanAddition = addition.trim();

  if (!cleanBase) return cleanAddition;
  if (!cleanAddition) return cleanBase;

  const baseWords = cleanBase.split(/\s+/);
  const addWords = cleanAddition.split(/\s+/);

  // Buscar coincidencia de sufijo en base con prefijo en addition (hasta 5 palabras de solapamiento)
  const maxOverlap = Math.min(baseWords.length, addWords.length, 5);

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const baseTail = baseWords.slice(-overlap).map((w) => w.toLowerCase()).join(" ");
    const addHead = addWords.slice(0, overlap).map((w) => w.toLowerCase()).join(" ");

    if (baseTail === addHead) {
      const nonOverlappingAddition = addWords.slice(overlap).join(" ");
      return nonOverlappingAddition ? `${cleanBase} ${nonOverlappingAddition}` : cleanBase;
    }
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
