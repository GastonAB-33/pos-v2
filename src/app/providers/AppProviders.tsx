import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { OfflineProvider } from "@/features/offline/context/OfflineContext";
import { PwaProvider } from "@/features/pwa/context/PwaContext";
import { TenantProvider } from "@/features/tenant/context/TenantContext";

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider>
      <PwaProvider>
        <BrowserRouter>
          <TenantProvider>
            <OfflineProvider>
              {children}
              <Toaster />
            </OfflineProvider>
          </TenantProvider>
        </BrowserRouter>
      </PwaProvider>
    </ThemeProvider>
  );
};
