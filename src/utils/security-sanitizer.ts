/**
 * Utilidades de Sanitización y Blindaje de Datos (POS V2 Security Shield)
 * Previene XSS, inyecciones de script, filtración de datos sensibles en logs y redirecciones abiertas.
 */

/**
 * Sanitiza cadenas de texto ingresadas por usuarios para prevenir XSS.
 * Remueve etiquetas <script>, eventos inline (onload, onerror) y secuencias peligrosas.
 */
export function sanitizeInputText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .trim();
}

/**
 * Sanitiza nombres de archivos subidos por usuarios.
 * Elimina secuencias de directory traversal (../) y caracteres no permitidos.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.{2,}/g, ".")
    .trim();
}

/**
 * Enmascara datos sensibles (PII, tarjetas, CUIT, contraseñas) para logs,
 * telemetría y mensajes de depuración seguros.
 */
export function maskSensitiveData(input: string | null | undefined): string {
  if (!input) return "";
  const str = String(input);
  if (str.length <= 4) return "****";
  const visible = str.slice(-4);
  return `${"*".repeat(Math.max(4, str.length - 4))}${visible}`;
}

/**
 * Valida si una URL es segura para redirección interna o protocolo HTTPS verificado.
 * Previene vulnerabilidades de Open Redirect (CWE-601).
 */
export function isSafeRedirectUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  // Solo rutas relativas internas que comiencen con / pero no con // (protocol-relative URL)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return true;
  }
  return false;
}
