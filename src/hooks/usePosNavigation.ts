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

  const openPos = useCallback(
    (targetMode?: PosWindowMode) => {
      const mode = targetMode ?? posWindowMode;
      const posUrl = new URL(routePaths.pos, window.location.origin);
      posUrl.searchParams.set("from", "panel-web");
      posUrl.searchParams.set("returnTo", `${location.pathname}${location.search}`);

      if (mode === "new_window" && !isInstalled) {
        const opened = window.open(posUrl.toString(), "_blank", "noopener,noreferrer");
        if (!opened) {
          navigate(`${posUrl.pathname}${posUrl.search}`);
        }
        return;
      }

      navigate(`${posUrl.pathname}${posUrl.search}`);
    },
    [isInstalled, location.pathname, location.search, navigate, posWindowMode]
  );

  return {
    openPos,
    posWindowMode,
  };
};
