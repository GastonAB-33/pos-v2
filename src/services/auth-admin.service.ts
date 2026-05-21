import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import type { UserRecord } from "@/types/entities";

interface CreateAuthUserInput {
  tenant_id: string;
  email: string;
  username: string | null;
  full_name: string;
  password: string;
  permission_profile_id: string;
}

interface UpdateAuthUserInput {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string;
  password: string | null;
  permission_profile_id: string;
}

interface DeleteAuthUserInput {
  user_id: string;
}

const unwrapFunctionResponse = <TData>(data: unknown): TData => {
  if (!data || typeof data !== "object") {
    throw new Error("La funcion administrativa no devolvio datos validos");
  }

  const payload = data as { user?: TData; error?: string };
  if (payload.error) throw new Error(payload.error);
  if (!payload.user) throw new Error("La funcion administrativa no devolvio usuario");
  return payload.user;
};

const normalizeFunctionError = (error: { message?: string } | null): Error => {
  const message = error?.message ?? "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not_found") ||
    normalized.includes("requested function was not found") ||
    normalized.includes("failed to send a request")
  ) {
    return new Error(
      "La funcion administrativa de usuarios no esta desplegada en Supabase. Desplega admin-create-user, admin-update-user y admin-delete-user para gestionar usuarios con login."
    );
  }

  return new Error(message || "No se pudo ejecutar la funcion administrativa");
};

export const authAdminService = {
  createUser: async (input: CreateAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: input,
    });

    if (error) throw normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },

  updateUser: async (input: UpdateAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: input,
    });

    if (error) throw normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },

  deleteUser: async (input: DeleteAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: input,
    });

    if (error) throw normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },
};
