import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useDeviceProfile } from "@/hooks/useDeviceProfile";
import { useUiStore } from "@/store/ui.store";
import { cn } from "@/utils/cn";

export const AppLayout = () => {
  const location = useLocation();
  const { isDesktop, deviceKind } = useDeviceProfile();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const isPosRoute =
    location.pathname === routePaths.pos || location.pathname.startsWith(`${routePaths.pos}/`);

  useEffect(() => {
    setSidebarOpen(isDesktop);
  }, [isDesktop, setSidebarOpen]);

  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop, location.pathname, setSidebarOpen]);

  if (isPosRoute) {
    return (
      <div className="app-shell" data-device-kind={deviceKind}>
        <main className="app-main app-main--pos w-full">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "app-shell",
        isDesktop ? "app-shell--desktop" : "app-shell--drawer",
        sidebarOpen ? "is-sidebar-open" : "is-sidebar-closed"
      )}
      data-device-kind={deviceKind}
    >
      {!isDesktop && sidebarOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Cerrar menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <Sidebar />
      <div className="app-content">
        <Topbar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
