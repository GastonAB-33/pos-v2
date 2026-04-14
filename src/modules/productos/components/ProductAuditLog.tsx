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
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Historial de Modificaciones</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Últimos movimientos del módulo</span>
          <button
            type="button"
            className="ui-btn-ghost px-2 py-1 text-xs"
            onClick={onExportXlsx}
            disabled={exportDisabled || !entries.length}
          >
            Exportar historial XLSX
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">Cargando historial...</div>
      ) : entries.length === 0 ? (
        <div className="text-xs text-slate-500">Aún no hay eventos recientes para mostrar.</div>
      ) : (
        <div className="max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2 text-left">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2 text-slate-600">{formatDate(entry.date)}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.user}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.action}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
