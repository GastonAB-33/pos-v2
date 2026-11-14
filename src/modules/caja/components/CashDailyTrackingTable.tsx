import { useState, Fragment } from "react";
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

/**
 * Alineación uniforme para encabezados (th) y celdas (td)
 */
const getColumnAlignment = (colId: string): string => {
  if (
    colId === "openingAmount" ||
    colId === "incomes" ||
    colId === "expenses" ||
    colId === "closingAndDiff" ||
    colId === "detail"
  ) {
    return "text-right";
  }
  return "text-left";
};

/**
 * Anchos proporcionales optimizados para 6 columnas consolidadas.
 * Permite que la tabla entre cómodamente en pantallas estándar (~720px) sin cortarse.
 */
const getColumnWidthClass = (colId: string): string => {
  switch (colId) {
    case "date":
      return "w-[28%] min-w-[190px]";
    case "openingAmount":
      return "w-[13%] min-w-[95px]";
    case "incomes":
      return "w-[14%] min-w-[105px]";
    case "expenses":
      return "w-[14%] min-w-[105px]";
    case "closingAndDiff":
      return "w-[17%] min-w-[115px]";
    case "detail":
      return "w-[14%] min-w-[100px]";
    default:
      return "";
  }
};

export const CashDailyTrackingTable = ({
  rows,
  usersById = {},
  onViewDetail,
}: CashDailyTrackingTableProps) => {
  // Todas las jornadas inician colapsadas/cerradas por defecto ({})
  // El usuario decide cuál desplegar haciendo clic en la píldora o fila
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleExpand = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const columns = [
    // 1. FECHA Y TURNOS (absorbe movimientos totales de la jornada)
    columnHelper.accessor("date", {
      header: "Fecha y Turnos",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        const formattedDate = formatLocalDateDisplay(info.getValue());
        const shifts = row.shifts || [];
        const hasShifts = shifts.length > 0;
        const isExpanded = Boolean(expandedDates[row.date]);
        const totalMovements = (row.saleMovementsCount ?? 0) + (row.manualMovementsCount ?? 0);

        return (
          <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              <Calendar className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>{formattedDate}</span>
              {hasShifts ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(row.date);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer select-none ${
                    isExpanded
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs hover:bg-blue-700"
                      : "bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={isExpanded ? "Ocultar desglose de turnos" : "Desplegar turnos de la jornada"}
                >
                  <span>{shifts.length} {shifts.length === 1 ? "turno" : "turnos"}</span>
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                  Sin turnos
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] whitespace-nowrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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

              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                · {totalMovements} mov. ({row.saleMovementsCount}v · {row.manualMovementsCount}m)
              </span>
            </div>
          </div>
        );
      },
    }),

    // 2. APERTURA
    columnHelper.accessor("openingAmount", {
      header: "Apertura",
      cell: (info) => (
        <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {currency.format(info.getValue())}
        </div>
      ),
    }),

    // 3. INGRESOS
    columnHelper.accessor("incomes", {
      header: "Ingresos",
      cell: (info) => (
        <div className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          +{currency.format(info.getValue())}
        </div>
      ),
    }),

    // 4. EGRESOS
    columnHelper.accessor("expenses", {
      header: "Egresos",
      cell: (info) => (
        <div className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
          -{currency.format(info.getValue())}
        </div>
      ),
    }),

    // 5. CIERRE Y ARQUEO (Unificada: Cierre Real arriba + Diferencia abajo)
    columnHelper.display({
      id: "closingAndDiff",
      header: "Cierre y Arqueo",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        const diff = row.differenceAmount ?? 0;

        return (
          <div className="flex flex-col items-end gap-0.5 whitespace-nowrap py-0.5">
            {isOpen && !row.realClosingAmount ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                En curso
              </span>
            ) : (
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                {currency.format(row.realClosingAmount)}
              </span>
            )}

            {diff === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium">
                $0,00
              </span>
            ) : diff > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 font-mono">
                +{currency.format(diff)}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800 font-mono">
                {currency.format(diff)}
              </span>
            )}
          </div>
        );
      },
    }),

    // 6. ACCIÓN
    columnHelper.display({
      id: "detail",
      header: "Acción",
      cell: (info) => {
        const row = info.row.original;

        return (
          <div className="flex items-center justify-end whitespace-nowrap">
            {onViewDetail && (
              <button
                type="button"
                className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetail(row.date);
                }}
                title="Ver detalle completo de caja: arqueo y movimientos"
              >
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                <span>Detalle</span>
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
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs w-full">
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
    <div className="space-y-3 w-full min-w-0 max-w-full">
      {/* 1. MÓVIL (< md): TÍTULO FLOTANTE + TARJETAS INDIVIDUALES POR CADA DÍA */}
      <div className="md:hidden flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Historial de Jornadas
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {rows.length} {rows.length === 1 ? "jornada registrada" : "jornadas registradas"} · Tocá una jornada para ver turnos o auditar arqueo
          </p>
        </div>
      </div>

      <div className="md:hidden space-y-3.5">
        {table.getRowModel().rows.map((tableRow) => {
          const rowData = tableRow.original;
          const isExpanded = Boolean(expandedDates[rowData.date]);
          const shifts = rowData.shifts || [];
          const hasShifts = shifts.length > 0;
          const isOpen = Boolean(rowData.openSessionsCount);
          const diff = rowData.differenceAmount ?? 0;
          const totalMovements = (rowData.saleMovementsCount ?? 0) + (rowData.manualMovementsCount ?? 0);

          return (
            <article
              key={rowData.date}
              className={`rounded-2xl sm:rounded-3xl border bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-3 shadow-xs transition-all w-full min-w-0 max-w-full box-border overflow-hidden ${
                isOpen
                  ? "border-emerald-300 dark:border-emerald-800/80 ring-1 ring-emerald-500/10"
                  : isExpanded
                  ? "border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/10"
                  : "border-slate-200/90 dark:border-slate-800"
              }`}
            >
              {/* Cabecera del día: Fecha + Estado + Píldora de turnos */}
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                    {formatLocalDateDisplay(rowData.date)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
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
                </div>

                {hasShifts && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(rowData.date)}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer select-none shrink-0 ${
                      isExpanded
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                    title={isExpanded ? "Ocultar turnos" : "Ver turnos de la jornada"}
                  >
                    <span>{shifts.length} {shifts.length === 1 ? "turno" : "turnos"}</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {totalMovements} movimientos ({rowData.saleMovementsCount} ventas · {rowData.manualMovementsCount} manuales)
              </div>

              {/* Cuadrícula 2x2 de Métricas Clave */}
              <div className="grid grid-cols-2 gap-2 text-xs min-w-0 w-full box-border">
                <div className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 min-w-0 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Apertura</span>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                    {currency.format(rowData.openingAmount)}
                  </span>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 min-w-0 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Cierre Real</span>
                  {isOpen && !rowData.realClosingAmount ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      En curso
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                      {currency.format(rowData.realClosingAmount)}
                    </span>
                  )}
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 min-w-0 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Ingresos</span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                    +{currency.format(rowData.incomes)}
                  </span>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 min-w-0 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Egresos</span>
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 block truncate">
                    -{currency.format(rowData.expenses)}
                  </span>
                </div>
              </div>

              {/* Diferencia de arqueo */}
              {(!isOpen || rowData.realClosingAmount) && (
                <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs min-w-0 w-full overflow-hidden box-border">
                  <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] shrink-0">Diferencia arqueo:</span>
                  <div className="font-mono text-xs font-bold truncate">
                    {diff === 0 ? (
                      <span className="text-slate-500 dark:text-slate-400">$0,00 (Exacta)</span>
                    ) : diff > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">+{currency.format(diff)} (Sobrante)</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">{currency.format(diff)} (Faltante)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Botón Ver Detalle de Caja */}
              <div className="pt-0.5">
                {onViewDetail && (
                  <button
                    type="button"
                    onClick={() => onViewDetail(rowData.date)}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 rounded-xl transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">Ver Detalle de Caja</span>
                  </button>
                )}
              </div>

              {/* Desglose de turnos si está expandido */}
              {isExpanded && shifts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Turnos registrados ({shifts.length}):</span>
                  </div>
                  {shifts.map((shift) => {
                    const isShiftOpen = shift.status === "open";
                    const openedBy = usersById[shift.openedByUserId] ?? shift.openedByUserId;
                    return (
                      <div
                        key={shift.session.id}
                        className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            {renderShiftIcon(shift.period)}
                            <span>{shift.shiftLabel}</span>
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                              ({shift.timeRange})
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isShiftOpen
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/80"
                                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                            }`}
                          >
                            {isShiftOpen ? "En curso" : "Cerrado"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Por: <strong className="text-slate-700 dark:text-slate-200">{openedBy}</strong>
                          <span> · #{shift.session.id.slice(-6)} · {shift.movementsCount} mov.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] pt-1">
                          <div>
                            <span className="text-slate-400 font-sans block text-[10px]">Apertura:</span>
                            <span className="font-bold">{currency.format(shift.openingAmount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans block text-[10px]">Cierre:</span>
                            <span className="font-bold">
                              {isShiftOpen
                                ? "En curso"
                                : shift.realClosingAmount != null
                                ? currency.format(shift.realClosingAmount)
                                : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans block text-[10px]">Ingresos:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{currency.format(shift.incomes)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans block text-[10px]">Egresos:</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">-{currency.format(shift.expenses)}</span>
                          </div>
                        </div>
                        {onViewDetail && (
                          <button
                            type="button"
                            onClick={() => onViewDetail(rowData.date, shift.session.id)}
                            className="w-full mt-1 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye size={12} className="text-blue-500" />
                            <span>Auditar este turno</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* 2. DESKTOP (>= md): TABLA UNIFICADA EMPRESARIAL */}
      <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden w-full min-w-0">
        <header className="px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 bg-slate-50/90 dark:bg-slate-800/70">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Historial de Jornadas
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {rows.length} {rows.length === 1 ? "jornada registrada" : "jornadas registradas"} · Hacé clic en los turnos para desplegarlos o en "Detalle" para auditar
            </p>
          </div>
        </header>

        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    return (
                      <th
                        key={header.id}
                        className={`py-3 px-3.5 font-bold ${getColumnAlignment(colId)} ${getColumnWidthClass(colId)}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {table.getRowModel().rows.map((tableRow) => {
                const rowData = tableRow.original;
                const isExpanded = Boolean(expandedDates[rowData.date]);
                const shifts = rowData.shifts || [];

                return (
                  <Fragment key={tableRow.id}>
                    {/* Fila Principal de la Jornada (Alineada 100% con los th del encabezado) */}
                    <tr
                      onClick={() => {
                        if (shifts.length > 0) {
                          toggleExpand(rowData.date);
                        }
                      }}
                      className={`transition-colors cursor-pointer select-none ${
                        isExpanded
                          ? "bg-blue-50/25 dark:bg-blue-950/15 hover:bg-blue-50/40 dark:hover:bg-blue-950/25 border-l-2 border-l-blue-600"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-l-2 border-l-transparent"
                      }`}
                    >
                      {tableRow.getVisibleCells().map((cell) => {
                        const colId = cell.column.id;
                        return (
                          <td
                            key={cell.id}
                            className={`py-3 px-3.5 align-middle text-slate-700 dark:text-slate-200 ${getColumnAlignment(colId)} ${getColumnWidthClass(colId)}`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Desglose de Turnos Individuales: Filas nativas alineadas 1:1 en las mismas 6 columnas */}
                    {isExpanded && shifts.length > 0 && (
                      <>
                        {/* Subcabecera indicativa de turnos */}
                        <tr
                          key={`${tableRow.id}-shifts-header`}
                          className="bg-blue-50/50 dark:bg-blue-950/30 border-y border-blue-200/60 dark:border-blue-900/40"
                        >
                          <td
                            colSpan={columns.length}
                            className="py-1.5 px-4 text-[11px] font-bold text-blue-700 dark:text-blue-300"
                          >
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span>Turnos registrados de la jornada ({shifts.length}):</span>
                            </div>
                          </td>
                        </tr>

                        {/* Filas de cada Turno Individual */}
                        {shifts.map((shift) => {
                          const isShiftOpen = shift.status === "open";
                          const openedBy = usersById[shift.openedByUserId] ?? shift.openedByUserId;
                          const closedBy = shift.closedByUserId
                            ? usersById[shift.closedByUserId] ?? shift.closedByUserId
                            : null;
                          const shiftDiff = shift.differenceAmount ?? 0;

                          return (
                            <tr
                              key={shift.session.id}
                              className="bg-slate-50/60 dark:bg-slate-800/25 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border-l-2 border-l-blue-400 dark:border-l-blue-500 transition-colors"
                            >
                              {/* Columna 1: Fecha y Turnos -> Info del Turno con sangría jerárquica */}
                              <td className={`py-2.5 px-3.5 align-middle text-left ${getColumnWidthClass("date")}`}>
                                <div className="flex items-start gap-2 pl-3 sm:pl-5">
                                  <span className="text-slate-300 dark:text-slate-600 font-mono text-sm leading-none mt-1 select-none">
                                    ↳
                                  </span>
                                  <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                                    {renderShiftIcon(shift.period)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                        {shift.shiftLabel}
                                      </span>
                                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                        ({shift.timeRange})
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                          isShiftOpen
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                        }`}
                                      >
                                        {isShiftOpen ? "En curso" : "Cerrado"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                      <span>Por: <strong className="text-slate-600 dark:text-slate-300 font-medium">{openedBy}</strong></span>
                                      {closedBy && (
                                        <span> · Cierre: <strong className="text-slate-600 dark:text-slate-300 font-medium">{closedBy}</strong></span>
                                      )}
                                      <span> · #{shift.session.id.slice(-6)} · {shift.movementsCount} mov.</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Columna 2: Apertura */}
                              <td className={`py-2.5 px-3.5 align-middle text-right ${getColumnWidthClass("openingAmount")}`}>
                                <div className="font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {currency.format(shift.openingAmount)}
                                </div>
                              </td>

                              {/* Columna 3: Ingresos */}
                              <td className={`py-2.5 px-3.5 align-middle text-right ${getColumnWidthClass("incomes")}`}>
                                <div className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  +{currency.format(shift.incomes)}
                                </div>
                              </td>

                              {/* Columna 4: Egresos */}
                              <td className={`py-2.5 px-3.5 align-middle text-right ${getColumnWidthClass("expenses")}`}>
                                <div className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                  -{currency.format(shift.expenses)}
                                </div>
                              </td>

                              {/* Columna 5: Cierre y Arqueo (Turno) */}
                              <td className={`py-2.5 px-3.5 align-middle text-right ${getColumnWidthClass("closingAndDiff")}`}>
                                <div className="flex flex-col items-end gap-0.5 whitespace-nowrap py-0.5">
                                  {isShiftOpen ? (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      En curso
                                    </span>
                                  ) : shift.realClosingAmount != null ? (
                                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {currency.format(shift.realClosingAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs font-mono">-</span>
                                  )}

                                  {shift.differenceAmount != null ? (
                                    shiftDiff === 0 ? (
                                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium">
                                        $0,00
                                      </span>
                                    ) : shiftDiff > 0 ? (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 font-mono">
                                        +{currency.format(shiftDiff)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800 font-mono">
                                        {currency.format(shiftDiff)}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Columna 6: Acción (Detalle de turno) */}
                              <td className={`py-2.5 px-3.5 align-middle text-right ${getColumnWidthClass("detail")}`}>
                                <div className="flex items-center justify-end whitespace-nowrap">
                                  {onViewDetail && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewDetail(rowData.date, shift.session.id);
                                      }}
                                      className="h-7 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
                                      title={`Ver detalle completo del ${shift.shiftLabel}`}
                                    >
                                      <Eye className="h-3 w-3 text-blue-500" />
                                      <span>Detalle</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra de Paginación Redondeada (10 jornadas por página) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 w-full min-w-0">
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
            className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            title="Primera página"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
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
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            title="Última página"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
};
