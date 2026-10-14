import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, Calendar } from "lucide-react";
import type { CashDailyTrackingRow } from "@/modules/caja/hooks/useCashModule";

interface CashDailyTrackingTableProps {
  rows: CashDailyTrackingRow[];
  onViewDetail?: (date: string) => void;
}

const columnHelper = createColumnHelper<CashDailyTrackingRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashDailyTrackingTable = ({ rows, onViewDetail }: CashDailyTrackingTableProps) => {
  const columns = [
    columnHelper.accessor("date", {
      header: "Fecha y Estado",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        const formattedDate = new Date(`${info.getValue()}T00:00:00`).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                  isOpen
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/80"
                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/80"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-500"
                  }`}
                />
                {isOpen ? "En curso" : "Cerrada"}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                {info.row.original.sessionsCount} {info.row.original.sessionsCount === 1 ? "turno" : "turnos"}
              </span>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("openingAmount", {
      header: () => <div className="text-right">Apertura</div>,
      cell: (info) => (
        <div className="text-right text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("incomes", {
      header: () => <div className="text-right">Ingresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          +{currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("expenses", {
      header: () => <div className="text-right">Egresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
          -{currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("realClosingAmount", {
      header: () => <div className="text-right">Cierre Real</div>,
      cell: (info) => {
        const row = info.row.original;
        if (row.openSessionsCount && !info.getValue()) {
          return (
            <div className="text-right text-[11px] text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
              En curso
            </div>
          );
        }
        return (
          <div className="text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {currency.format(info.getValue())}
          </div>
        );
      },
    }),
    columnHelper.accessor("differenceAmount", {
      header: () => <div className="text-right">Diferencia</div>,
      cell: (info) => {
        const value = info.getValue();
        if (value === 0) {
          return <div className="text-right text-slate-400 dark:text-slate-600 font-normal">-</div>;
        }
        return (
          <div
            className={`text-right font-semibold whitespace-nowrap ${
              value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {value > 0 ? `+${currency.format(value)}` : currency.format(value)}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "movements",
      header: "Movimientos",
      cell: (info) => {
        const row = info.row.original;
        const total = (row.saleMovementsCount ?? 0) + (row.manualMovementsCount ?? 0);
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
            <span className="font-semibold text-slate-900 dark:text-slate-200">{total}</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              ({row.saleMovementsCount}v · {row.manualMovementsCount}m)
            </span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "detail",
      header: () => <div className="text-right">Acción</div>,
      cell: (info) => {
        const row = info.row.original;
        if (!onViewDetail) return "-";
        return (
          <div className="text-right">
            <button
              type="button"
              className="h-7 inline-flex items-center gap-1 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              onClick={() => onViewDetail(row.date)}
            >
              <Eye className="h-3 w-3 text-slate-400 dark:text-slate-400" />
              Detalle
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">No hay datos de jornadas de caja</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Las sesiones diarias registradas se listarán en este historial.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0b1325] rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/60 dark:bg-slate-900/40">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Historial de Jornadas
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {rows.length} {rows.length === 1 ? "jornada registrada" : "jornadas registradas"}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-2.5 px-3.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-2.5 px-3.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
