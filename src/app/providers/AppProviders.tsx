import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { LegacyAlertToastBridge } from "@/components/ui/LegacyAlertToastBridge";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { OfflineProvider } from "@/features/offline/context/OfflineContext";
import { PwaProvider } from "@/features/pwa/context/PwaContext";
import { TenantProvider } from "@/features/tenant/context/TenantContext";
import { useAuthSessionSync } from "@/features/auth/hooks/useAuthSessionSync";

const AuthSessionListener = () => {
  useAuthSessionSync();
  return null;
};

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider>
      <PwaProvider>
        <BrowserRouter>
          <AuthSessionListener />
          <TenantProvider>
            <OfflineProvider>
              {children}
              <LegacyAlertToastBridge />
              <Toaster />
            </OfflineProvider>
          </TenantProvider>
        </BrowserRouter>
      </PwaProvider>
    </ThemeProvider>
  );
};
