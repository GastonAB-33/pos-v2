import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, Download, Tag, AlertCircle, Check } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { ProductViewModel } from "@/modules/productos/types/product.types";

interface BarcodeGeneratorModalProps {
  open: boolean;
  product?: ProductViewModel | null;
  onClose: () => void;
}

export type LabelCodeType = "barcode" | "product_code";

export interface LabelPrintSettings {
  codeType: LabelCodeType;
  showName: boolean;
  showPrice: boolean;
  showBarcode: boolean;
}

const STORAGE_KEY = "pos_label_print_settings_v1";

const DEFAULT_SETTINGS: LabelPrintSettings = {
  codeType: "barcode",
  showName: true,
  showPrice: true,
  showBarcode: true,
};

const loadSavedSettings = (): LabelPrintSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        codeType: parsed.codeType === "product_code" ? "product_code" : "barcode",
        showName: typeof parsed.showName === "boolean" ? parsed.showName : true,
        showPrice: typeof parsed.showPrice === "boolean" ? parsed.showPrice : true,
        showBarcode: typeof parsed.showBarcode === "boolean" ? parsed.showBarcode : true,
      };
    }
  } catch {
    // fallback a valores por defecto
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: LabelPrintSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignorar error de almacenamiento
  }
};

const sanitizeBarcode = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, "").trim();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const downloadSvg = (svgMarkup: string, fileName: string) => {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const BarcodeGeneratorModal = ({ open, product, onClose }: BarcodeGeneratorModalProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  useBodyScrollLock(open);

  const [settings, setSettings] = useState<LabelPrintSettings>(loadSavedSettings);

  // Guardar configuración automáticamente cada vez que cambie
  const updateSettings = (patch: Partial<LabelPrintSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...patch };
      saveSettings(updated);
      return updated;
    });
  };

  const commercialBarcode = sanitizeBarcode(product?.codigoBarras ?? "");
  const productCode = sanitizeBarcode(product?.codigoProducto ?? "");

  const activeCodeValue = useMemo(() => {
    return settings.codeType === "product_code" ? productCode : commercialBarcode;
  }, [settings.codeType, productCode, commercialBarcode]);

  const formattedPrice = useMemo(() => {
    if (!product) return "";
    return `${currency.format(product.precioFinal)}${product.saleMode === "weight" ? " / kg" : ""}`;
  }, [product]);

  useEffect(() => {
    if (!open || !svgRef.current) return;

    if (!activeCodeValue || !settings.showBarcode) {
      svgRef.current.innerHTML = "";
      return;
    }

    try {
      JsBarcode(svgRef.current, activeCodeValue, {
        format: "CODE128",
        lineColor: "#0f172a",
        background: "#ffffff",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 13,
        margin: 6,
        textMargin: 3,
      });
    } catch {
      if (svgRef.current) {
        svgRef.current.innerHTML = "";
      }
    }
  }, [activeCodeValue, settings.showBarcode, open]);

  if (!open || !product) return null;

  const hasSelectedCode = Boolean(activeCodeValue);
  const hasCommercial = Boolean(commercialBarcode);
  const hasProductCode = Boolean(productCode);

  const handlePrint = () => {
    if (!product) return;

    const printWindow = window.open("", "_blank", "width=600,height=500");
    if (!printWindow) return;

    const barcodeHtml =
      settings.showBarcode && hasSelectedCode && svgRef.current
        ? svgRef.current.outerHTML
        : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta - ${product.nombre}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 4px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
              color: #000;
            }
            .label-card {
              width: 100%;
              max-width: 58mm;
              padding: 2mm 3mm;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .prod-name {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              line-height: 1.15;
              margin-bottom: 2px;
              word-break: break-word;
              letter-spacing: 0.2px;
            }
            .prod-price {
              font-size: 16px;
              font-weight: 900;
              margin: 3px 0;
              letter-spacing: -0.3px;
            }
            .barcode-box {
              margin-top: 2px;
              display: flex;
              justify-content: center;
              width: 100%;
            }
            .barcode-box svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            ${settings.showName ? `<div class="prod-name">${product.nombre}</div>` : ""}
            ${settings.showPrice ? `<div class="prod-price">${formattedPrice}</div>` : ""}
            ${barcodeHtml ? `<div class="barcode-box">${barcodeHtml}</div>` : ""}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-panel md:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Etiqueta y Código de Barras</h3>
              <p className="text-xs text-slate-500">Configura los datos a imprimir y genera tu etiqueta adhesiva</p>
            </div>
          </div>
          <ModalCloseButton label="Cerrar modal de etiqueta" onClick={onClose} />
        </div>

        {/* Panel de Controles */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          {/* Desplegable para tipo de código */}
          <div>
            <label htmlFor="label-code-type" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tipo de código a imprimir
            </label>
            <select
              id="label-code-type"
              className="ui-input h-10 w-full font-medium"
              value={settings.codeType}
              onChange={(e) => updateSettings({ codeType: e.target.value as LabelCodeType })}
            >
              <option value="barcode">
                🏷️ Código de barras comercial {hasCommercial ? `(${commercialBarcode})` : "(No asignado)"}
              </option>
              <option value="product_code">
                🔢 Código de producto / interno {hasProductCode ? `(${productCode})` : "(No asignado)"}
              </option>
            </select>
          </div>

          {/* Advertencia si no tiene cargado el código seleccionado */}
          {!hasSelectedCode && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold">
                  {settings.codeType === "barcode"
                    ? "Este producto no tiene cargado un código de barras comercial."
                    : "Este producto no tiene asignado un código de producto interno."}
                </p>
                <p className="mt-0.5 text-amber-700">
                  {settings.codeType === "barcode" && hasProductCode ? (
                    <span>
                      Podés cambiar al{" "}
                      <button
                        type="button"
                        className="font-bold underline hover:text-amber-900"
                        onClick={() => updateSettings({ codeType: "product_code" })}
                      >
                        Código de producto ({productCode})
                      </button>{" "}
                      para imprimir las barras con su código interno.
                    </span>
                  ) : settings.codeType === "product_code" && hasCommercial ? (
                    <span>
                      Podés cambiar al{" "}
                      <button
                        type="button"
                        className="font-bold underline hover:text-amber-900"
                        onClick={() => updateSettings({ codeType: "barcode" })}
                      >
                        Código de barras comercial ({commercialBarcode})
                      </button>{" "}
                      para imprimir la etiqueta.
                    </span>
                  ) : (
                    "Edita el producto en el catálogo para cargarle un código."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Opciones de combinación (Checkboxes) */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Elementos a incluir en la etiqueta
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Checkbox Nombre */}
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.showName
                    ? "border-indigo-300 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.showName}
                  onChange={(e) => updateSettings({ showName: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Nombre del producto</span>
              </label>

              {/* Checkbox Precio */}
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.showPrice
                    ? "border-indigo-300 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.showPrice}
                  onChange={(e) => updateSettings({ showPrice: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Precio actual</span>
              </label>

              {/* Checkbox Código de Barras */}
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.showBarcode
                    ? "border-indigo-300 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.showBarcode}
                  onChange={(e) => updateSettings({ showBarcode: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Código de barras</span>
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Las opciones seleccionadas se guardan automáticamente para tus próximas impresiones.
            </p>
          </div>
        </div>

        {/* Vista previa de la Etiqueta Adhesiva */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vista previa de etiqueta adhesiva
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Check className="h-3 w-3 text-emerald-500" /> Formato térmico (50x30 mm / continuo)
            </span>
          </div>

          <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-100/70 p-4 md:p-6">
            <div className="w-full max-w-xs rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 shadow-sm transition-all">
              {!settings.showName && !settings.showPrice && !settings.showBarcode ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Selecciona al menos una opción para previsualizar la etiqueta.
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  {/* Nombre */}
                  {settings.showName ? (
                    <p className="line-clamp-2 text-sm font-extrabold uppercase tracking-wide text-slate-900 md:text-base">
                      {product.nombre}
                    </p>
                  ) : null}

                  {/* Precio */}
                  {settings.showPrice ? (
                    <p className="my-1.5 text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                      {formattedPrice}
                    </p>
                  ) : null}

                  {/* Código de barras */}
                  {settings.showBarcode ? (
                    hasSelectedCode ? (
                      <div className="mt-1 flex w-full justify-center overflow-x-auto">
                        <svg
                          ref={svgRef}
                          role="img"
                          aria-label={`Código de barras ${activeCodeValue}`}
                          className="max-w-full"
                        />
                      </div>
                    ) : (
                      <div className="mt-1.5 w-full rounded-md border border-amber-200 bg-amber-50/80 py-2 text-center text-[11px] font-medium text-amber-700">
                        {settings.codeType === "barcode"
                          ? "Sin código de barras comercial"
                          : "Sin código de producto"}
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button type="button" className="ui-btn-ghost text-xs" onClick={onClose}>
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {settings.showBarcode && hasSelectedCode ? (
              <button
                type="button"
                className="ui-btn-secondary flex items-center gap-1.5 text-xs"
                onClick={() => {
                  if (!svgRef.current) return;
                  const labelType = settings.codeType === "product_code" ? "cod" : "barra";
                  downloadSvg(
                    svgRef.current.outerHTML,
                    `etiqueta-${labelType}-${activeCodeValue}-${product.entity.id}.svg`
                  );
                }}
              >
                <Download className="h-4 w-4" />
                <span>Descargar SVG</span>
              </button>
            ) : null}

            <button
              type="button"
              className="ui-btn-primary flex items-center gap-1.5 text-xs"
              onClick={handlePrint}
              disabled={!settings.showName && !settings.showPrice && !settings.showBarcode}
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
