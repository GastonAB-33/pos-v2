import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import { permissionProfilesService } from "@/services/permission-profiles.service";
import { tenantsService } from "@/services/tenants.service";
import { usersService } from "@/services/users.service";
import type { TenantRecord, UserRecord } from "@/types/entities";
import type { AppUser } from "@/types/user";
import { normalizePermissionProfile } from "@/types/permissions";

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
  signInWithPassword: async (email: string, password: string): Promise<PosSession> => {
    if (dataProvider !== "supabase") {
      throw new Error("Supabase Auth solo esta disponible con VITE_DATA_PROVIDER=supabase");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(error.message || "No se pudo iniciar sesion");
    }

    const authUserId = data.user?.id;
    if (!authUserId) {
      throw new Error("Supabase Auth no devolvio usuario autenticado");
    }

    return resolvePosSessionFromAuthUser(authUserId);
  },

  signOut: async () => {
    if (dataProvider !== "supabase") return;
    await supabase.auth.signOut();
  },
};

