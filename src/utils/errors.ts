/**
 * Extrae un mensaje de error legible y amigable de cualquier tipo de error
 * (Error nativo, PostgrestError de Supabase, cadenas de texto o respuestas de red).
 */
export const formatErrorMessage = (error: unknown, fallback = "Ocurrió un error inesperado"): string => {
  if (!error) return fallback;

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object") {
    const candidate = error as Record<string, unknown>;

    // Soporte para PostgrestError de Supabase { message, details, hint, code }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      const msg = candidate.message.trim();
      // Traducir mensajes comunes de RLS o PostgreSQL a explicaciones claras
      if (msg.includes("violates row-level security policy") || candidate.code === "42501") {
        return "Permiso denegado en la base de datos (RLS). Tu usuario no tiene asignado permiso de escritura para registrar productos.";
      }
      if (msg.includes("violates not-null constraint") && typeof candidate.details === "string") {
        return `Dato obligatorio faltante: ${candidate.details}`;
      }
      if (msg.includes("violates unique constraint") || candidate.code === "23505") {
        return "Ya existe otro registro con el mismo código o identificador en el sistema.";
      }
      return msg;
    }

    if (typeof candidate.details === "string" && candidate.details.trim()) {
      return candidate.details.trim();
    }

    if (typeof candidate.error_description === "string" && candidate.error_description.trim()) {
      return candidate.error_description.trim();
    }

    if (typeof candidate.hint === "string" && candidate.hint.trim()) {
      return candidate.hint.trim();
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
};
