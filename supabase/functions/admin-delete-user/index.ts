import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUsuariosWrite, serviceClient } from "../_shared/admin.ts";

interface DeleteUserPayload {
  user_id: string;
}

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const errorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error_description?: unknown; error?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.error_description === "string") return candidate.error_description;
    if (typeof candidate.error === "string") return candidate.error;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  if (error != null) return String(error);
  return fallback;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  try {
    // 1. Validar permisos y extraer contexto seguro del llamador
    const caller = await requireUsuariosWrite(req.headers.get("Authorization"));

    const body = (await req.json()) as Partial<DeleteUserPayload>;
    const userId = normalizeText(body.user_id);

    if (!userId) {
      return jsonResponse({ error: "Falta user_id" }, 400);
    }

    // 2. Prevenir auto-eliminación
    if (userId === caller.userId) {
      return jsonResponse({ error: "No podés eliminar tu propio usuario activo en sesión" }, 400);
    }

    const { data: existing, error: existingError } = await serviceClient
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return jsonResponse({ error: "Usuario no encontrado" }, 404);
    }

    // 3. BLINDAJE CONTRA BOLA / IDOR: Prohibir eliminar usuarios de otro comercio
    if (existing.tenant_id !== caller.tenantId) {
      return jsonResponse(
        { error: "Acceso denegado: no tenés autorización para eliminar usuarios de otro comercio" },
        403
      );
    }

    if (existing.auth_user_id) {
      const { error: authError } = await serviceClient.auth.admin.deleteUser(existing.auth_user_id);
      if (authError) throw authError;
    }

    const { error: userError } = await serviceClient
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("tenant_id", caller.tenantId);

    if (userError) throw userError;

    return jsonResponse({ user: existing });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "No se pudo eliminar el usuario") }, 400);
  }
});
