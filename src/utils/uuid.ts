/**
 * Utilidad para generación de identificadores únicos universales (UUID v4).
 *
 * Funciona de forma resiliente tanto en contextos seguros (HTTPS, localhost)
 * como en contextos no seguros (pruebas en red local HTTP sobre IP tipo http://192.168.x.x:5177),
 * donde los navegadores móviles (Chrome/Safari) desactivan `crypto.randomUUID`.
 */

export const generateUuid = (): string => {
  // 1. Si crypto.randomUUID nativo está disponible (Secure Context), usarlo.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // 2. Si crypto.getRandomValues está disponible, generar UUID v4 estándar RFC 4122.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versión 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variante 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 3. Fallback con Math.random si la API Crypto no está disponible.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * Polyfill automático para window.crypto.randomUUID.
 * Previene errores `crypto.randomUUID is not a function` en librerías o código de terceros
 * al navegar mediante IP local (HTTP).
 */
if (typeof window !== "undefined") {
  try {
    if (!window.crypto) {
      // @ts-expect-error Inicializar contenedor crypto si no existiera
      window.crypto = {};
    }
    if (typeof window.crypto.randomUUID !== "function") {
      Object.defineProperty(window.crypto, "randomUUID", {
        value: generateUuid,
        configurable: true,
        writable: true,
      });
    }
  } catch (error) {
    console.warn("[uuid] No se pudo registrar el polyfill de crypto.randomUUID:", error);
  }
}
