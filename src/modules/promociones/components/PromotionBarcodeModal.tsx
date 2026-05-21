import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { buildPromotionBarcode, type PromotionWithDetails } from "@/services/promotions.service";

interface PromotionBarcodeModalProps {
  promotion: PromotionWithDetails | null;
  onClose: () => void;
}

const downloadSvg = (svgMarkup: string, fileName: string) => {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const PromotionBarcodeModal = ({ promotion, onClose }: PromotionBarcodeModalProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const barcode = promotion?.barcodes?.[0]?.barcode ?? (promotion ? buildPromotionBarcode(promotion.code) : "");

  useEffect(() => {
    if (!promotion || !svgRef.current || !barcode) return;

    try {
      JsBarcode(svgRef.current, barcode, {
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
  }, [barcode, promotion]);

  if (!promotion) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Codigo de barras</h3>
            <p className="font-mono text-xs text-slate-500">{promotion.name} - {promotion.code}</p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mx-auto flex w-full max-w-xl justify-center overflow-x-auto">
            <svg ref={svgRef} role="img" aria-label={`Codigo de barras ${barcode}`} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={() => {
              if (!svgRef.current) return;
              downloadSvg(svgRef.current.outerHTML, `promo-${promotion.code}.svg`);
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
                      <p style="margin-bottom: 8px; font-size: 14px;">${promotion.name}</p>
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
      </div>
    </section>
  );
};
