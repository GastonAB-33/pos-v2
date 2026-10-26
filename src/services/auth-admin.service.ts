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

const friendlyErrorMessage = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (
    lower.includes("already been registered") ||
    lower.includes("email already exists") ||
    lower.includes("user already registered")
  ) {
    return "Ya existe un usuario registrado en el sistema con este correo electrónico (asociado a otro comercio o cuenta previa).";
  }
  if (
    lower.includes("no tenes permisos") ||
    lower.includes("sesion requerida") ||
    lower.includes("require-permission")
  ) {
    return "No posees permisos de administrador de usuarios para realizar esta acción.";
  }
  if (
    lower.includes("perfil de permisos invalido") ||
    lower.includes("validate-profile")
  ) {
    return "El perfil de permisos seleccionado no es válido para este comercio.";
  }
  if (lower.includes("al menos 8 caracteres")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (lower.includes("duplicate key") && lower.includes("username")) {
    return "Ya existe un usuario con este nombre de usuario.";
  }
  if (lower.includes("faltan datos obligatorios")) {
    return "Faltan datos obligatorios para crear el usuario.";
  }
  return msg;
};

const normalizeFunctionError = async (error: unknown): Promise<Error> => {
  if (!error) return new Error("No se pudo ejecutar la función administrativa");

  // Si Supabase functions-js devolvió un FunctionsHttpError con Response en context
  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof ctx === "object") {
      try {
        if ("json" in ctx && typeof (ctx as Response).json === "function") {
          const body = await (ctx as Response).json();
          if (body?.error && typeof body.error === "string") {
            return new Error(friendlyErrorMessage(body.error));
          }
          if (body?.message && typeof body.message === "string") {
            return new Error(friendlyErrorMessage(body.message));
          }
        } else if ("text" in ctx && typeof (ctx as Response).text === "function") {
          const text = await (ctx as Response).text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (parsed?.error && typeof parsed.error === "string") {
                return new Error(friendlyErrorMessage(parsed.error));
              }
              if (parsed?.message && typeof parsed.message === "string") {
                return new Error(friendlyErrorMessage(parsed.message));
              }
            } catch {
              return new Error(friendlyErrorMessage(text));
            }
          }
        }
      } catch {
        // En caso de error consumiendo el stream
      }
    }
  }

  const message = (error as { message?: string })?.message ?? "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not_found") ||
    normalized.includes("requested function was not found") ||
    normalized.includes("failed to send a request")
  ) {
    return new Error(
      "La función administrativa de usuarios no está desplegada en Supabase. Desplegá admin-create-user, admin-update-user y admin-delete-user para gestionar usuarios con login."
    );
  }

  return new Error(friendlyErrorMessage(message) || "No se pudo ejecutar la función administrativa");
};

export const authAdminService = {
  createUser: async (input: CreateAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: input,
    });

    if (error) throw await normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },

  updateUser: async (input: UpdateAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: input,
    });

    if (error) throw await normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },

  deleteUser: async (input: DeleteAuthUserInput): Promise<UserRecord | null> => {
    if (dataProvider !== "supabase") return null;

    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: input,
    });

    if (error) throw await normalizeFunctionError(error);
    return unwrapFunctionResponse<UserRecord>(data);
  },
};
