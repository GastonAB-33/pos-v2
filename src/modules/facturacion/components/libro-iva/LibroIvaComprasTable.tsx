import type { FC } from "react";
import { Search } from "lucide-react";
import type { LibroIvaCompraItem } from "../../types/libro-iva.types";
import { formatCurrency } from "../../utils/libro-iva.utils";

interface Props {
  compras: LibroIvaCompraItem[];
  totalCount: number;
  search: string;
  onSearchChange: (val: string) => void;
}

export const LibroIvaComprasTable: FC<Props> = ({
  compras,
  totalCount,
  search,
  onSearchChange,
}) => {
  const totalNeto21 = compras.reduce(
    (acc, c) => acc + (c.isCreditNote ? -c.netoGravado21 : c.netoGravado21),
    0
  );
  const totalIva21 = compras.reduce(
    (acc, c) => acc + (c.isCreditNote ? -c.iva21 : c.iva21),
    0
  );
  const totalNoComputable = compras.reduce(
    (acc, c) => acc + (c.isCreditNote ? -c.noGravadoOExento : c.noGravadoOExento),
    0
  );
  const totalPagado = compras.reduce(
    (acc, c) => acc + (c.isCreditNote ? -c.total : c.total),
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
            placeholder="Buscar por proveedor, CUIT o nº de factura..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Mostrando {compras.length} de {totalCount} facturas de compras
        </span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <tr>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Nº Factura</th>
              <th className="px-3 py-2.5">Proveedor</th>
              <th className="px-3 py-2.5">CUIT</th>
              <th className="px-3 py-2.5 text-right">Neto (21%)</th>
              <th className="px-3 py-2.5 text-right text-purple-700 dark:text-purple-300">Crédito IVA (21%)</th>
              <th className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-400">Factura C / No Gravado</th>
              <th className="px-3 py-2.5 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {compras.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No se encontraron facturas de compras cargadas en este período.
                </td>
              </tr>
            ) : (
              compras.map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
                    c.isCreditNote ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{c.issueDate}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        c.isCreditNote
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                          : c.rawDocumentType === "FACTURA_A"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                            : c.rawDocumentType === "FACTURA_C"
                              ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                      }`}
                    >
                      {c.documentType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {c.documentNumber}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-medium" title={c.supplierName}>
                    {c.supplierName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {c.supplierCuit}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                    {c.isCreditNote ? `-${formatCurrency(c.netoGravado21)}` : formatCurrency(c.netoGravado21)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-purple-700 dark:text-purple-300">
                    {c.isCreditNote ? `+${formatCurrency(c.iva21)}*` : formatCurrency(c.iva21)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {c.noGravadoOExento > 0 ? formatCurrency(c.noGravadoOExento) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {c.isCreditNote ? `-${formatCurrency(c.total)}` : formatCurrency(c.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {compras.length > 0 ? (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-bold dark:border-slate-700 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px]">
                  Totales Libro Compras:
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatCurrency(totalNeto21)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-purple-700 dark:text-purple-300">
                  {formatCurrency(totalIva21)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                  {formatCurrency(totalNoComputable)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatCurrency(totalPagado)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        * Nota: Las Notas de Crédito de proveedores recibidas constituyen <em>Crédito Fiscal a Restituir</em> y se computan aumentando el débito fiscal en la declaración oficial de ARCA.
      </p>
    </div>
  );
};
