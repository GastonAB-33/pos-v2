import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { Tenant } from "@/types/tenant";

interface TenantContextValue {
  tenant: Tenant | null;
  tenantId: string | null;
  setActiveTenant: (tenant: Tenant) => void;
  clearActiveTenant: () => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider = ({ children }: PropsWithChildren) => {
  const sessionTenant = useAuthStore((state) => state.tenant);
  const sessionTenantId = useAuthStore((state) => state.tenantId);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(sessionTenant);

  useEffect(() => {
    if (!sessionTenantId) {
      setActiveTenant(null);
      return;
    }

    if (!activeTenant || activeTenant.id !== sessionTenantId) {
      setActiveTenant(sessionTenant);
    }
  }, [activeTenant, sessionTenant, sessionTenantId]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant: activeTenant,
      tenantId: activeTenant?.id ?? null,
      setActiveTenant,
      clearActiveTenant: () => setActiveTenant(null),
    }),
    [activeTenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenantContext = () => {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error("useTenantContext must be used within TenantProvider");
  }

  return context;
};