import { useCallback, useEffect, useMemo, useRef } from "react";

interface UseBarcodeScannerOptions {
  enabled: boolean;
  onScan: (barcode: string) => void;
  minLength?: number;
  resetAfterMs?: number;
}

interface BarcodeCameraController {
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_RESET_AFTER_MS = 120;

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-scanner-capture='true']")) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
};

export const useBarcodeScanner = ({
  enabled,
  onScan,
  minLength = DEFAULT_MIN_LENGTH,
  resetAfterMs = DEFAULT_RESET_AFTER_MS,
}: UseBarcodeScannerOptions) => {
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    lastKeyAtRef.current = 0;
  }, []);

  const handleScan = useCallback(() => {
    const barcode = bufferRef.current.trim();
    resetBuffer();

    if (barcode.length < minLength) return;
    onScan(barcode);
  }, [minLength, onScan, resetBuffer]);

  useEffect(() => {
    if (!enabled) {
      resetBuffer();
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableElement(event.target)) return;

      if (event.key === "Enter") {
        if (!bufferRef.current) return;
        event.preventDefault();
        handleScan();
        return;
      }

      if (event.key === "Escape") {
        resetBuffer();
        return;
      }

      if (event.key.length !== 1) return;

      const now = Date.now();
      if (lastKeyAtRef.current && now - lastKeyAtRef.current > resetAfterMs) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastKeyAtRef.current = now;
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, handleScan, resetAfterMs, resetBuffer]);

  const camera = useMemo<BarcodeCameraController>(
    () => ({
      isSupported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
      start: async () => {
        throw new Error("Escaneo por camara no implementado todavia");
      },
      stop: () => {
        // Placeholder para futura integracion de camara.
      },
    }),
    []
  );

  return {
    isListening: enabled,
    resetBuffer,
    camera,
  };
};
