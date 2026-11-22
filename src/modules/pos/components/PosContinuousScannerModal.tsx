import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Flashlight, FlashlightOff, RefreshCw, ShoppingCart, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { cn } from "@/utils/cn";

interface ScannedItemRecord {
  id: string;
  name: string;
  price?: number;
  barcode: string;
  timestamp: string;
}

interface PosContinuousScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => Promise<{ ok: boolean; name?: string; price?: number; error?: string }>;
  cartItemsCount: number;
  cartTotal: number;
}

type BarcodeDetectionResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectionResult[]>;
};

type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const normalizeBarcode = (value: string): string => value.replace(/\s+/g, "").trim();

const getBarcodeDetectorCtor = (): BarcodeDetectorCtorLike | null => {
  if (typeof window === "undefined") return null;
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
  return detector ?? null;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

// Sintetizador Web Audio para sonido POS realista sin dependencias externas
class ScannerAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Beep agudo y positivo (tipo scanner de supermercado)
  public playSuccess() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1950, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignorar restricciones de audio del navegador
    }
  }

  // Tono grave de advertencia / error (doble buzz descendente)
  public playError() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [0, 0.11].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, now + delay);
        osc.frequency.linearRampToValueAtTime(220, now + delay + 0.08);

        gain.gain.setValueAtTime(0.25, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.08);
      });
    } catch {
      // Ignorar restricciones de audio del navegador
    }
  }
}

const audioEngine = new ScannerAudioEngine();

const triggerHaptic = (type: "success" | "error") => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      if (type === "success") {
        navigator.vibrate(80);
      } else {
        navigator.vibrate([80, 50, 80]);
      }
    } catch {
      // Ignorar si el navegador restringe vibración
    }
  }
};

