import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { PermissionProfileRecord } from "@/types/entities";
import {
  createDefaultPermissionProfile,
  normalizePermissionProfile,
  type PermissionProfile,
} from "@/types/permissions";

const crud = new TenantCrudService<PermissionProfileRecord>(dbTables.permission_profiles);

export type CreatePermissionProfileInput = CreateEntityInput<PermissionProfileRecord>;
export type UpdatePermissionProfileInput = UpdateEntityInput<PermissionProfileRecord>;

const normalizeInputPermissions = (permissions?: PermissionProfile): PermissionProfile => {
  if (!permissions) {
    return createDefaultPermissionProfile();
  }

  return normalizePermissionProfile(permissions);
};

export const permissionProfilesService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  getActiveByTenant: async (tenantId: string) => {
    const profiles = await crud.getAllByTenant(tenantId);
    return profiles.filter((profile) => profile.is_active);
  },
  create: (tenantId: string, input: CreatePermissionProfileInput) =>
    crud.create(tenantId, {
      ...input,
      permissions: normalizeInputPermissions(input.permissions),
    }),
  update: async (tenantId: string, id: string, input: UpdatePermissionProfileInput) => {
    const payload = { ...input };
    if (payload.permissions) {
      payload.permissions = normalizeInputPermissions(payload.permissions);
    }
    return crud.update(tenantId, id, payload);
  },
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
  toggleActive: async (tenantId: string, id: string) => {
    const profile = await crud.getById(tenantId, id);
    if (!profile) return null;
    return crud.update(tenantId, id, { is_active: !profile.is_active });
  },
};
