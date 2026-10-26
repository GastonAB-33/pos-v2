import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useDeviceProfile } from "@/hooks/useDeviceProfile";
import { useUiStore } from "@/store/ui.store";
import { cn } from "@/utils/cn";

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Atajo F4 global fuera del POS: ir directo al POS si no hay datos sin guardar en pantalla
  useEffect(() => {
    if (isPosRoute) return;

    const handleF4OutsidePos = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        e.preventDefault();

        // Detectar si hay un modal abierto con datos cargados
        const openModal = document.querySelector('[role="dialog"], .fixed.inset-0');
        if (openModal) {
          const inputs = Array.from(
            openModal.querySelectorAll('input:not([type="hidden"]):not([readonly]), textarea, select')
          ) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

          const hasDirtyData = inputs.some((el) => {
            if (
              el instanceof HTMLInputElement &&
              (el.type === "checkbox" || el.type === "radio" || el.type === "button" || el.type === "submit")
            ) {
              return false;
            }
            const val = el.value?.trim();
            return Boolean(val && val !== "0" && val !== "0.00");
          });

          if (hasDirtyData) {
            const confirmed = window.confirm(
              "Hay un modal o formulario con datos cargados sin guardar. ¿Deseas salir e ir al POS de todos modos?"
            );
            if (!confirmed) return;
          }
        }

        navigate(routePaths.pos);
      }
    };

    window.addEventListener("keydown", handleF4OutsidePos);
    return () => window.removeEventListener("keydown", handleF4OutsidePos);
  }, [isPosRoute, navigate]);

  if (isPosRoute) {
    return (
      <div
        className={cn(
          "app-shell app-shell--pos",
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
          <main className="app-main app-main--pos">
            <Outlet />
          </main>
          <MobileBottomNav />
        </div>
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
        <MobileBottomNav />
      </div>
    </div>
  );
};
