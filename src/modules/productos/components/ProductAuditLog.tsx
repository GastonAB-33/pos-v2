import { ChevronDown, Download } from "lucide-react";
import type { ProductAuditEntry } from "@/modules/productos/types/product.types";

interface ProductAuditLogProps {
  loading: boolean;
  entries: ProductAuditEntry[];
  onExportXlsx: () => void;
  exportDisabled?: boolean;
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

export const ProductAuditLog = ({ loading, entries, onExportXlsx, exportDisabled }: ProductAuditLogProps) => {
  return (
    <details className="product-audit-disclosure w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Historial de modificaciones</span>
          <span className="block text-xs text-slate-500">{entries.length} movimientos registrados</span>
        </span>
        <ChevronDown aria-hidden="true" className="product-audit-disclosure__chevron h-4 w-4 shrink-0 text-slate-500" />
      </summary>

      <section className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2.5 flex items-center justify-end">
          <button
            type="button"
            className="ui-btn-ghost gap-1.5 px-3 py-1.5 text-xs font-medium"
            onClick={onExportXlsx}
            disabled={exportDisabled || !entries.length}
          >
            <Download aria-hidden="true" size={14} />
            <span>Exportar historial</span>
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-slate-500 py-2">Cargando historial...</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">Aún no hay eventos recientes para mostrar.</div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-56 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[28rem] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Usuario</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Acción</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">{entry.user}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{entry.action}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </details>
  );
};
