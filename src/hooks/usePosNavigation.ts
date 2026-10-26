import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePwa } from "@/features/pwa/hooks/usePwa";
import { useUiStore, type PosWindowMode } from "@/store/ui.store";

export const usePosNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstalled } = usePwa();
  const posWindowMode = useUiStore((state) => state.posWindowMode);

  const getPosUrl = useCallback(() => {
    const posUrl = new URL(routePaths.pos, window.location.origin);
    posUrl.searchParams.set("from", "panel-web");
    posUrl.searchParams.set("returnTo", `${location.pathname}${location.search}`);
    return `${posUrl.pathname}${posUrl.search}`;
  }, [location.pathname, location.search]);

  const openPos = useCallback(
    (targetMode?: PosWindowMode) => {
      const mode = targetMode ?? posWindowMode;
      const targetPath = getPosUrl();

      if (mode === "new_window" && !isInstalled) {
        const fullUrl = new URL(targetPath, window.location.origin).toString();
        const opened = window.open(fullUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          navigate(targetPath);
        }
        return;
      }

      navigate(targetPath);
    },
    [getPosUrl, isInstalled, navigate, posWindowMode]
  );

  return {
    openPos,
    getPosUrl,
    posWindowMode,
  };
};
