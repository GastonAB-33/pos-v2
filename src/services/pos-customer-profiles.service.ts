import { storageKeys } from "@/utils/local-storage";

interface CustomerPosProfile {
  enabled: boolean;
  limit: number | null;
  updated_at: string;
}

type TenantCustomerProfiles = Record<string, CustomerPosProfile>;
type PosCustomerProfilesStorage = Record<string, TenantCustomerProfiles>;

const DEFAULT_PROFILE: CustomerPosProfile = {
  enabled: true,
  limit: null,
  updated_at: "",
};

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 ? Number(value.toFixed(2)) : null;
};

const readStorage = (): PosCustomerProfilesStorage => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKeys.posCustomerProfiles);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PosCustomerProfilesStorage;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStorage = (value: PosCustomerProfilesStorage) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKeys.posCustomerProfiles, JSON.stringify(value));
  } catch {
    // Silenciar errores de storage para no romper flujo POS.
  }
};

export const posCustomerProfilesService = {
  getProfile: (tenantId: string, customerId: string): { enabled: boolean; limit: number | null } => {
    if (!tenantId || !customerId) return { enabled: true, limit: null };

    const storage = readStorage();
    const row = storage[tenantId]?.[customerId];
    if (!row) return { enabled: true, limit: null };

    return {
      enabled: row.enabled !== false,
      limit: toSafeNumber(row.limit),
    };
  },

  saveProfile: (
    tenantId: string,
    customerId: string,
    payload: {
      enabled: boolean;
      limit: number | null;
    }
  ) => {
    if (!tenantId || !customerId) return;

    const storage = readStorage();
    const tenantProfiles = storage[tenantId] ?? {};
    tenantProfiles[customerId] = {
      enabled: payload.enabled,
      limit: toSafeNumber(payload.limit),
      updated_at: new Date().toISOString(),
    };
    storage[tenantId] = tenantProfiles;
    writeStorage(storage);
  },

  removeProfile: (tenantId: string, customerId: string) => {
    if (!tenantId || !customerId) return;

    const storage = readStorage();
    const tenantProfiles = storage[tenantId];
    if (!tenantProfiles || !tenantProfiles[customerId]) return;

    delete tenantProfiles[customerId];
    storage[tenantId] = tenantProfiles;
    writeStorage(storage);
  },

  getDefaultProfile: (): { enabled: boolean; limit: number | null } => ({
    enabled: DEFAULT_PROFILE.enabled,
    limit: DEFAULT_PROFILE.limit,
  }),
};

