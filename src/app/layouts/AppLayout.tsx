import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useDeviceProfile } from "@/hooks/useDeviceProfile";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { SubscriptionPaywallModal } from "@/components/subscription/SubscriptionPaywallModal";
import { cn } from "@/utils/cn";

const RouteLoadingBar = () => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent overflow-hidden pointer-events-none">
      <div className="h-full bg-blue-600 dark:bg-blue-400 animate-route-progress shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
    </div>
  );
};

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDesktop, deviceKind } = useDeviceProfile();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const sidebarPinned = useUiStore((state) => state.sidebarPinned);
  const sidebarHovered = useUiStore((state) => state.sidebarHovered);
  const setSidebarHovered = useUiStore((state) => state.setSidebarHovered);
  const tenant = useAuthStore((state) => state.tenant);

  const isSidebarPinned = isDesktop ? sidebarPinned : sidebarOpen;
  const isSidebarVisible = isDesktop ? sidebarPinned || sidebarHovered : sidebarOpen;

  const isPosRoute =
    location.pathname === routePaths.pos || location.pathname.startsWith(`${routePaths.pos}/`);

  // Detección de vencimiento de prueba o bloqueo de suscripción (Paywall Forzado)
  const isEnforcedPaywall = Boolean(
    tenant &&
      ((tenant.subscriptionStatus === "trial" &&
        tenant.trialEndsAt &&
        new Date(tenant.trialEndsAt) <= new Date()) ||
        tenant.subscriptionStatus === "suspended" ||
        tenant.subscriptionStatus === "past_due")
  );

  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    } else if (!sidebarPinned) {
      setSidebarHovered(false);
    }
  }, [isDesktop, location.pathname, setSidebarOpen, sidebarPinned, setSidebarHovered]);

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
          isSidebarPinned ? "is-sidebar-pinned" : "is-sidebar-unpinned",
          isSidebarVisible ? "is-sidebar-open" : "is-sidebar-closed"
        )}
        data-device-kind={deviceKind}
      >
        <RouteLoadingBar />
        {!isDesktop && sidebarOpen ? (
          <button
            type="button"
            className="app-sidebar-backdrop"
            aria-label="Cerrar menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        {isDesktop && !sidebarPinned ? (
          <div
            className="fixed inset-y-0 left-0 w-3.5 z-40 cursor-pointer"
            onMouseEnter={() => setSidebarHovered(true)}
            aria-hidden="true"
          />
        ) : null}
        <Sidebar />
        <div className="app-content flex flex-col flex-1 min-w-0 max-w-full">
          <SubscriptionBanner />
          <main className="app-main app-main--pos flex-1 min-w-0 max-w-full">
            <Outlet />
          </main>
        </div>

        {/* Modal Paywall si la suscripción está vencida */}
        <SubscriptionPaywallModal isOpen={isEnforcedPaywall} isEnforced={true} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "app-shell",
        isDesktop ? "app-shell--desktop" : "app-shell--drawer",
        isSidebarPinned ? "is-sidebar-pinned" : "is-sidebar-unpinned",
        isSidebarVisible ? "is-sidebar-open" : "is-sidebar-closed"
      )}
      data-device-kind={deviceKind}
    >
      <RouteLoadingBar />
      {!isDesktop && sidebarOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Cerrar menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      {isDesktop && !sidebarPinned ? (
        <div
          className="fixed inset-y-0 left-0 w-3.5 z-40 cursor-pointer"
          onMouseEnter={() => setSidebarHovered(true)}
          aria-hidden="true"
        />
      ) : null}
      <Sidebar />
      <div className="app-content flex flex-col flex-1 min-w-0 max-w-full">
        <SubscriptionBanner />
        <Topbar />
        <main className="app-main flex-1 min-w-0 max-w-full">
          <Outlet />
        </main>
      </div>

      {/* Modal Paywall si la suscripción está vencida */}
      <SubscriptionPaywallModal isOpen={isEnforcedPaywall} isEnforced={true} />
    </div>
  );
};
