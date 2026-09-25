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
      header: "Fecha",
      cell: (info) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-800">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{new Date(`${info.getValue()}T00:00:00`).toLocaleDateString("es-AR")}</span>
        </div>
      ),
    }),
    columnHelper.accessor("sessionsCount", {
      header: "Estado",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-slate-100 text-slate-600 border-slate-200/60"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isOpen ? `${row.openSessionsCount} abierta` : "Cerrada"}
            </span>
            <span className="text-[11px] text-slate-400">
              ({info.getValue()} turno{info.getValue() > 1 ? "s" : ""})
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor("openingAmount", {
      header: () => <div className="text-right">Apertura</div>,
      cell: (info) => (
        <div className="text-right font-medium text-slate-700 whitespace-nowrap">
          {currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("incomes", {
      header: () => <div className="text-right">Ingresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-emerald-600 whitespace-nowrap">
          +{currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("expenses", {
      header: () => <div className="text-right">Egresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-rose-600 whitespace-nowrap">
          -{currency.format(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor("realClosingAmount", {
      header: () => <div className="text-right">Cierre Real</div>,
      cell: (info) => {
        const row = info.row.original;
        if (row.openSessionsCount && !info.getValue()) {
          return <div className="text-right text-[11px] text-amber-600 font-medium whitespace-nowrap">En curso</div>;
        }
        return (
          <div className="text-right font-bold text-slate-900 whitespace-nowrap">
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
          return <div className="text-right text-[11px] font-medium text-slate-500 whitespace-nowrap">$ 0,00</div>;
        }
        return (
          <div
            className={`text-right font-semibold whitespace-nowrap ${
              value > 0 ? "text-emerald-700" : "text-rose-700"
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
        return (
          <div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700 border border-blue-200/50">
              {row.saleMovementsCount} ventas
            </span>
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200/50">
              {row.manualMovementsCount} manual
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
              className="h-7 inline-flex items-center gap-1 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
              onClick={() => onViewDetail(row.date)}
            >
              <Eye className="h-3 w-3 text-slate-400" />
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
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200/80 shadow-xs">
        <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-700">No hay datos de jornadas de caja</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Las sesiones diarias registradas se listarán en este historial.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <header className="px-3.5 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">
            Historial de Jornadas de Caja Diaria
          </h3>
          <p className="text-[11px] text-slate-400">
            {rows.length} {rows.length === 1 ? "jornada registrada" : "jornadas registradas"}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-2.5 px-3">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-2.5 px-3">
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
