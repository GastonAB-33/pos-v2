import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUsuariosWrite, serviceClient } from "../_shared/admin.ts";

interface UpdateUserPayload {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string;
  password: string | null;
  permission_profile_id: string;
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
    await requireUsuariosWrite(req.headers.get("Authorization"));

    const body = (await req.json()) as Partial<UpdateUserPayload>;
    const userId = normalizeText(body.user_id);
    const email = normalizeText(body.email).toLowerCase();
    const username = normalizeText(body.username) || null;
    const fullName = normalizeText(body.full_name);
    const password = normalizeText(body.password);
    const permissionProfileId = normalizeText(body.permission_profile_id);

    if (!userId || !email || !fullName || !permissionProfileId) {
      return jsonResponse({ error: "Faltan datos obligatorios" }, 400);
    }

    if (password && password.length < 8) {
      return jsonResponse({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
    }

    const { data: existing, error: existingError } = await serviceClient
      .from("users")
      .select("id, tenant_id, auth_user_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return jsonResponse({ error: "Usuario no encontrado" }, 404);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("permission_profiles")
      .select("id")
      .eq("tenant_id", existing.tenant_id)
      .eq("id", permissionProfileId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return jsonResponse({ error: "Perfil de permisos invalido para el tenant" }, 400);
    }

    if (existing.auth_user_id) {
      const authPatch: {
        email: string;
        password?: string;
        user_metadata: Record<string, unknown>;
      } = {
        email,
        user_metadata: {
          full_name: fullName,
          tenant_id: existing.tenant_id,
          username,
        },
      };

      if (password) {
        authPatch.password = password;
      }

      const { error: authError } = await serviceClient.auth.admin.updateUserById(
        existing.auth_user_id,
        authPatch
      );

      if (authError) throw authError;
    }

    const { data: user, error: userError } = await serviceClient
      .from("users")
      .update({
        email,
        username,
        full_name: fullName,
        permission_profile_id: permissionProfileId,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (userError) throw userError;

    return jsonResponse({ user });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "No se pudo actualizar el usuario") }, 400);
  }
});
