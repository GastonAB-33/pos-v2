import type { FC } from "react";
import { Search } from "lucide-react";
import type { LibroIvaVentaItem } from "../../types/libro-iva.types";
import { formatCurrency } from "../../utils/libro-iva.utils";

interface Props {
  ventas: LibroIvaVentaItem[];
  totalCount: number;
  search: string;
  onSearchChange: (val: string) => void;
}

export const LibroIvaVentasTable: FC<Props> = ({
  ventas,
  totalCount,
  search,
  onSearchChange,
}) => {
  const totalNeto = ventas.reduce(
    (acc, v) => acc + (v.isCreditNote ? -v.netoGravado21 : v.netoGravado21),
    0
  );
  const totalIva = ventas.reduce(
    (acc, v) => acc + (v.isCreditNote ? -v.iva21 : v.iva21),
    0
  );
  const totalFacturado = ventas.reduce(
    (acc, v) => acc + (v.isCreditNote ? -v.total : v.total),
    0
  );

  return (
    <div className="space-y-3">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por cliente, CUIT, nº de factura o CAE..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Mostrando {ventas.length} de {totalCount} comprobantes fiscales
        </span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <tr>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Nº Comprobante</th>
              <th className="px-3 py-2.5">Cliente / Razón Social</th>
              <th className="px-3 py-2.5">CUIT / DNI</th>
              <th className="px-3 py-2.5 text-right">Neto Gravado</th>
              <th className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300">IVA Débito (21%)</th>
              <th className="px-3 py-2.5 text-right font-bold">Total</th>
              <th className="px-3 py-2.5 text-center">CAE / Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No se encontraron comprobantes de venta emitidos en este período.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr
                  key={v.id}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
                    v.isCreditNote ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{v.issueDate}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        v.isCreditNote
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                          : v.rawDocumentType === "A"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                      }`}
                    >
                      {v.documentType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {v.formattedVoucher}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-medium" title={v.customerName}>
                    {v.customerName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {v.customerDocNumber !== "0" ? v.customerDocNumber : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                    {v.isCreditNote ? `-${formatCurrency(v.netoGravado21)}` : formatCurrency(v.netoGravado21)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">
                    {v.isCreditNote ? `-${formatCurrency(v.iva21)}` : formatCurrency(v.iva21)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {v.isCreditNote ? `-${formatCurrency(v.total)}` : formatCurrency(v.total)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    {v.cae ? (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                        title={`CAE: ${v.cae} (Vto: ${v.caeVto || "-"})`}
                      >
                        ✓ {v.cae.slice(-4)}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-400">Interno</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {ventas.length > 0 ? (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-bold dark:border-slate-700 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px]">
                  Totales Libro Ventas:
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatCurrency(totalNeto)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-blue-700 dark:text-blue-300">
                  {formatCurrency(totalIva)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatCurrency(totalFacturado)}</td>
                <td></td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
};
