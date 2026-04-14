import { useMemo, useState } from "react";
import type {
  ProductImportMode,
  ProductImportPreview,
  ProductImportResult,
} from "@/modules/productos/hooks/useProductsCrud";

interface ProductImportModalProps {
  canWrite: boolean;
  loading: boolean;
  onClose: () => void;
  onParseFile: (file: File) => Promise<ProductImportPreview>;
  onConfirmImport: (preview: ProductImportPreview, mode: ProductImportMode) => Promise<ProductImportResult>;
}

export const ProductImportModal = ({
  canWrite,
  loading,
  onClose,
  onParseFile,
  onConfirmImport,
}: ProductImportModalProps) => {
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [mode, setMode] = useState<ProductImportMode>("create_only");
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = loading || isParsing;

  const hasImportableRows = (preview?.validRows.length ?? 0) > 0;

  const topErrors = useMemo(() => {
    if (!preview) return [];
    return preview.errorRows.slice(0, 8);
  }, [preview]);

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Importacion masiva de productos (XLSX)</h3>
            <p className="text-xs text-slate-500">Subi un archivo, revisa validaciones y confirma la importacion.</p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="ui-btn-ghost cursor-pointer">
              Seleccionar XLSX
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={busy || !canWrite}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;

                  setError(null);
                  setImportResult(null);
                  setPreview(null);
                  setIsParsing(true);

                  void onParseFile(file)
                    .then((nextPreview) => {
                      setPreview(nextPreview);
                    })
                    .catch((reason) => {
                      const message =
                        reason instanceof Error && reason.message
                          ? reason.message
                          : "No se pudo leer el archivo XLSX";
                      setError(message);
                    })
                    .finally(() => {
                      setIsParsing(false);
                    });

                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />
            </label>

            <select
              className="ui-input w-[280px]"
              value={mode}
              onChange={(event) => setMode(event.target.value as ProductImportMode)}
              disabled={busy || !canWrite}
            >
              <option value="create_only">Modo: crear solo nuevos</option>
              <option value="upsert">Modo: crear y actualizar por codigo / codigo de barras</option>
            </select>

            <button
              type="button"
              className="ui-btn-primary"
              disabled={!hasImportableRows || busy || !canWrite}
              onClick={() => {
                if (!preview) return;
                setError(null);
                setImportResult(null);
                void onConfirmImport(preview, mode)
                  .then((result) => {
                    setImportResult(result);
                  })
                  .catch((reason) => {
                    const message =
                      reason instanceof Error && reason.message
                        ? reason.message
                        : "No se pudo ejecutar la importacion";
                    setError(message);
                  });
              }}
            >
              {loading ? "Importando..." : "Confirmar importacion"}
            </button>
          </div>

          {isParsing ? <div className="ui-loading">Analizando archivo...</div> : null}
          {error ? <div className="ui-error-state">{error}</div> : null}

          {preview ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="ui-summary-card">
                <p className="ui-summary-label">Archivo</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{preview.fileName}</p>
              </div>
              <div className="ui-summary-card">
                <p className="ui-summary-label">Filas totales</p>
                <p className="ui-kpi">{preview.totalRows}</p>
              </div>
              <div className="ui-summary-card">
                <p className="ui-summary-label">Filas validas</p>
                <p className="ui-kpi text-emerald-700">{preview.validRows.length}</p>
              </div>
              <div className="ui-summary-card">
                <p className="ui-summary-label">Filas con error</p>
                <p className="ui-kpi text-red-700">{preview.errorRows.length}</p>
              </div>
            </div>
          ) : (
            <div className="ui-empty-state">Selecciona un archivo XLSX para validar filas.</div>
          )}

          {topErrors.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-700">Errores detectados</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-700">
                {topErrors.map((errorItem) => (
                  <p key={`${errorItem.rowNumber}-${errorItem.message}`}>
                    Fila {errorItem.rowNumber}: {errorItem.message}
                  </p>
                ))}
              </div>
              {preview && preview.errorRows.length > topErrors.length ? (
                <p className="mt-1 text-xs text-red-700">
                  ... y {preview.errorRows.length - topErrors.length} errores mas
                </p>
              ) : null}
            </div>
          ) : null}

          {importResult ? (
            <div
              className={
                importResult.errors > 0
                  ? "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
              }
            >
              Resultado: creados {importResult.created} | actualizados {importResult.updated} | saltados {importResult.skipped} | errores {importResult.errors}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
