import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { storageKeys } from "@/utils/local-storage";

export const useAuthSessionSync = () => {
  const wakeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (dataProvider !== "supabase") return;

    let isMounted = true;

    const verifyAndRefreshSession = async (proactiveRefresh = true) => {
      try {
        const isOnline = typeof navigator === "undefined" || navigator.onLine;

        // Si estamos offline o el equipo apenas despierta sin red, no intentar refrescar ni borrar la sesión
        if (!isOnline) {
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user?.id) {
          const currentStore = useAuthStore.getState();

          // Si el token está por expirar en menos de 10 minutos, refrescarlo proactivamente con candado entre pestañas
          const expiresAtSeconds = session.expires_at ?? 0;
          const expiresInSeconds = expiresAtSeconds - Math.floor(Date.now() / 1000);

          if (proactiveRefresh && expiresAtSeconds > 0 && expiresInSeconds < 600 && expiresInSeconds > 0) {
            if (typeof navigator !== "undefined" && "locks" in navigator) {
              await navigator.locks.request("pos_supabase_token_refresh", { ifAvailable: true }, async (lock) => {
                if (lock) {
                  await supabase.auth.refreshSession();
                }
              });
            } else {
              await supabase.auth.refreshSession();
            }
          }

          // Si el store no está autenticado o le falta tenant/usuario, rehidratar la sesión POS completa
          if (!currentStore.isAuthenticated || !currentStore.user || !currentStore.tenant) {
            const posSession = await authService.getStoredPosSession();
            if (posSession && isMounted) {
              useAuthStore.getState().setSession(posSession);
            }
          }
        } else {
          // Si getSession no devolvió sesión pero el store local está autenticado:
          const currentStore = useAuthStore.getState();
          if (currentStore.isAuthenticated) {
            // Reintentar refreshSession antes de asumir que la sesión está muerta
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (!isMounted) return;

            if (refreshed?.session?.user?.id) {
              // Recuperado exitosamente
              return;
            }

            // Solo limpiar si estamos confirmadamente online y el error indica que el token ya no existe
            const isDefinitiveAuthError =
              refreshError &&
              (refreshError.message?.toLowerCase().includes("refresh_token_not_found") ||
                refreshError.message?.toLowerCase().includes("invalid_grant") ||
                refreshError.status === 400);

            if (isDefinitiveAuthError && isOnline) {
              useAuthStore.getState().clearSession();
            }
          }
        }
      } catch {
        // Ignorar fallos de red transitorios para no cerrar sesión por error de conectividad
      }
    };

    // 1. Verificación inicial al cargar la aplicación
    void verifyAndRefreshSession();

    // 2. Suscripción a eventos de ciclo de vida de autenticación de Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        useAuthStore.getState().clearSession();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (!session?.user?.id) return;
        // Defer outside Supabase auth lock/notification cycle so signInWithPassword never deadlocks.
        window.setTimeout(async () => {
          if (!isMounted) return;
          const currentStore = useAuthStore.getState();
          if (!currentStore.isAuthenticated || !currentStore.user || !currentStore.tenant) {
            const posSession = await authService.getStoredPosSession();
            if (posSession && isMounted) {
              useAuthStore.getState().setSession(posSession);
            }
          }
        }, 150);
      }
    });

    // 3. Auto-verificación al volver a la pestaña o reactivar la pantalla tras reposo (con debounce de 1.5s para reconectar WiFi)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        if (wakeTimerRef.current !== null) {
          window.clearTimeout(wakeTimerRef.current);
        }
        wakeTimerRef.current = window.setTimeout(() => {
          wakeTimerRef.current = null;
          void verifyAndRefreshSession();
        }, 1500);
      }
    };

    // 4. Sincronización entre pestañas mediante el evento storage
    const handleStorageChange = (e: StorageEvent) => {
      if (!isMounted) return;
      if (
        e.key &&
        (e.key.includes("supabase.auth") ||
          e.key.startsWith("sb-") ||
          e.key === storageKeys.auth)
      ) {
        void verifyAndRefreshSession(false);
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      if (wakeTimerRef.current !== null) {
        window.clearTimeout(wakeTimerRef.current);
      }
      subscription.unsubscribe();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);
};
