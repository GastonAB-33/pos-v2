import { useRef } from "react";
import { useProductImageAnalysis } from "@/modules/productos/hooks/useProductImageAnalysis";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

interface ProductPhotoAssistPanelProps {
  canWrite: boolean;
  disabled?: boolean;
  onClose: () => void;
  onApplySuggestions: (values: Partial<ProductFormValues>) => void;
}

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
};

export const ProductPhotoAssistPanel = ({
  canWrite,
  disabled,
  onClose,
  onApplySuggestions,
}: ProductPhotoAssistPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    imageFile,
    previewUrl,
    result,
    suggestedFormValues,
    isAnalyzing,
    error,
    canAnalyze,
    needsReanalyze,
    clearResult,
    setImage,
    clearImage,
    analyze,
    clearError,
  } = useProductImageAnalysis();

  const handlePickImage = () => {
    if (disabled || !canWrite) return;
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!canWrite || disabled) return;

    if (result && !needsReanalyze) {
      const confirmed = window.confirm(
        "Esta imagen ya fue analizada. Queres volver a procesarla?"
      );
      if (!confirmed) return;
    }

    await analyze();
  };

  const handleApply = () => {
    if (!suggestedFormValues) return;
    onApplySuggestions(suggestedFormValues);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Alta de producto por foto</h3>
          <p className="mt-1 text-sm text-slate-600">
            La IA sugiere datos. Podes editarlos antes de guardar.
          </p>
        </div>
        <button type="button" onClick={onClose} className="ui-btn-ghost" disabled={disabled || isAnalyzing}>
          Cerrar
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setImage(file);
          clearError();
          if (event.target) event.target.value = "";
        }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {!previewUrl ? (
            <div className="ui-empty-state min-h-[260px]">
              Selecciona una imagen para previsualizar y analizar.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <img src={previewUrl} alt="Preview producto" className="h-[260px] w-full object-contain" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePickImage}
              className="ui-btn-ghost"
              disabled={disabled || isAnalyzing || !canWrite}
            >
              Cambiar foto
            </button>
            <button
              type="button"
              onClick={() => {
                clearImage();
                clearResult();
              }}
              className="ui-btn-ghost"
              disabled={disabled || isAnalyzing || !imageFile || !canWrite}
            >
              Quitar foto
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              className="ui-btn-primary disabled:opacity-60"
              disabled={!canAnalyze || disabled || !canWrite}
            >
              {isAnalyzing ? "Analizando..." : "Analizar con IA"}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Sugerencias IA</h4>
            <button
              type="button"
              onClick={handleApply}
              className="ui-btn-primary disabled:opacity-60"
              disabled={!suggestedFormValues || isAnalyzing || disabled || !canWrite}
            >
              Aplicar sugerencias
            </button>
          </div>

          {imageFile ? (
            <p className="text-xs text-slate-500">
              Archivo: {imageFile.name} ({formatBytes(imageFile.size)})
            </p>
          ) : null}

          {error ? <div className="ui-error-state">{error}</div> : null}

          {!result ? (
            <div className="ui-empty-state">
              Carga una foto y ejecuta “Analizar con IA” para obtener sugerencias.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-slate-500">
                Proveedor: {result.provider} | Imagen procesada: {result.processed_image.width}x
                {result.processed_image.height} - {formatBytes(result.processed_image.bytes)}
              </p>

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
                  <p className="text-xs text-slate-500">Precio sugerido</p>
                  <p className="font-medium text-slate-900">
                    {result.suggestions.suggested_price != null
                      ? result.suggestions.suggested_price.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Descripcion</p>
                  <p className="font-medium text-slate-900">{result.suggestions.description ?? "-"}</p>
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
