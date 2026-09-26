import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, Calendar, Clock, User as UserIcon, Layers, CalendarRange } from "lucide-react";
import type { CashSession } from "@/types/entities";
import type {
  CashDailyTrackingRow,
  CashSessionComputedSummary,
} from "@/modules/caja/hooks/useCashModule";

export interface CashDailyTrackingTableProps {
  rows: CashDailyTrackingRow[];
  sessions?: CashSession[];
  sessionSummariesById?: Map<string, CashSessionComputedSummary>;
  usersById?: Record<string, string>;
  onViewDailyDetail?: (date: string) => void;
  onViewSessionDetail?: (sessionId: string) => void;
  onViewDetail?: (date: string) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

const dailyColumnHelper = createColumnHelper<CashDailyTrackingRow>();
const sessionColumnHelper = createColumnHelper<CashSession>();

export const CashDailyTrackingTable = ({
  rows,
  sessions = [],
  sessionSummariesById,
  usersById = {},
  onViewDailyDetail,
  onViewSessionDetail,
  onViewDetail,
}: CashDailyTrackingTableProps) => {
  const [activeTab, setActiveTab] = useState<"sessions" | "days">("sessions");

  const handleDailyDetail = onViewDailyDetail ?? onViewDetail;

  // Columnas para la vista agrupada por Jornada
  const dailyColumns = [
    dailyColumnHelper.accessor("date", {
      header: "Fecha",
      cell: (info) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{new Date(`${info.getValue()}T00:00:00`).toLocaleDateString("es-AR")}</span>
        </div>
      ),
    }),
    dailyColumnHelper.accessor("sessionsCount", {
      header: "Estado",
      cell: (info) => {
        const row = info.row.original;
        const isOpen = Boolean(row.openSessionsCount);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                  : "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-500"
                }`}
              />
              {isOpen ? `${row.openSessionsCount} abierta` : "Cerrada"}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400">
              ({info.getValue()} turno{info.getValue() > 1 ? "s" : ""})
            </span>
          </div>
        );
      },
    }),
    dailyColumnHelper.accessor("openingAmount", {
      header: () => <div className="text-right">Apertura</div>,
      cell: (info) => (
        <div className="text-right font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {currency.format(info.getValue())}
        </div>
      ),
    }),
    dailyColumnHelper.accessor("incomes", {
      header: () => <div className="text-right">Ingresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          +{currency.format(info.getValue())}
        </div>
      ),
    }),
    dailyColumnHelper.accessor("expenses", {
      header: () => <div className="text-right">Egresos</div>,
      cell: (info) => (
        <div className="text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
          -{currency.format(info.getValue())}
        </div>
      ),
    }),
    dailyColumnHelper.accessor("realClosingAmount", {
      header: () => <div className="text-right">Cierre Real</div>,
      cell: (info) => {
        const row = info.row.original;
        if (row.openSessionsCount && !info.getValue()) {
          return (
            <div className="text-right text-[11px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
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
    dailyColumnHelper.accessor("differenceAmount", {
      header: () => <div className="text-right">Diferencia</div>,
      cell: (info) => {
        const value = info.getValue();
        if (value === 0) {
          return (
            <div className="text-right text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              $ 0,00
            </div>
          );
        }
        return (
          <div
            className={`text-right font-semibold whitespace-nowrap ${
              value > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {value > 0 ? `+${currency.format(value)}` : currency.format(value)}
          </div>
        );
      },
    }),
    dailyColumnHelper.display({
      id: "movements",
      header: "Movimientos",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60">
              {row.saleMovementsCount} ventas
            </span>
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {row.manualMovementsCount} manual
            </span>
          </div>
        );
      },
    }),
    dailyColumnHelper.display({
      id: "detail",
      header: () => <div className="text-right">Acción</div>,
      cell: (info) => {
        const row = info.row.original;
        if (!handleDailyDetail) return "-";
        return (
          <div className="text-right">
            <button
              type="button"
              className="h-7 inline-flex items-center gap-1 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200"
              onClick={() => handleDailyDetail(row.date)}
            >
              <Eye className="h-3 w-3 text-slate-400 dark:text-slate-400" />
              Detalle
            </button>
          </div>
        );
      },
    }),
  ];

  // Columnas para la vista detallada por Turno / Sesión
  const sessionColumns = [
    sessionColumnHelper.accessor("opened_at", {
      header: "Apertura",
      cell: (info) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{formatDateTime(info.getValue())}</span>
        </div>
      ),
    }),
    sessionColumnHelper.accessor("closed_at", {
      header: "Cierre",
      cell: (info) => {
        const value = info.getValue();
        if (!value) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              En curso
            </span>
          );
        }
        return <span className="text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDateTime(value)}</span>;
      },
    }),
    sessionColumnHelper.accessor("opened_by_user_id", {
      header: "Responsable",
      cell: (info) => {
        const userId = info.getValue();
        const userName = usersById[userId] ?? userId;
        return (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 max-w-[140px] truncate" title={userName}>
            <UserIcon className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">{userName}</span>
          </div>
        );
      },
    }),
    sessionColumnHelper.accessor("status", {
      header: "Estado",
      cell: (info) => {
        const isOpen = info.getValue() === "open";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              isOpen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                : "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-500"
              }`}
            />
            {isOpen ? "Abierta" : "Cerrada"}
          </span>
        );
      },
    }),
    sessionColumnHelper.accessor("opening_amount", {
      header: () => <div className="text-right">Apertura</div>,
      cell: (info) => (
        <div className="text-right font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {currency.format(info.getValue())}
        </div>
      ),
    }),
    sessionColumnHelper.display({
      id: "incomes",
      header: () => <div className="text-right">Ingresos</div>,
      cell: (info) => {
        const session = info.row.original;
        const summary = sessionSummariesById?.get(session.id);
        const incomes = summary?.incomes ?? 0;
        return (
          <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            +{currency.format(incomes)}
          </div>
        );
      },
    }),
    sessionColumnHelper.display({
      id: "expenses",
      header: () => <div className="text-right">Egresos</div>,
      cell: (info) => {
        const session = info.row.original;
        const summary = sessionSummariesById?.get(session.id);
        const expenses = summary?.expenses ?? 0;
        return (
          <div className="text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
            -{currency.format(expenses)}
          </div>
        );
      },
    }),
    sessionColumnHelper.display({
      id: "realClosing",
      header: () => <div className="text-right">Cierre Real</div>,
      cell: (info) => {
        const session = info.row.original;
        if (session.status === "open") {
          const summary = sessionSummariesById?.get(session.id);
          const expected = summary?.expectedBalance ?? session.opening_amount;
          return (
            <div className="text-right text-[11px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap" title="Saldo actual en curso">
              {currency.format(expected)} (teórico)
            </div>
          );
        }
        return (
          <div className="text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {currency.format(session.closing_amount ?? 0)}
          </div>
        );
      },
    }),
    sessionColumnHelper.accessor("closing_difference", {
      header: () => <div className="text-right">Diferencia</div>,
      cell: (info) => {
        const session = info.row.original;
        if (session.status === "open") {
          return <div className="text-right text-slate-400 whitespace-nowrap">-</div>;
        }
        const diff = info.getValue() ?? 0;
        if (diff === 0) {
          return <div className="text-right text-[11px] text-slate-500 whitespace-nowrap">$ 0,00</div>;
        }
        return (
          <div
            className={`text-right font-semibold whitespace-nowrap ${
              diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {diff > 0 ? `+${currency.format(diff)}` : currency.format(diff)}
          </div>
        );
      },
    }),
    sessionColumnHelper.display({
      id: "movements",
      header: "Movimientos",
      cell: (info) => {
        const session = info.row.original;
        const summary = sessionSummariesById?.get(session.id);
        const salesCount = summary?.saleMovementsCount ?? 0;
        const manualCount = summary?.manualMovementsCount ?? 0;
        return (
          <div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60">
              {salesCount} ventas
            </span>
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {manualCount} manual
            </span>
          </div>
        );
      },
    }),
    sessionColumnHelper.display({
      id: "detail",
      header: () => <div className="text-right">Acción</div>,
      cell: (info) => {
        const session = info.row.original;
        if (!onViewSessionDetail) return "-";
        return (
          <div className="text-right">
            <button
              type="button"
              className="h-7 inline-flex items-center gap-1 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200"
              onClick={() => onViewSessionDetail(session.id)}
            >
              <Eye className="h-3 w-3 text-slate-400 dark:text-slate-400" />
              Detalle
            </button>
          </div>
        );
      },
    }),
  ];

  const dailyTable = useReactTable({
    data: rows,
    columns: dailyColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const sessionTable = useReactTable({
    data: sessions,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasData = activeTab === "sessions" ? sessions.length > 0 : rows.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <header className="px-3.5 py-2.5 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/60">
        <div>
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {activeTab === "sessions" ? "Historial de Turnos de Caja" : "Resumen Consolidado por Jornada"}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">
            {activeTab === "sessions"
              ? `${sessions.length} ${sessions.length === 1 ? "turno registrado" : "turnos registrados"}`
              : `${rows.length} ${rows.length === 1 ? "jornada registrada" : "jornadas registradas"}`}
          </p>
        </div>

        {/* Selector de Pestañas: Turnos vs Jornada */}
        <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "sessions"
                ? "bg-white text-slate-900 shadow-2xs font-semibold dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-3 w-3" />
            Turnos de caja ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("days")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "days"
                ? "bg-white text-slate-900 shadow-2xs font-semibold dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <CalendarRange className="h-3 w-3" />
            Por jornada ({rows.length})
          </button>
        </div>
      </header>

      {!hasData ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900">
          <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {activeTab === "sessions" ? "No hay turnos de caja registrados" : "No hay jornadas registradas"}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
            Las sesiones de caja se irán registrando en este historial a medida que se abran y cierren turnos.
          </p>
        </div>
      ) : activeTab === "sessions" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-800">
              {sessionTable.getHeaderGroups().map((headerGroup) => (
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
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800">
              {sessionTable.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-800">
              {dailyTable.getHeaderGroups().map((headerGroup) => (
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
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800">
              {dailyTable.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
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
      )}
    </div>
  );
};
