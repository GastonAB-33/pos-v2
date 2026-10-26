import type { ProductViewModel } from "@/modules/productos/types/product.types";
import { downloadXlsx } from "@/utils/xlsx";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export interface PriceListExportOptions {
  businessName?: string;
  filtersSummary?: string;
  sortSummary?: string;
}

/**
 * Exporta la lista de precios actual a un archivo Excel (.xlsx) respetando filtros y orden
 */
export const exportPriceListXlsx = async (
  products: ProductViewModel[],
  options?: PriceListExportOptions
): Promise<boolean> => {
  if (!products.length) return false;

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanPrefix = options?.businessName
    ? `${options.businessName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-`
    : "";
  const fileName = `${cleanPrefix}lista-de-precios-${dateStr}`;

  const rows = products.map((p, index) => {
    const isWeight = p.saleMode === "weight";
    return {
      "#": index + 1,
      Código: p.codigoProducto || p.barcode || "-",
      "Código de Barras": p.barcode || p.codigoBarras || "-",
      Producto: p.nombre,
      Modalidad: isWeight ? "Pesable (Kg)" : "Por Unidad",
      Categoría: p.categoria || "-",
      Subcategoría: p.subcategoria || "-",
      "Precio Final ($)": p.precioFinal,
      Stock: isWeight ? `${(p.stock * 1000).toLocaleString("es-AR")} g` : p.stock,
      "Seguimiento Stock": p.trackStock ? "Activo" : "Sin seguimiento",
      Estado: p.activo ? "Activo" : "Inactivo",
    };
  });

  return downloadXlsx(fileName, "Lista de Precios", rows);
};

/**
 * Genera e imprime / descarga la lista de precios en PDF en el navegador
 * respetando el ordenamiento y los filtros aplicados.
 */
export const printPriceListPdf = (
  products: ProductViewModel[],
  options?: PriceListExportOptions
) => {
  if (typeof window === "undefined" || !products.length) return;

  const businessName = options?.businessName?.trim() || "Comercio";
  const now = new Date().toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableRowsHtml = products
    .map((p, idx) => {
      const isWeight = p.saleMode === "weight";
      const code = p.codigoProducto || p.barcode || "-";
      const cat = p.categoria || "-";
      const sub = p.subcategoria ? ` / ${p.subcategoria}` : "";
      const priceFormatted = currency.format(p.precioFinal);
      const modeLabel = isWeight ? "Pesable (Kg)" : "Unidad";

      return `
        <tr>
          <td style="text-align: center; color: #64748b; font-size: 10px;">${idx + 1}</td>
          <td style="font-family: monospace; font-size: 10px; color: #475569;">${escapeHtml(code)}</td>
          <td style="font-weight: 600; color: #0f172a;">${escapeHtml(p.nombre)}</td>
          <td style="font-size: 10px; color: #475569;">${escapeHtml(modeLabel)}</td>
          <td style="font-size: 10px; color: #475569;">${escapeHtml(cat + sub)}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">
            ${priceFormatted}${isWeight ? ' <span style="font-size: 9px; font-weight: 400; color: #64748b;">/ kg</span>' : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Lista de Precios - ${escapeHtml(businessName)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #fff;
          font-size: 11px;
          line-height: 1.35;
          padding: 10px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .business-title {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .meta-info {
          text-align: right;
          font-size: 10px;
          color: #64748b;
        }
        .filter-banner {
          background: #f1f5f9;
          border-left: 3px solid #2563eb;
          padding: 5px 8px;
          margin-bottom: 12px;
          font-size: 10px;
          color: #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
          padding: 7px 6px;
          text-align: left;
          border: 1px solid #0f172a;
        }
        td {
          padding: 5.5px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .footer {
          margin-top: 15px;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="business-title">${escapeHtml(businessName)}</h1>
          <div class="doc-title">Lista de Precios</div>
        </div>
        <div class="meta-info">
          <div><strong>Fecha de emisión:</strong> ${now}</div>
          <div><strong>Total de artículos:</strong> ${products.length}</div>
        </div>
      </div>

      ${
        options?.filtersSummary || options?.sortSummary
          ? `
          <div class="filter-banner">
            <div>
              ${options.filtersSummary ? `<span><strong>Filtros:</strong> ${escapeHtml(options.filtersSummary)}</span>` : ""}
            </div>
            <div>
              ${options.sortSummary ? `<span><strong>Orden:</strong> ${escapeHtml(options.sortSummary)}</span>` : ""}
            </div>
          </div>
        `
          : ""
      }

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 80px;">Código</th>
            <th>Producto</th>
            <th style="width: 85px;">Modalidad</th>
            <th style="width: 150px;">Categoría</th>
            <th style="width: 100px; text-align: right;">Precio Final</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>Documento generado desde el Sistema POS</div>
        <div>Página generada el ${now}</div>
      </div>
    </body>
    </html>
  `;

  // Imprimir a través de un iframe invisible para no alterar la pantalla ni ser bloqueado por popup blockers
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Error al imprimir iframe:", e);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 350);
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
