import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUsuariosWrite, serviceClient } from "../_shared/admin.ts";

interface CreateUserPayload {
  tenant_id: string;
  email: string;
  username: string | null;
  full_name: string;
  password: string;
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

  let step = "init";

  try {
    step = "require-permission";
    await requireUsuariosWrite(req.headers.get("Authorization"));

    step = "parse-body";
    const body = (await req.json()) as Partial<CreateUserPayload>;
    const tenantId = normalizeText(body.tenant_id);
    const email = normalizeText(body.email).toLowerCase();
    const username = normalizeText(body.username) || null;
    const fullName = normalizeText(body.full_name);
    const password = normalizeText(body.password);
    const permissionProfileId = normalizeText(body.permission_profile_id);

    if (!tenantId || !email || !fullName || !permissionProfileId) {
      return jsonResponse({ error: "Faltan datos obligatorios" }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
    }

    step = "validate-profile";
    const { data: profile, error: profileError } = await serviceClient
      .from("permission_profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", permissionProfileId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return jsonResponse({ error: "Perfil de permisos invalido para el tenant" }, 400);
    }

    step = "create-auth-user";
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: tenantId,
        username,
      },
    });

    if (authError) throw authError;
    if (!authData.user) {
      return jsonResponse({ error: "Supabase Auth no devolvio usuario" }, 500);
    }

    step = "insert-public-user";
    const { data: user, error: userError } = await serviceClient
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        auth_user_id: authData.user.id,
        email,
        username,
        full_name: fullName,
        role_code: "staff",
        permission_profile_id: permissionProfileId,
        is_active: true,
      })
      .select("*")
      .single();

    if (userError) {
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      throw userError;
    }

    return jsonResponse({ user });
  } catch (error) {
    return jsonResponse({ error: `${step}: ${errorMessage(error, "No se pudo crear el usuario")}` }, 400);
  }
});
