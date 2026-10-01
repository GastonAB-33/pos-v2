import { useMemo, useState } from "react";
import { Mic, Sparkles, RefreshCw, Volume2 } from "lucide-react";
import { productVoiceService, type ProductVoiceAnalyzeResult } from "@/services/ia/product-voice.service";
import { useVoiceDictation } from "@/modules/productos/hooks/useVoiceDictation";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";
import {
  computePricingForward,
  DEFAULT_IVA_PERCENT,
} from "@/modules/productos/utils/product-pricing";

interface ProductVoiceAssistPanelProps {
  canWrite: boolean;
  disabled?: boolean;
  onClose: () => void;
  onApplySuggestions: (values: Partial<ProductFormValues>) => void;
}

const normalizeOptional = (value: string | null | undefined) => value?.trim() ?? "";

const mapVoiceSuggestionsToForm = (
  result: ProductVoiceAnalyzeResult
): Partial<ProductFormValues> => {
  const precioCosto = result.suggestions.cost ?? 0;
  const porcentajeGanancia = 0;
  const porcentajeIva = DEFAULT_IVA_PERCENT;
  const forward = computePricingForward({
    precioCosto,
    porcentajeGanancia,
    porcentajeIva,
  });

  return {
    nombre: normalizeOptional(result.suggestions.name),
    categoria: normalizeOptional(result.suggestions.category),
    subcategoria: normalizeOptional(result.suggestions.subcategory),
    codigoBarras: normalizeOptional(result.suggestions.barcode),
    stock: result.suggestions.stock_initial ?? 0,
    precioCosto,
    porcentajeGanancia,
    porcentajeIva,
    precioSinIva: forward.precioSinIva,
    precioFinal: result.suggestions.price ?? forward.precioFinal,
  };
};

export const ProductVoiceAssistPanel = ({
  canWrite,
  disabled,
  onClose,
  onApplySuggestions,
}: ProductVoiceAssistPanelProps) => {
  const {
    isSupported,
    isRecording,
    transcript,
    interimText,
    error: dictationError,
    setTranscript,
    startRecording,
    stopRecording,
    clearRecording,
  } = useVoiceDictation();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductVoiceAnalyzeResult | null>(null);

  const effectiveError = analysisError ?? dictationError;
  const canAnalyze = Boolean(transcript.trim()) && !isAnalyzing && !isRecording;

  const suggestionsForForm = useMemo(
    () => (result ? mapVoiceSuggestionsToForm(result) : null),
    [result]
  );

  const handleAnalyze = async () => {
    if (!canWrite || disabled) return;

    const raw = transcript.trim();
    if (!raw) {
      setAnalysisError("No hay texto para analizar.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await productVoiceService.analyzeTranscript(raw);
      setResult(analysis);
    } catch (reason) {
      const message =
        reason instanceof Error && reason.message
          ? reason.message
          : "No se pudo analizar el texto de voz.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    clearRecording();
    setResult(null);
    setAnalysisError(null);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-850">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Alta inteligente de producto por voz
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Dicta nombre, marca, precio, costo o stock. La IA inferirá los campos para el formulario.
          </p>
        </div>
        <ModalCloseButton
          label="Cerrar asistente de voz"
          onClick={onClose}
          disabled={disabled || isRecording || isAnalyzing}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {isRecording ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600"></span>
                    </span>
                    Grabando audio...
                  </>
                ) : (
                  "Micrófono listo"
                )}
              </span>
              <Volume2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isSupported
                ? "Ejemplo: 'Producto Yerba Playadito 1kg precio final 4500 costo 3200 stock 25'."
                : "Tu navegador no soporta dictado. Puedes pegar el texto manualmente a la derecha."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                disabled={disabled || isAnalyzing || !canWrite || !isSupported}
              >
                <Mic className="h-3.5 w-3.5" />
                Iniciar grabación
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/30 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                disabled={disabled || isAnalyzing || !canWrite}
              >
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                Detener grabación
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
              disabled={disabled || isRecording || isAnalyzing || !canWrite}
            >
              <RefreshCw className="h-3 w-3" />
              Limpiar
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Transcripción y análisis
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                disabled={!canAnalyze || disabled || !canWrite}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isAnalyzing ? "Analizando..." : "Analizar con IA"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!suggestionsForForm) return;
                  onApplySuggestions(suggestionsForForm);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={!suggestionsForForm || disabled || isAnalyzing || isRecording || !canWrite}
              >
                Aplicar sugerencias
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              rows={4}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="El texto dictado aparecerá aquí sin repeticiones..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500"
              disabled={disabled || isAnalyzing}
            />
            {interimText && (
              <div className="mt-1 flex items-center gap-1.5 text-xs italic text-blue-600 dark:text-blue-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span>"{interimText}"</span>
              </div>
            )}
          </div>

          {effectiveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {effectiveError}
            </div>
          ) : null}

          {!result ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Dicta el producto y luego presiona “Analizar con IA” para ver los campos detectados.
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 pb-1.5 dark:border-slate-700">
                <span>Motor: <strong className="text-slate-700 dark:text-slate-300">{result.provider}</strong></span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Nombre</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{result.suggestions.name ?? "-"}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Marca</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{result.suggestions.brand ?? "-"}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Categoría</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{result.suggestions.category ?? "-"}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Modo de venta</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {result.suggestions.sale_mode === "weight" ? "Por peso (kg)" : "Por unidad"}
                  </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Precio de venta</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {result.suggestions.price != null
                      ? result.suggestions.price.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Costo</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {result.suggestions.cost != null
                      ? result.suggestions.cost.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Stock inicial</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {result.suggestions.stock_initial != null
                      ? result.suggestions.stock_initial.toLocaleString("es-AR")
                      : "-"}
                  </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Código de barras</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{result.suggestions.barcode ?? "-"}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/80">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Descripción</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                    {result.suggestions.description ?? "-"}
                  </span>
                </div>
              </div>

              {result.warnings.length ? (
                <ul className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 space-y-1">
                  {result.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
