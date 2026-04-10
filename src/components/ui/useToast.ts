import { useCallback, useMemo } from "react";
import { useUiStore, type UiToastType } from "@/store/ui.store";

export const useToast = () => {
  const pushToast = useUiStore((state) => state.pushToast);

  const show = useCallback(
    (type: UiToastType, message: string, durationMs?: number) =>
      pushToast({ type, message, durationMs }),
    [pushToast]
  );

  const success = useCallback(
    (message: string, durationMs?: number) => show("success", message, durationMs),
    [show]
  );
  const error = useCallback(
    (message: string, durationMs?: number) => show("error", message, durationMs),
    [show]
  );
  const info = useCallback(
    (message: string, durationMs?: number) => show("info", message, durationMs),
    [show]
  );

  return useMemo(
    () => ({
      show,
      success,
      error,
      info,
    }),
    [error, info, show, success]
  );
};
