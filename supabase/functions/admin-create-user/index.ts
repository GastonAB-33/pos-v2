import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUsuariosWrite, serviceClient } from "../_shared/admin.ts";

interface CreateUserPayload {
  tenant_id?: string;
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
    // 1. Extraer contexto seguro del llamador validado en servidor
    const caller = await requireUsuariosWrite(req.headers.get("Authorization"));

    step = "parse-body";
    const body = (await req.json()) as Partial<CreateUserPayload>;
    // Blindaje multi-tenant: El tenant_id SIEMPRE se deriva de la sesión del llamador
    const tenantId = caller.tenantId;

    const email = normalizeText(body.email).toLowerCase();
    const username = normalizeText(body.username) || null;
    const fullName = normalizeText(body.full_name);
    const password = normalizeText(body.password);
    const permissionProfileId = normalizeText(body.permission_profile_id);

    if (!email || !fullName || !permissionProfileId) {
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
      return jsonResponse({ error: "Perfil de permisos invalido para este comercio" }, 400);
    }

    step = "create-or-link-auth-user";
    let authUserId: string | null = null;
    let isReassigned = false;

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

    if (authError) {
      const isAlreadyRegistered =
        authError.message?.toLowerCase().includes("already been registered") ||
        authError.message?.toLowerCase().includes("already registered") ||
        (authError as { code?: string }).code === "email_exists";

      if (!isAlreadyRegistered) {
        throw authError;
      }

      // Verificar si ya existe un usuario con este correo en public.users
      const { data: existingUser, error: existingError } = await serviceClient
        .from("users")
        .select("id, tenant_id, auth_user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingError) throw existingError;

      // PREVENCIÓN DE SECUESTRO DE CUENTAS (ACCOUNT TAKEOVER CROSS-TENANT)
      // Si el correo ya pertenece a OTRO comercio, PROHIBIR la reasignación o cambio de clave
      if (existingUser && existingUser.tenant_id !== tenantId) {
        return jsonResponse(
          {
            error:
              "Este correo electrónico ya está registrado en otro comercio. Por seguridad multi-tenant, cada usuario debe utilizar una dirección de correo exclusiva.",
          },
          409
        );
      }

      // Si ya existe en este mismo comercio, retornar error amigable
      if (existingUser && existingUser.tenant_id === tenantId) {
        return jsonResponse(
          { error: "Ya existe un usuario con este correo electrónico en este comercio." },
          400
        );
      }

      // Si el usuario existe en Supabase Auth pero no en public.users (caso huérfano del mismo tenant)
      const { data: listData, error: listError } = await serviceClient.auth.admin.listUsers();
      if (listError) throw authError;

      const matchedAuthUser = listData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email
      );

      if (!matchedAuthUser) throw authError;

      authUserId = matchedAuthUser.id;
      isReassigned = true;

      // Actualizar metadata del usuario para el tenant actual
      await serviceClient.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: {
          full_name: fullName,
          tenant_id: tenantId,
          username,
        },
      });
    } else {
      authUserId = authData.user?.id ?? null;
    }

    if (!authUserId) {
      return jsonResponse({ error: "Supabase Auth no devolvio usuario" }, 500);
    }

    step = "insert-public-user";
    const { data: user, error: userError } = await serviceClient
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        auth_user_id: authUserId,
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
      if (!isReassigned) {
        await serviceClient.auth.admin.deleteUser(authUserId);
      }
      throw userError;
    }

    return jsonResponse({ user });
  } catch (error) {
    return jsonResponse({ error: `${step}: ${errorMessage(error, "No se pudo crear el usuario")}` }, 400);
  }
});
