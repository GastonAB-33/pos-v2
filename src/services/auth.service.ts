import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import { permissionProfilesService } from "@/services/permission-profiles.service";
import { tenantsService } from "@/services/tenants.service";
import { usersService } from "@/services/users.service";
import type { TenantRecord, UserRecord } from "@/types/entities";
import type { AppUser } from "@/types/user";
import { normalizePermissionProfile } from "@/types/permissions";
import { isTenantMatchingInput } from "@/utils/tenant-slug";

interface PosSession {
  tenant: ReturnType<typeof tenantsService.toTenant>;
  user: AppUser;
}

const toAppUser = async (
  tenant: TenantRecord,
  user: UserRecord
): Promise<AppUser> => {
  const profile = await permissionProfilesService.getById(
    tenant.id,
    user.permission_profile_id
  );

  if (!profile) {
    throw new Error("No se encontro el perfil de permisos asignado");
  }

  if (!profile.is_active) {
    throw new Error("El perfil de permisos asignado esta inactivo");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.full_name,
    role: user.role_code ?? "staff",
    tenantId: tenant.id,
    isActive: user.is_active,
    permissionProfileId: profile.id,
    permissionProfileName: profile.name,
    permissions: normalizePermissionProfile(profile.permissions),
  };
};

const resolvePosSessionFromAuthUser = async (authUserId: string): Promise<PosSession> => {
  const user = await usersService.getByAuthUserId(authUserId);
  if (!user) {
    throw new Error("El usuario autenticado no esta vinculado a un comercio del POS");
  }

  if (!user.is_active) {
    throw new Error("El usuario esta inactivo");
  }

  const tenant = await tenantsService.getById(user.tenant_id);
  if (!tenant) {
    throw new Error("No se encontro el comercio vinculado al usuario");
  }

  if (!tenant.is_active) {
    throw new Error("El comercio vinculado esta inactivo");
  }

  return {
    tenant: tenantsService.toTenant(tenant),
    user: await toAppUser(tenant, user),
  };
};

export const authService = {
  signInWithPassword: async (email: string, password: string, expectedTenantSlug?: string): Promise<PosSession> => {
    if (dataProvider !== "supabase") {
      throw new Error("Supabase Auth solo esta disponible con VITE_DATA_PROVIDER=supabase");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("failed to fetch") || msg.includes("fetch failed") || msg.includes("network")) {
        throw new Error(
          "Error de conexión: No se pudo comunicar con el servidor en la nube. Verificá que el equipo tenga conexión a internet y reintentá."
        );
      }
      if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
        throw new Error("Usuario (email) o contraseña incorrectos. Por favor verificá tus datos.");
      }
      if (msg.includes("email not confirmed")) {
        throw new Error("El correo electrónico aún no ha sido confirmado.");
      }
      throw new Error(error.message || "No se pudo iniciar sesión");
    }

    const authUserId = data.user?.id;
    if (!authUserId) {
      throw new Error("Supabase Auth no devolvio usuario autenticado");
    }

    const session = await resolvePosSessionFromAuthUser(authUserId);
    const expectedInput = expectedTenantSlug?.trim();

    if (expectedInput) {
      const matchesTenant = isTenantMatchingInput(session.tenant, expectedInput);
      if (!matchesTenant) {
        await supabase.auth.signOut();
        const tenantDisplayName = session.tenant.tradeName || session.tenant.legalName || "asignado";
        throw new Error(
          `El comercio ingresado ("${expectedInput}") no coincide con tu usuario. Tu usuario pertenece a "${tenantDisplayName}". Por favor verificá el nombre del comercio.`
        );
      }
    }

    return session;
  },

  signOut: async () => {
    if (dataProvider !== "supabase") return;
    await supabase.auth.signOut();
  },

  getStoredPosSession: async (): Promise<PosSession | null> => {
    if (dataProvider !== "supabase") return null;

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user?.id) {
        return null;
      }

      return await resolvePosSessionFromAuthUser(session.user.id);
    } catch {
      return null;
    }
  },

  refreshPosSession: async (): Promise<PosSession | null> => {
    if (dataProvider !== "supabase") return null;

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error || !session?.user?.id) {
        return null;
      }

      return await resolvePosSessionFromAuthUser(session.user.id);
    } catch {
      return null;
    }
  },
};
