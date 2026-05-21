import { useMemo, useState } from "react";
import type {
  ProductImportErrorRow,
  ProductImportMode,
  ProductImportPreview,
  ProductImportResult,
} from "@/modules/productos/hooks/useProductsCrud";

interface ProductImportModalProps {
  canWrite: boolean;
  loading: boolean;
  onClose: () => void;
  onDownloadTemplate: () => Promise<boolean>;
  onDownloadErrors: (errors: ProductImportErrorRow[]) => Promise<boolean>;
  onParseFile: (file: File) => Promise<ProductImportPreview>;
  onConfirmImport: (preview: ProductImportPreview, mode: ProductImportMode) => Promise<ProductImportResult>;
}

type PreviewTab = "valid" | "invalid";

const formatError = (error: ProductImportErrorRow): string => {
  const parts = [error.message];

  if (error.column) {
    parts.push(`Columna: ${error.column}`);
  }

  if (error.value) {
    parts.push(`Valor: ${error.value}`);
  }

  if (error.expected) {
    parts.push(`Esperado: ${error.expected}`);
  }

  return parts.join(" | ");
};

export const ProductImportModal = ({
  canWrite,
  loading,
  onClose,
  onDownloadTemplate,
  onDownloadErrors,
  onParseFile,
  onConfirmImport,
}: ProductImportModalProps) => {
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [mode, setMode] = useState<ProductImportMode>("create_only");
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>("valid");

  const busy = loading || isParsing;
  const hasBlockingErrors = (preview?.errorRows.length ?? 0) > 0;
  const hasImportableRows = (preview?.validRows.length ?? 0) > 0 && !hasBlockingErrors;

  const topErrors = useMemo(() => {
    if (!preview) return [];
    return preview.errorRows.slice(0, 200);
  }, [preview]);

  const topValidRows = useMemo(() => {
    if (!preview) return [];
    return preview.validRows.slice(0, 150);
  }, [preview]);

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Importación masiva de productos (XLSX)</h3>
            <p className="text-xs text-slate-500">Nombre y categoría son obligatorios. Respeta el formato predefinido por columna.</p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Formato esperado</p>
            <p className="mt-1">Obligatorios: <strong>nombre</strong> y <strong>categoría</strong>.</p>
            <p>Numéricos (si se informan): stock, precio costo, % ganancia, % IVA, precio final.</p>
            <p>La columna <strong>lista de precio</strong> es solo informativa y no se toma para importar.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ui-btn-ghost"
              disabled={busy}
              onClick={() => {
                void onDownloadTemplate();
              }}
            >
              Descargar plantilla
            </button>
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
                      setActiveTab(nextPreview.errorRows.length > 0 ? "invalid" : "valid");
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
              className="ui-input w-[300px]"
              value={mode}
              onChange={(event) => setMode(event.target.value as ProductImportMode)}
              disabled={busy || !canWrite}
            >
              <option value="create_only">Modo: crear solo nuevos</option>
              <option value="upsert">Modo: crear y actualizar por código / código de barras</option>
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
                        : "No se pudo ejecutar la importación";
                    setError(message);
                  });
              }}
            >
              {loading ? "Importando..." : "Confirmar importación"}
            </button>

            {preview?.errorRows.length ? (
              <button
                type="button"
                className="ui-btn-ghost"
                disabled={busy}
                onClick={() => {
                  void onDownloadErrors(preview.errorRows);
                }}
              >
                Descargar errores XLSX
              </button>
            ) : null}
          </div>

          {hasBlockingErrors ? (
            <div className="ui-error-state">
              Corregí las filas con error antes de confirmar la importación. No se crearán productos hasta que el archivo esté limpio.
            </div>
          ) : null}

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
                <p className="ui-summary-label">Filas válidas</p>
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

          {preview ? (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 p-2">
                <button
                  type="button"
                  className={activeTab === "valid" ? "ui-btn-primary px-2 py-1 text-xs" : "ui-btn-ghost px-2 py-1 text-xs"}
                  onClick={() => setActiveTab("valid")}
                >
                  Productos válidos ({preview.validRows.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "invalid" ? "ui-btn-primary px-2 py-1 text-xs" : "ui-btn-ghost px-2 py-1 text-xs"}
                  onClick={() => setActiveTab("invalid")}
                >
                  Productos con errores ({preview.errorRows.length})
                </button>
              </div>

              {activeTab === "valid" ? (
                topValidRows.length ? (
                  <div className="max-h-64 overflow-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-2 text-left">Fila</th>
                          <th className="px-2 py-2 text-left">Nombre</th>
                          <th className="px-2 py-2 text-left">Categoría</th>
                          <th className="px-2 py-2 text-left">Subcategoría</th>
                          <th className="px-2 py-2 text-left">Tipo</th>
                          <th className="px-2 py-2 text-left">Precio final</th>
                          <th className="px-2 py-2 text-left">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topValidRows.map((row) => (
                          <tr key={`ok-${row.rowNumber}`}>
                            <td className="px-2 py-2 text-slate-500">{row.rowNumber}</td>
                            <td className="px-2 py-2 text-slate-800">{row.name}</td>
                            <td className="px-2 py-2 text-slate-700">{row.category}</td>
                            <td className="px-2 py-2 text-slate-700">{row.subcategory ?? "-"}</td>
                            <td className="px-2 py-2 text-slate-700">{row.sale_mode === "weight" ? "Pesable" : "Unidad"}</td>
                            <td className="px-2 py-2 text-slate-700">
                              {row.price_final.toLocaleString("es-AR")}
                              {row.sale_mode === "weight" ? " / kg" : ""}
                            </td>
                            <td className="px-2 py-2 text-slate-700">
                              {row.stock_current.toLocaleString("es-AR")} {row.sale_mode === "weight" ? "kg" : "u."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 text-xs text-slate-500">No hay filas válidas para importar.</div>
                )
              ) : topErrors.length ? (
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-2 text-left">Fila</th>
                        <th className="px-2 py-2 text-left">Detalle del error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topErrors.map((errorItem, index) => (
                        <tr key={`err-${errorItem.rowNumber}-${index}`}>
                          <td className="px-2 py-2 text-red-700">{errorItem.rowNumber}</td>
                          <td className="px-2 py-2 text-red-700">{formatError(errorItem)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 text-xs text-slate-500">No se detectaron errores.</div>
              )}
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

