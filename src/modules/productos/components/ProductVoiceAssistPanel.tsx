import { useMemo, useState } from "react";
import { productVoiceService, type ProductVoiceAnalyzeResult } from "@/services/ia/product-voice.service";
import { useVoiceDictation } from "@/modules/productos/hooks/useVoiceDictation";
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
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Alta de producto por voz</h3>
          <p className="mt-1 text-sm text-slate-600">
            La IA sugiere datos. Podes editarlos antes de guardar.
          </p>
        </div>
        <button type="button" onClick={onClose} className="ui-btn-ghost" disabled={disabled || isRecording || isAnalyzing}>
          Cerrar
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-900">
              Estado: {isRecording ? "Grabando..." : "Listo"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isSupported
                ? "Dictado local del navegador activo."
                : "Tu navegador no soporta dictado. Podes escribir/pegar el texto manualmente."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startRecording}
              className="ui-btn-primary disabled:opacity-60"
              disabled={disabled || isRecording || isAnalyzing || !canWrite || !isSupported}
            >
              Iniciar grabacion
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="ui-btn-ghost"
              disabled={disabled || !isRecording || isAnalyzing || !canWrite}
            >
              Detener grabacion
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="ui-btn-ghost"
              disabled={disabled || isRecording || isAnalyzing || !canWrite}
            >
              Volver a grabar
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Transcripcion y sugerencias</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                className="ui-btn-primary disabled:opacity-60"
                disabled={!canAnalyze || disabled || !canWrite}
              >
                {isAnalyzing ? "Analizando..." : "Analizar voz"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!suggestionsForForm) return;
                  onApplySuggestions(suggestionsForForm);
                }}
                className="ui-btn-primary disabled:opacity-60"
                disabled={!suggestionsForForm || disabled || isAnalyzing || isRecording || !canWrite}
              >
                Aplicar sugerencias
              </button>
            </div>
          </div>

          <textarea
            rows={6}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Texto transcripto de la voz..."
            className="ui-input"
            disabled={disabled || isAnalyzing}
          />

          {effectiveError ? <div className="ui-error-state">{effectiveError}</div> : null}

          {!result ? (
            <div className="ui-empty-state">
              Graba (o pega texto) y luego presiona “Analizar voz”.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-slate-500">Proveedor: {result.provider}</p>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Nombre</p>
                  <p className="font-medium text-slate-900">{result.suggestions.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Marca</p>
                  <p className="font-medium text-slate-900">{result.suggestions.brand ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Categoria</p>
                  <p className="font-medium text-slate-900">{result.suggestions.category ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Subcategoria</p>
                  <p className="font-medium text-slate-900">{result.suggestions.subcategory ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Modo venta</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.sale_mode === "weight" ? "Peso" : "Unidad"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Barcode</p>
                  <p className="font-medium text-slate-900">{result.suggestions.barcode ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Precio</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.price != null
                      ? result.suggestions.price.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Costo</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.cost != null
                      ? result.suggestions.cost.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Stock inicial</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.stock_initial != null
                      ? result.suggestions.stock_initial.toLocaleString("es-AR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Descripcion</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.description ?? "-"}
                  </p>
                </div>
              </div>

              {result.warnings.length ? (
                <ul className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                  {result.warnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
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
