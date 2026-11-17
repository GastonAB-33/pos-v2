import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Garantiza que al navegar a cualquier módulo o sección en todo el sistema,
 * la pantalla comience siempre desde la parte superior (top: 0), evitando
 * arrastrar la posición de scroll de la página o vista anterior.
 */
export const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // 1. Reseteo del scroll en window y documentElement / body
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 2. Reseteo en contenedores principales de la aplicación que puedan alojar scroll propio
    const appShell = document.querySelector(".app-shell");
    if (appShell) appShell.scrollTop = 0;

    const appContent = document.querySelector(".app-content");
    if (appContent) appContent.scrollTop = 0;

    const appMain = document.querySelector(".app-main");
    if (appMain) appMain.scrollTop = 0;

    const operationalPage = document.querySelector(".operational-page");
    if (operationalPage) operationalPage.scrollTop = 0;

    const uiPage = document.querySelector(".ui-page");
    if (uiPage) uiPage.scrollTop = 0;
  }, [pathname, search]);

  return null;
};
