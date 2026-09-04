import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const useAuthSessionSync = () => {
  useEffect(() => {
    if (dataProvider !== "supabase") return;

    let isMounted = true;

    const verifyAndRefreshSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user?.id) {
          const currentStore = useAuthStore.getState();

          // Si el token está por expirar en menos de 10 minutos, refrescarlo proactivamente
          const expiresAtSeconds = session.expires_at ?? 0;
          const expiresInSeconds = expiresAtSeconds - Math.floor(Date.now() / 1000);

          if (expiresInSeconds < 600) {
            await supabase.auth.refreshSession();
          }

          // Si el store no está autenticado o le falta tenant/usuario, rehidratar la sesión POS completa
          if (!currentStore.isAuthenticated || !currentStore.user || !currentStore.tenant) {
            const posSession = await authService.getStoredPosSession();
            if (posSession && isMounted) {
              useAuthStore.getState().setSession(posSession);
            }
          }
        } else {
          // Si Supabase no tiene sesión activa pero el store local decía que sí, limpiar estado fantasma
          const currentStore = useAuthStore.getState();
          if (currentStore.isAuthenticated) {
            useAuthStore.getState().clearSession();
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session) {
        useAuthStore.getState().clearSession();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        const currentStore = useAuthStore.getState();
        if (!currentStore.isAuthenticated || !currentStore.user || !currentStore.tenant) {
          const posSession = await authService.getStoredPosSession();
          if (posSession && isMounted) {
            useAuthStore.getState().setSession(posSession);
          }
        }
      }
    });

    // 3. Auto-verificación al volver a la pestaña o reactivar la pantalla del móvil
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void verifyAndRefreshSession();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);
};
