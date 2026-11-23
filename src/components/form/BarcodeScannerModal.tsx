import { useEffect, useMemo, useRef, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface BarcodeScannerModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

type BarcodeDetectionResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectionResult[]>;
};

type BarcodeDetectorCtorLike = new (...args: unknown[]) => BarcodeDetectorLike;

const normalizeBarcode = (value: string): string => value.replace(/\s+/g, "").trim();

const getBarcodeDetectorCtor = (): BarcodeDetectorCtorLike | null => {
  if (typeof window === "undefined") return null;
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
  return detector ?? null;
};

export const BarcodeScannerModal = ({
  open,
  title = "Escanear código de barras",
  description = "Apuntá la cámara al código para capturarlo automáticamente.",
  onDetected,
  onClose,
}: BarcodeScannerModalProps) => {
  useBodyScrollLock(open);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [manualBarcode, setManualBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const detectorCtor = useMemo(() => getBarcodeDetectorCtor(), []);
  const detectorSupported = Boolean(detectorCtor);

  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (open && typeof document !== "undefined") {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const stopStream = () => {
      const stream = streamRef.current;
      if (!stream) return;

      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const stopAll = () => {
      clearTimer();
      stopStream();
    };

    const start = async () => {
      const isSecure =
        typeof window === "undefined" ||
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      if (!isSecure) {
        setError(
          "INSECURE_CONTEXT: Los celulares bloquean la cámara en conexiones HTTP (IP local). Para usarla, accedé mediante HTTPS o habilitá la IP en chrome://flags/#unsafely-treat-insecure-origin-as-secure."
        );
        return;
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Este dispositivo no soporta cámara en navegador.");
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
            },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        await videoEl.play();

        if (!detectorCtor) {
          setError("Tu navegador no soporta detección automática. Podés cargarlo manualmente.");
          return;
        }

        const detector = new detectorCtor();

        // Escaneo secuencial sin solapamiento de frames (previene parpadeo, caídas de FPS y sobrecalentamiento)
        const scanFrame = async () => {
          if (!active) return;
          if (!videoRef.current) return;
          if (videoRef.current.readyState < 2) {
            timerRef.current = window.setTimeout(scanFrame, 200);
            return;
          }

          try {
            const results = await detector.detect(videoRef.current as unknown as ImageBitmapSource);
            const raw = results.find((result) => result.rawValue)?.rawValue;
            const normalized = raw ? normalizeBarcode(raw) : "";

            if (normalized) {
              stopAll();
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              onDetectedRef.current(normalized);
              return;
            }
          } catch {
            // Ignorar errores transitorios de detección por frame
          }

          if (active) {
            timerRef.current = window.setTimeout(scanFrame, 250);
          }
        };

        timerRef.current = window.setTimeout(scanFrame, 200);
      } catch (err) {
        console.error("Error al iniciar cámara:", err);
        if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          setError("Permiso de cámara denegado. Asegurate de habilitar el permiso de cámara en el navegador.");
        } else if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")) {
          setError("No se detectó ninguna cámara en este dispositivo.");
        } else if (err instanceof DOMException && (err.name === "NotReadableError" || err.name === "TrackStartError")) {
          setError("La cámara está siendo utilizada por otra aplicación o pestaña del navegador.");
        } else {
          setError("No se pudo acceder a la cámara. Verificá permisos.");
        }
      } finally {
        setIsStarting(false);
      }
    };

    void start();

    return () => {
      active = false;
      stopAll();
    };
  }, [detectorCtor, open]);

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <ModalCloseButton label="Cerrar escáner" onClick={onClose} />
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline autoPlay />
          </div>

          {isStarting ? <p className="text-xs text-slate-500 dark:text-slate-400">Iniciando cámara...</p> : null}
          {!detectorSupported ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Este navegador no soporta detección automática nativa de códigos.
            </p>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 space-y-1">
              <p className="font-semibold">
                {error.startsWith("INSECURE_CONTEXT:") ? "Conexión HTTP en Teléfono Móvil" : "Error de Cámara"}
              </p>
              <p>{error.replace("INSECURE_CONTEXT: ", "")}</p>
              {error.startsWith("INSECURE_CONTEXT:") && (
                <div className="mt-2 p-2 rounded-lg bg-white/70 dark:bg-slate-900/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-1">
                  <p className="font-sans font-semibold text-slate-800 dark:text-slate-200">En Chrome para Android:</p>
                  <p>1. Ingresá a <span className="text-blue-600 dark:text-sky-400 select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span></p>
                  <p>2. Agregá la URL actual de tu servidor local.</p>
                  <p>3. Activá (Enabled) y reiniciá el navegador.</p>
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              Ingreso manual (respaldo)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                className="ui-input"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                placeholder="Ingresar código manual"
              />
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  const normalized = normalizeBarcode(manualBarcode);
                  if (!normalized) return;
                  onDetected(normalized);
                }}
              >
                Usar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
