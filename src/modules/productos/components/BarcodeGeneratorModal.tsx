import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { ProductViewModel } from "@/modules/productos/types/product.types";

interface BarcodeGeneratorModalProps {
  open: boolean;
  product?: ProductViewModel | null;
  onClose: () => void;
}

const sanitizeBarcode = (value: string): string => value.replace(/\s+/g, "").trim();

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

  const barcodeValue = sanitizeBarcode(product?.codigoBarras ?? "");

  useEffect(() => {
    if (!open || !svgRef.current || !barcodeValue) return;

    try {
      JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        lineColor: "#111827",
        background: "#ffffff",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 12,
      });
    } catch {
      svgRef.current.innerHTML = "";
    }
  }, [barcodeValue, open]);

  if (!open || !product) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Código de Barras</h3>
            <p className="text-xs text-slate-500">
              {product.nombre} - {product.codigoProducto}
            </p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {barcodeValue ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mx-auto flex w-full max-w-xl justify-center overflow-x-auto">
                <svg ref={svgRef} role="img" aria-label={`Código de barras ${barcodeValue}`} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => {
                  if (!svgRef.current) return;
                  downloadSvg(svgRef.current.outerHTML, `barcode-${product.codigoProducto || product.entity.id}.svg`);
                }}
              >
                Descargar
              </button>

              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  if (!svgRef.current) return;

                  const printWindow = window.open("", "_blank", "width=640,height=480");
                  if (!printWindow) return;

                  printWindow.document.write(`
                    <html>
                      <head><title>Codigo de barras</title></head>
                      <body style="font-family: sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;">
                        <div style="text-align:center;">
                          <p style="margin-bottom: 8px; font-size: 14px;">${product.nombre}</p>
                          ${svgRef.current.outerHTML}
                        </div>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  printWindow.print();
                }}
              >
                Imprimir
              </button>
            </div>
          </>
        ) : (
          <div className="ui-empty-state">
            Este producto no tiene código de barras cargado. Edita el producto para agregarlo.
          </div>
        )}
      </div>
    </section>
  );
};
