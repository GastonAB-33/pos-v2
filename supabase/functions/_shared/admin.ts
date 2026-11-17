import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Faltan variables SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
}

export interface CallerContext {
  userId: string;
  tenantId: string;
}

export const createUserClient = (authorization: string | null) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });

export const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Valida que la sesión del llamador sea válida, tenga permisos sobre el módulo 'usuarios',
 * y extrae de forma segura el tenant_id y user_id autenticados en el servidor.
 */
export const requireUsuariosWrite = async (
  authorization: string | null
): Promise<CallerContext> => {
  if (!authorization) {
    throw new Error("Sesion requerida");
  }

  const userClient = createUserClient(authorization);

  // 1. Validar permisos de escritura en módulo usuarios
  const { data: canWrite, error: writeError } = await userClient.rpc("current_user_can_write", {
    module_name: "usuarios",
  });

  if (writeError) {
    throw new Error(writeError.message);
  }

  if (canWrite !== true) {
    throw new Error("No tenes permisos para administrar usuarios");
  }

  // 2. Extraer el tenant_id real del llamador desde el contexto de sesión de Postgres
  const { data: callerTenantId, error: tenantError } = await userClient.rpc("current_tenant_id");
  if (tenantError || !callerTenantId) {
    throw new Error("No se pudo determinar el comercio del usuario autenticado");
  }

  // 3. Extraer el user_id de la sesión
  const { data: callerUserId, error: userError } = await userClient.rpc("current_app_user_id");
  if (userError || !callerUserId) {
    throw new Error("No se pudo determinar la identidad del usuario autenticado");
  }

  return {
    userId: String(callerUserId),
    tenantId: String(callerTenantId),
  };
};

/**
 * Valida que la sesión del llamador sea válida y extrae el tenant_id y user_id
 * autenticados en el servidor para operaciones generales autorizadas del tenant.
 */
export const requireAuthenticatedTenantUser = async (
  authorization: string | null
): Promise<CallerContext> => {
  if (!authorization) {
    throw new Error("Sesion requerida");
  }

  const userClient = createUserClient(authorization);

  const { data: authUser, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser?.user) {
    throw new Error("Token de autenticacion invalido o expirado");
  }

  const { data: callerTenantId, error: tenantError } = await userClient.rpc("current_tenant_id");
  if (!tenantError && callerTenantId) {
    const { data: callerUserId } = await userClient.rpc("current_app_user_id");
    return {
      userId: callerUserId ? String(callerUserId) : authUser.user.id,
      tenantId: String(callerTenantId),
    };
  }

  // Fallback: consultar el registro en public.users
  const { data: profile } = await serviceClient
    .from("users")
    .select("id, tenant_id")
    .eq("auth_user_id", authUser.user.id)
    .maybeSingle();

  if (!profile?.tenant_id) {
    throw new Error("No se pudo determinar el comercio del usuario autenticado");
  }

  return {
    userId: profile.id,
    tenantId: profile.tenant_id,
  };
};