export const PosContinuousScannerModal = ({
  open,
  onClose,
  onScan,
  cartItemsCount,
  cartTotal,
}: PosContinuousScannerModalProps) => {
  useBodyScrollLock(open);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Control para no repetir el mismo código sostenido frente a la cámara (cooldown 1.5s)
  const lastScannedBarcodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Estado de feedback visual
  const [feedbackState, setFeedbackState] = useState<"idle" | "success" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [recentScans, setRecentScans] = useState<ScannedItemRecord[]>([]);

  const detectorCtor = useMemo(() => getBarcodeDetectorCtor(), []);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const processBarcode = useCallback(async (rawBarcode: string) => {
    const normalized = normalizeBarcode(rawBarcode);
    if (!normalized || isProcessingRef.current) return;

    const now = Date.now();
    // Cooldown para el mismo código exacto: 1600ms para no sumar múltiples unidades sin querer
    if (normalized === lastScannedBarcodeRef.current && now - lastScannedTimeRef.current < 1600) {
      return;
    }

    lastScannedBarcodeRef.current = normalized;
    lastScannedTimeRef.current = now;
    isProcessingRef.current = true;

    try {
      const res = await onScanRef.current(normalized);

      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      if (res.ok) {
        audioEngine.playSuccess();
        triggerHaptic("success");
        setFeedbackState("success");
        const displayName = res.name || "Producto agregado";
        const priceLabel = res.price ? ` (${currencyFormatter.format(res.price)})` : "";
        setFeedbackMessage(`${displayName}${priceLabel}`);

        setRecentScans((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            name: displayName,
            price: res.price,
            barcode: normalized,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev.slice(0, 3),
        ]);

        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedbackState("idle");
          setFeedbackMessage("");
        }, 1200);
      } else {
        audioEngine.playError();
        triggerHaptic("error");
        setFeedbackState("error");
        setFeedbackMessage(res.error || `Código no registrado: ${normalized}`);

        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedbackState("idle");
          setFeedbackMessage("");
        }, 1600);
      }
    } catch {
      audioEngine.playError();
      triggerHaptic("error");
      setFeedbackState("error");
      setFeedbackMessage(`Error al procesar: ${normalized}`);

      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedbackState("idle");
        setFeedbackMessage("");
      }, 1600);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean };
      if (capabilities.torch) {
        const next = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
        });
        setIsTorchOn(next);
      }
    } catch (err) {
      console.warn("Torch no soportada:", err);
    }
  }, [isTorchOn]);

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setIsTorchOn(false);
  }, []);

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
      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
    };

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador o dispositivo no tiene acceso a la cámara.");
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Verificar si la cámara tiene linterna / torch
        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const capabilities = track.getCapabilities() as { torch?: boolean };
          setHasTorch(Boolean(capabilities.torch));
        }

        const videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        await videoEl.play();

        if (!detectorCtor) {
          setError("Tu navegador no soporta detección automática nativa. Podés tipear el código abajo.");
          return;
        }

        let detector: BarcodeDetectorLike;
        try {
          detector = new detectorCtor({
            formats: [
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "code_128",
              "code_39",
              "code_93",
              "itf",
              "qr_code",
            ],
          });
        } catch {
          detector = new detectorCtor();
        }

        // Bucle de escaneo continuo sin cerrar la cámara
        const scanFrame = async () => {
          if (!active) return;
          if (!videoRef.current) return;
          if (videoRef.current.readyState < 2) {
            timerRef.current = window.setTimeout(scanFrame, 150);
            return;
          }

          try {
            const results = await detector.detect(videoRef.current as unknown as ImageBitmapSource);
            const found = results.find((r) => r.rawValue)?.rawValue;
            if (found) {
              await processBarcode(found);
            }
          } catch {
            // Ignorar errores transitorios por frame desenfocado
          }

          if (active) {
            timerRef.current = window.setTimeout(scanFrame, 180);
          }
        };

        timerRef.current = window.setTimeout(scanFrame, 200);
      } catch (err) {
        console.error("Error al iniciar cámara:", err);
        if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          setError("Permiso de cámara bloqueado o denegado. Tocá el candado o ícono de ajustes en la barra del navegador para permitir la cámara.");
        } else if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")) {
          setError("No se detectó ninguna cámara disponible en este dispositivo.");
        } else {
          setError("No se pudo acceder a la cámara. Verificá los permisos de tu navegador.");
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
  }, [detectorCtor, facingMode, open, processBarcode]);

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[80] flex flex-col bg-slate-950 sm:p-4 sm:flex-row sm:items-center sm:justify-center sm:bg-slate-950/75 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md md:max-w-lg bg-slate-950 text-white sm:rounded-3xl sm:border sm:border-slate-800 shadow-2xl overflow-hidden">
        {/* Cabecera flotante */}
        <div className="relative z-20 flex items-center justify-between p-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Escáner Continuo
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  En vivo
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">Escaneá uno tras otro sin pausas</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasTorch ? (
              <button
                type="button"
                onClick={toggleTorch}
                className={cn(
                  "h-8 w-8 inline-flex items-center justify-center rounded-full transition cursor-pointer",
                  isTorchOn
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                )}
                title={isTorchOn ? "Apagar linterna" : "Encender linterna"}
              >
                {isTorchOn ? <FlashlightOff size={15} /> : <Flashlight size={15} />}
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggleCameraFacing}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Cambiar cámara (trasera / frontal)"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              title="Cerrar escáner"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Resumen del Carrito en vivo */}
        <div className="relative z-10 px-3.5 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <ShoppingCart size={14} className="text-blue-400" />
            <span>Carrito actual:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">
              {cartItemsCount} {cartItemsCount === 1 ? "ítem" : "ítems"}
            </span>
          </div>
          <span className="font-mono font-extrabold text-blue-400 text-sm">
            {currencyFormatter.format(cartTotal)}
          </span>
        </div>

        {/* Visor de Cámara con Retícula y Láser reactivo */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[280px] sm:min-h-[340px]">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Sombra oscura perimetral para centrar la mirada en el visor */}
          <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_45%,rgba(0,0,0,0.7)_80%]" />

          {/* Cuadro de Escaneo (Viewfinder) reactivo */}
          <div
            className={cn(
              "relative w-[82%] max-w-[320px] aspect-[4/3] rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center p-3 shadow-2xl",
              feedbackState === "success" &&
                "border-emerald-400 ring-4 ring-emerald-500/50 shadow-emerald-500/40 bg-emerald-500/10",
              feedbackState === "error" &&
                "border-rose-500 ring-4 ring-rose-500/50 shadow-rose-500/40 bg-rose-500/10",
              feedbackState === "idle" &&
                "border-sky-400/80 shadow-sky-500/20 bg-sky-950/5"
            )}
          >
            {/* Esquinas guía de enfoque */}
            <div
              className={cn(
                "absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 transition-colors",
                feedbackState === "success"
                  ? "border-emerald-300"
                  : feedbackState === "error"
                  ? "border-rose-400"
                  : "border-sky-300"
              )}
            />
            <div
              className={cn(
                "absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 transition-colors",
                feedbackState === "success"
                  ? "border-emerald-300"
                  : feedbackState === "error"
                  ? "border-rose-400"
                  : "border-sky-300"
              )}
            />
            <div
              className={cn(
                "absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 transition-colors",
                feedbackState === "success"
                  ? "border-emerald-300"
                  : feedbackState === "error"
                  ? "border-rose-400"
                  : "border-sky-300"
              )}
            />
            <div
              className={cn(
                "absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 transition-colors",
                feedbackState === "success"
                  ? "border-emerald-300"
                  : feedbackState === "error"
                  ? "border-rose-400"
                  : "border-sky-300"
              )}
            />

            {/* Línea láser de escaneo */}
            <div
              className={cn(
                "w-full h-[2px] transition-all duration-150 animate-pulse",
                feedbackState === "success" && "bg-emerald-400 shadow-[0_0_12px_#34d399] h-[3px]",
                feedbackState === "error" && "bg-rose-500 shadow-[0_0_12px_#f43f5e] h-[3px]",
                feedbackState === "idle" && "bg-sky-400 shadow-[0_0_8px_#38bdf8]"
              )}
            />
          </div>

          {/* Cartel flotante de estado en vivo */}
          <div className="absolute bottom-4 left-3 right-3 flex justify-center z-20">
            {feedbackState === "success" ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-600/95 text-white font-bold text-xs shadow-xl animate-in fade-in zoom-in-95">
                <CheckCircle2 size={16} className="text-white shrink-0" />
                <span className="truncate max-w-[280px]">{feedbackMessage}</span>
              </div>
            ) : feedbackState === "error" ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-600/95 text-white font-bold text-xs shadow-xl animate-in fade-in zoom-in-95">
                <AlertCircle size={16} className="text-white shrink-0" />
                <span className="truncate max-w-[280px]">{feedbackMessage}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-300 text-[11px] font-semibold border border-slate-700/80">
                <span>Apuntá al código de barras</span>
              </div>
            )}
          </div>

          {isStarting && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 z-30">
              <RefreshCw className="animate-spin text-blue-400" size={24} />
              <p className="text-xs text-slate-400">Iniciando cámara...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center gap-2 z-30">
              <AlertCircle size={32} className="text-rose-400 mb-1" />
              <p className="text-xs font-semibold text-rose-300 max-w-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Panel Inferior: Ingreso Manual y Últimos Escaneados */}
        <div className="relative z-20 p-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
          {/* Ingreso manual rápido de respaldo */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = manualBarcode.trim();
              if (!clean) return;
              void processBarcode(clean);
              setManualBarcode("");
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              inputMode="numeric"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="¿Código borroso? Ingresalo manual..."
              className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!manualBarcode.trim()}
              className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer shrink-0"
            >
              Agregar
            </button>
          </form>

          {/* Historial de últimos agregados en esta sesión de escaneo */}
          {recentScans.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Últimos productos escaneados:
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2 py-1 rounded-lg text-[10px] shrink-0 max-w-[170px]"
                  >
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                    <span className="font-bold text-slate-200 truncate" title={item.name}>
                      {item.name}
                    </span>
                    {item.price ? (
                      <span className="font-mono text-emerald-400 shrink-0">
                        {currencyFormatter.format(item.price)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Botón Finalizar / Listo */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-[0.98] transition cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>Listo, volver al Carrito ({cartItemsCount} {cartItemsCount === 1 ? "ítem" : "ítems"})</span>
          </button>
        </div>
      </div>
    </section>
  );
};
