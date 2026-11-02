import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Eye,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Clock,
  User,
} from "lucide-react";
import type { CashDailyTrackingRow, CashDailyShiftSummary } from "@/modules/caja/hooks/useCashModule";
import type { CashSession } from "@/types/entities";
import { formatLocalDateDisplay } from "@/modules/caja/utils/cash-date.utils";

interface CashDailyTrackingTableProps {
  rows: CashDailyTrackingRow[];
  usersById?: Record<string, string>;
  onViewDetail?: (date: string, sessionId?: string) => void;
  onViewCloseDetail?: (date: string, session?: CashSession) => void;
}

const columnHelper = createColumnHelper<CashDailyTrackingRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashDailyTrackingTable = ({
  rows,
  usersById = {},
  onViewDetail,
}: CashDailyTrackingTableProps) => {
  // Estado de filas expandidas para ver los turnos individuales de cada jornada
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>(() => {
    // Expandir automáticamente si la primera jornada tiene múltiples turnos
    if (rows.length > 0 && rows[0].sessionsCount > 1) {
      return { [rows[0].date]: true };
    }
    return {};
  });

  const toggleExpand = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const columns = [
    columnHelper.accessor("date", {
      header: "Fecha y Turnos",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        const formattedDate = formatLocalDateDisplay(info.getValue());
        const hasMultipleShifts = row.shifts && row.shifts.length > 1;
        const isExpanded = Boolean(expandedDates[row.date]);

        return (
          <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span>{formattedDate}</span>
              {hasMultipleShifts && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(row.date);
                  }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                    isExpanded
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={isExpanded ? "Ocultar desglose de turnos" : "Ver desglose de turnos de la jornada"}
                >
                  <span>{row.shifts.length} turnos</span>
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
              )}
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
              {!hasMultipleShifts && (
                <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                  Turno único
                </span>
              )}
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

        return (
          <div className="flex items-center justify-end whitespace-nowrap">
            {onViewDetail && (
              <button
                type="button"
                className="h-7 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                onClick={() => onViewDetail(row.date)}
                title="Ver detalle completo de caja: arqueo y movimientos"
              >
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                <span>Detalle de caja</span>
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
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

  const renderShiftIcon = (period: CashDailyShiftSummary["period"]) => {
    switch (period) {
      case "morning":
        return <Sun size={13} className="text-amber-500 shrink-0" />;
      case "afternoon":
        return <Sunset size={13} className="text-orange-500 shrink-0" />;
      case "night":
        return <Moon size={13} className="text-indigo-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-white dark:bg-[#0b1325] rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/60 dark:bg-slate-900/40">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Historial de Jornadas
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {rows.length} {rows.length === 1 ? "jornada registrada" : "jornadas registradas"} · Tocá "Detalle de caja" para auditar arqueo y movimientos
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
            {table.getRowModel().rows.map((tableRow) => {
              const rowData = tableRow.original;
              const isExpanded = Boolean(expandedDates[rowData.date]);
              const shifts = rowData.shifts || [];

              return (
                <tr key={tableRow.id} className="group">
                  <td colSpan={columns.length} className="p-0">
                    {/* Fila Principal de la Jornada */}
                    <div className="flex items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {tableRow.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className={`py-2.5 px-3.5 ${
                            cell.column.id === "date"
                              ? "flex-1 min-w-[200px]"
                              : cell.column.id === "openingAmount" ||
                                cell.column.id === "incomes" ||
                                cell.column.id === "expenses" ||
                                cell.column.id === "realClosingAmount" ||
                                cell.column.id === "differenceAmount"
                              ? "w-28 text-right"
                              : cell.column.id === "movements"
                              ? "w-32"
                              : "w-40 text-right"
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>

                    {/* Desglose de Turnos Individuales (Expandible) */}
                    {isExpanded && shifts.length > 0 && (
                      <div className="bg-slate-50/70 dark:bg-slate-950/50 border-t border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pb-1">
                          <Clock size={12} className="text-blue-500" />
                          <span>Turnos registrados de la jornada ({shifts.length}):</span>
                        </div>

                        <div className="space-y-2">
                          {shifts.map((shift) => {
                            const isShiftOpen = shift.status === "open";
                            const openedBy = usersById[shift.openedByUserId] ?? shift.openedByUserId;
                            const closedBy = shift.closedByUserId
                              ? usersById[shift.closedByUserId] ?? shift.closedByUserId
                              : null;

                            return (
                              <div
                                key={shift.session.id}
                                className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700/70 transition"
                              >
                                {/* Info del Turno */}
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5">
                                    {renderShiftIcon(shift.period)}
                                  </div>

                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                        {shift.shiftLabel}
                                      </span>
                                      <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        ({shift.timeRange})
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                          isShiftOpen
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                        }`}
                                      >
                                        {isShiftOpen ? "En curso" : "Cerrado"}
                                      </span>
                                    </div>

                                    {/* Cajero / Operador */}
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                      <span className="flex items-center gap-1">
                                        <User size={12} className="text-slate-400" />
                                        <span>Abierto por: <strong className="text-slate-700 dark:text-slate-300">{openedBy}</strong></span>
                                      </span>
                                      {closedBy && (
                                        <span>
                                          · Cerrado por: <strong className="text-slate-700 dark:text-slate-300">{closedBy}</strong>
                                        </span>
                                      )}
                                      <span className="text-slate-400">
                                        · ID: <span className="font-mono">{shift.session.id.slice(-6)}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* KPIs del Turno */}
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                  <div className="text-right">
                                    <span className="text-[10px] block text-slate-400 font-medium">Apertura</span>
                                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                      {currency.format(shift.openingAmount)}
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[10px] block text-slate-400 font-medium">Ingresos</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                      +{currency.format(shift.incomes)}
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[10px] block text-slate-400 font-medium">Egresos</span>
                                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                      -{currency.format(shift.expenses)}
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[10px] block text-slate-400 font-medium">Cierre Real</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                      {shift.realClosingAmount != null
                                        ? currency.format(shift.realClosingAmount)
                                        : isShiftOpen
                                        ? "En curso"
                                        : "-"}
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[10px] block text-slate-400 font-medium">Diferencia</span>
                                    <span
                                      className={`font-mono font-semibold ${
                                        (shift.differenceAmount ?? 0) > 0
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : (shift.differenceAmount ?? 0) < 0
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {shift.differenceAmount != null
                                        ? shift.differenceAmount === 0
                                          ? "$0,00"
                                          : currency.format(shift.differenceAmount)
                                        : "-"}
                                    </span>
                                  </div>

                                  {/* Botón de acción del turno específico */}
                                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                                    {onViewDetail && (
                                      <button
                                        type="button"
                                        onClick={() => onViewDetail(rowData.date, shift.session.id)}
                                        className="h-7 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition shadow-2xs cursor-pointer"
                                        title={`Ver detalle completo del ${shift.shiftLabel}`}
                                      >
                                        <Eye size={12} className="text-blue-500" />
                                        <span>Detalle de turno</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra de Paginación (10 jornadas por página) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Mostrando{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {rows.length === 0 ? 0 : table.getState().pagination.pageIndex * 10 + 1}
            </strong>{" "}
            a{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {Math.min((table.getState().pagination.pageIndex + 1) * 10, rows.length)}
            </strong>{" "}
            de{" "}
            <strong className="text-slate-900 dark:text-slate-100">{rows.length}</strong> jornadas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Primera página"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <span className="px-2 font-medium">
            Página {table.getPageCount() === 0 ? 1 : table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Última página"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
};
