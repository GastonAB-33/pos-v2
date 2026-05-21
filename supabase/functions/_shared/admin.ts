import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Faltan variables SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
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

export const requireUsuariosWrite = async (authorization: string | null) => {
  if (!authorization) {
    throw new Error("Sesion requerida");
  }

  const userClient = createUserClient(authorization);
  const { data, error } = await userClient.rpc("current_user_can_write", {
    module_name: "usuarios",
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data !== true) {
    throw new Error("No tenes permisos para administrar usuarios");
  }
};

