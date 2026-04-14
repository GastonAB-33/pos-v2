import { useEffect, useMemo, useRef, useState } from "react";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [manualBarcode, setManualBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const detectorCtor = useMemo(() => getBarcodeDetectorCtor(), []);
  const detectorSupported = Boolean(detectorCtor);

  useEffect(() => {
    if (!open) return;

    let active = true;

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
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
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Este dispositivo no soporta cámara en navegador.");
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

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

        timerRef.current = window.setInterval(async () => {
          if (!active) return;
          if (!videoRef.current) return;
          if (videoRef.current.readyState < 2) return;

          try {
            const results = await detector.detect(videoRef.current as unknown as ImageBitmapSource);
            const raw = results.find((result) => result.rawValue)?.rawValue;
            const normalized = raw ? normalizeBarcode(raw) : "";

            if (!normalized) return;

            stopAll();
            onDetected(normalized);
          } catch {
            // Ignorar errores transitorios de detección por frame.
          }
        }, 320);
      } catch {
        setError("No se pudo acceder a la cámara. Verificá permisos.");
      } finally {
        setIsStarting(false);
      }
    };

    void start();

    return () => {
      active = false;
      stopAll();
    };
  }, [detectorCtor, onDetected, open]);

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline autoPlay />
          </div>

          {isStarting ? <p className="text-xs text-slate-500">Iniciando cámara...</p> : null}
          {!detectorSupported ? (
            <p className="text-xs text-amber-700">
              Este navegador no soporta detección automática nativa de códigos.
            </p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Ingreso manual (respaldo)
            </label>
            <div className="flex items-center gap-2">
              <input
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
