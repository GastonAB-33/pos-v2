import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  Vault,
  Building,
  Truck,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FilterX,
  Calendar,
} from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { GeneralCashMovementModal } from "../components/GeneralCashMovementModal";
import { cn } from "@/utils/cn";
import {
  generalCashService,
  type GeneralCashSummary,
} from "@/services/general-cash.service";
import type { GeneralCashMovement } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const formatMoney = (amount: number | null | undefined): string => {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return currency.format(num);
};

const formatDate = (dateStr: string | null | undefined): string => {
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

const originLabels: Record<string, { label: string; icon: typeof Vault }> = {
  daily_cash_close: { label: "Cierre de Caja diaria", icon: ArrowDownLeft },
  daily_cash_open: { label: "Fondo apertura Caja diaria", icon: ArrowUpRight },
  bank_deposit: { label: "Depósito bancario", icon: Building },
  supplier_payment: { label: "Pago a proveedor", icon: Truck },
  manual_income: { label: "Ingreso manual", icon: Plus },
  manual_expense: { label: "Retiro / Gasto", icon: ArrowUpRight },
};

export const CajaGeneralPage = () => {
  const { tenantId } = useTenant();
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();

  const canReadModule = canRead("caja_general");
  const canWriteModule = canWrite("caja_general");

  const [movements, setMovements] = useState<GeneralCashMovement[]>([]);
  const [summary, setSummary] = useState<GeneralCashSummary>({
    currentBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    inflowFromDailyCash: 0,
    outflowToDailyCash: 0,
    totalMovements: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  const activeFiltersCount = (typeFilter !== "all" ? 1 : 0) + (originFilter !== "all" ? 1 : 0);

  // Pagination
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 15;

  // Modales
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementModalMode, setMovementModalMode] = useState<"income" | "expense">("income");

  const loadData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [allMovements, cashSummary] = await Promise.all([
        generalCashService.getAllByTenant(tenantId),
        generalCashService.getBalanceSummary(tenantId),
      ]);
      setMovements(
        [...allMovements].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      );
      setSummary(cashSummary);
    } catch (err) {
      console.error("Error al cargar movimientos de Caja General:", err);
      toast.error("No se pudieron cargar los movimientos de Caja General");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [tenantId]);

  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (typeFilter !== "all" && mov.type !== typeFilter) return false;
      if (originFilter !== "all" && mov.origin_type !== originFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesConcept = mov.concept.toLowerCase().includes(query);
        const matchesNotes = mov.notes?.toLowerCase().includes(query) ?? false;
        const matchesOrigin =
          originLabels[mov.origin_type]?.label.toLowerCase().includes(query) ?? false;
        if (!matchesConcept && !matchesNotes && !matchesOrigin) return false;
      }
      return true;
    });
  }, [movements, typeFilter, originFilter, search]);

  // Reset page when filter changes
  useEffect(() => {
    setPageIndex(0);
  }, [search, typeFilter, originFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const paginatedMovements = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, pageIndex, pageSize]);

  if (!tenantId) {
    return <section className="ui-panel">No hay un comercio activo.</section>;
  }

  if (!canReadModule) {
    return (
      <section className="ui-panel">No tenés permisos de lectura para este módulo.</section>
    );
  }

  return (
    <div className="ui-page operational-page caja-general-page flex flex-col space-y-4 w-full min-w-0 max-w-full overflow-x-hidden box-border pb-24 md:pb-6">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="w-full max-w-full min-w-0 box-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          {/* Breadcrumbs en mayúsculas con jerarquía */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">CONTABLE</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">CAJA GENERAL</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Caja General
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Caja fuerte central: control de efectivo resguardado, transferencias y fondos operativos.
          </p>
        </div>

        {/* Fila de Botones Píldora Adaptativos para Móvil y Desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto min-w-0 max-w-full box-border py-0.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="w-full sm:w-auto min-w-0 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer overflow-hidden"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
            <span className="truncate">Actualizar</span>
          </button>

          {canWriteModule && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMovementModalMode("expense");
                  setIsMovementModalOpen(true);
                }}
                className="w-full sm:w-auto min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 dark:border-rose-700/80 dark:bg-slate-900 dark:hover:bg-rose-950/40 dark:text-rose-300 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer overflow-hidden"
              >
                <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Retiro / Egreso</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMovementModalMode("income");
                  setIsMovementModalOpen(true);
                }}
                className="col-span-2 sm:col-span-1 w-full sm:w-auto min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-emerald-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer overflow-hidden"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">Registrar Ingreso</span>
              </button>
            </>
          )}
        </div>
      </header>

      <div className="caja-general-workspace space-y-4">
        {/* KPI Cards Redondeadas con Tamaño de Fuente Ajustado y Sin Desborde */}
        <div className="w-full max-w-full min-w-0 box-border grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors w-full max-w-full min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                Saldo en Caja Fuerte
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 shrink-0">
                <Vault className="h-4 w-4" />
              </div>
            </div>
            <p
              className="mt-2 text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate"
              title={formatMoney(summary.currentBalance)}
            >
              {formatMoney(summary.currentBalance)}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
              Efectivo real resguardado
            </p>
          </article>

          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors w-full max-w-full min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                Ingresos por Cierres
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shrink-0">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p
              className="mt-2 text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate"
              title={formatMoney(summary.inflowFromDailyCash)}
            >
              {formatMoney(summary.inflowFromDailyCash)}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
              Recaudación de cajas diarias
            </p>
          </article>

          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors w-full max-w-full min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                Fondos de Apertura
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 shrink-0">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p
              className="mt-2 text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate"
              title={formatMoney(summary.outflowToDailyCash)}
            >
              {formatMoney(summary.outflowToDailyCash)}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
              Entregado a cajas diarias
            </p>
          </article>

          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors w-full max-w-full min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                Total Movimientos
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
              {summary.totalMovements}
            </p>
            <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
              +{formatMoney(summary.totalIncome)} / -{formatMoney(summary.totalExpense)}
            </p>
          </article>
        </div>

        {/* Barra Unificada de Búsqueda y Filtros Redondeada 2xl/3xl */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-full min-w-0 max-w-full box-border">
          <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-2.5">
            {/* Buscador */}
            <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-300 bg-slate-50/80 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:focus-within:bg-slate-900 transition-all">
              <Search className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por concepto o notas..."
                className="w-full border-0 bg-transparent px-1 py-0.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Desktop Filters: Dropdowns inline (>= md) */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
                className="w-auto cursor-pointer rounded-xl sm:rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="all">Todos los tipos</option>
                <option value="income">Solo Ingresos (+)</option>
                <option value="expense">Solo Egresos (-)</option>
              </select>

              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="w-auto cursor-pointer rounded-xl sm:rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="all">Todos los orígenes</option>
                <option value="daily_cash_close">Cierres de Caja diaria</option>
                <option value="daily_cash_open">Fondos apertura Caja diaria</option>
                <option value="bank_deposit">Depósitos bancarios</option>
                <option value="supplier_payment">Pagos a proveedores</option>
                <option value="manual_income">Ingresos manuales</option>
                <option value="manual_expense">Retiros / Gastos</option>
              </select>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setOriginFilter("all");
                  }}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                  title="Restablecer filtros"
                >
                  <FilterX size={15} />
                </button>
              )}
            </div>

            {/* Mobile Filters: Botón de Filtros Avanzados (< md) */}
            <div className="flex md:hidden items-center gap-2 shrink-0 w-full pt-0.5">
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer",
                  activeFiltersCount > 0 &&
                    "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold"
                )}
              >
                <SlidersHorizontal size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Filtros avanzados</span>
                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {(search || activeFiltersCount > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setOriginFilter("all");
                  }}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                  title="Limpiar filtros"
                >
                  <FilterX size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TABLA Y TARJETAS DE MOVIMIENTOS DE CAJA FUERTE                 */}
        {/* ============================================================== */}
        {isLoading ? (
          <LoadingState
            message="Cargando movimientos de Caja General..."
            description="Sincronizando saldos de caja fuerte, transferencias y retiros..."
          />
        ) : filteredMovements.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-8 sm:p-12 text-center w-full min-w-0 max-w-full">
            <Vault className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No se encontraron movimientos
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Los cierres de caja diaria, depósitos y transferencias aparecerán aquí.
            </p>
            {(search || activeFiltersCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setOriginFilter("all");
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <FilterX size={13} />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 w-full min-w-0 max-w-full">
            {/* 1. VISTA DESKTOP (>= md): TABLA EMPRESARIAL */}
            <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden w-full min-w-0">
              <header className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/90 dark:bg-slate-800/70">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Historial de Movimientos de Caja Fuerte
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {filteredMovements.length} {filteredMovements.length === 1 ? "movimiento registrado" : "movimientos registrados"}
                  </p>
                </div>
              </header>

              <div className="overflow-x-auto w-full min-w-0">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-200/90 dark:border-slate-800">
                    <tr>
                      <th className="py-3 pl-4 sm:pl-5 pr-3 whitespace-nowrap">Fecha / Hora</th>
                      <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                      <th className="py-3 px-3 whitespace-nowrap">Origen / Motivo</th>
                      <th className="py-3 px-3 min-w-[200px]">Concepto / Notas</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Monto</th>
                      <th className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">Saldo en Caja Fuerte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60">
                    {paginatedMovements.map((mov) => {
                      const isIncome = mov.type === "income";
                      const originInfo = originLabels[mov.origin_type] || {
                        label: mov.origin_type,
                        icon: Vault,
                      };
                      const IconComponent = originInfo.icon;

                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 pl-4 sm:pl-5 pr-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                            {formatDate(mov.created_at)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                isIncome
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              )}
                              {isIncome ? "Ingreso (+)" : "Egreso (-)"}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-semibold">
                              <IconComponent className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                              {originInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 min-w-[200px] max-w-md">
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                              {mov.concept}
                            </p>
                            {mov.notes && (
                              <p className="text-[11px] sm:text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                {mov.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-xs sm:text-sm">
                            <span
                              className={
                                isIncome
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {isIncome ? `+ ${formatMoney(mov.amount)}` : `- ${formatMoney(mov.amount)}`}
                            </span>
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                            {formatMoney(mov.balance_after)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. VISTA MÓVIL (< md): TARJETAS INDIVIDUALES CON MICRO-JERARQUÍA */}
            <div className="block md:hidden space-y-3 w-full min-w-0 max-w-full">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Historial de Movimientos
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {filteredMovements.length} {filteredMovements.length === 1 ? "movimiento registrado" : "movimientos registrados"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {paginatedMovements.map((mov) => {
                  const isIncome = mov.type === "income";
                  const originInfo = originLabels[mov.origin_type] || {
                    label: mov.origin_type,
                    icon: Vault,
                  };
                  const IconComponent = originInfo.icon;

                  return (
                    <article
                      key={mov.id}
                      className="w-full max-w-full min-w-0 box-border rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5 transition-all overflow-hidden"
                    >
                      {/* Zona 1: Badges superiores (Origen con icono + Badge de Tipo) */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          <IconComponent className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{originInfo.label}</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                            isIncome
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          <span>{isIncome ? "Ingreso (+)" : "Egreso (-)"}</span>
                        </span>
                      </div>

                      {/* Zona 2: Concepto & Notas & Fecha */}
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                          {mov.concept}
                        </h4>
                        {mov.notes && (
                          <p className="text-xs font-normal text-slate-500 dark:text-slate-400 line-clamp-2">
                            {mov.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-0.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatDate(mov.created_at)}</span>
                        </div>
                      </div>

                      {/* Zona 3: Sub-panel de Métricas Clave (Importe & Saldo Posterior) */}
                      <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:divide-slate-700/60 min-w-0">
                        <div className="px-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block truncate">
                            Importe
                          </span>
                          <span
                            className={`font-mono text-xs sm:text-sm font-black block truncate mt-0.5 ${
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isIncome ? `+ ${formatMoney(mov.amount)}` : `- ${formatMoney(mov.amount)}`}
                          </span>
                        </div>

                        <div className="px-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block truncate">
                            Saldo Caja Fuerte
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 block truncate mt-0.5">
                            {formatMoney(mov.balance_after)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Barra de Paginación Redondeada (15 movimientos por página) */}
        {filteredMovements.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 w-full min-w-0 max-w-full box-border">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {pageIndex * pageSize + 1}
                </strong>{" "}
                a{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {Math.min((pageIndex + 1) * pageSize, filteredMovements.length)}
                </strong>{" "}
                de{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {filteredMovements.length}
                </strong> movimientos
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPageIndex(0)}
                disabled={pageIndex === 0}
                className="hidden sm:inline-flex rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Primera página"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={pageIndex === 0}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="px-2 font-medium">
                Página {pageIndex + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={pageIndex >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPageIndex(totalPages - 1)}
                disabled={pageIndex >= totalPages - 1}
                className="hidden sm:inline-flex rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Última página"
              >
                »
              </button>
            </div>
          </div>
        )}

        {/* Modal Inteligente de Movimientos (Ingreso / Egreso) */}
        <GeneralCashMovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          defaultMode={movementModalMode}
          currentBalance={summary.currentBalance}
          onSuccess={loadData}
          canWrite={canWriteModule}
        />

        {/* Modal de Filtros Avanzados para Móvil */}
        {isAdvancedFiltersOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
              <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Filtros de Movimientos
                  </h3>
                </div>
                <ModalCloseButton onClick={() => setIsAdvancedFiltersOpen(false)} />
              </header>

              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Tipo de movimiento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                    Tipo de Movimiento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "Todos" },
                      { id: "income", label: "Ingresos (+)" },
                      { id: "expense", label: "Egresos (-)" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTypeFilter(option.id as "all" | "income" | "expense")}
                        className={cn(
                          "py-2 px-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer",
                          typeFilter === option.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Origen / Motivo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Origen / Motivo
                  </label>
                  <select
                    value={originFilter}
                    onChange={(e) => setOriginFilter(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">Todos los orígenes</option>
                    <option value="daily_cash_close">Cierres de Caja diaria</option>
                    <option value="daily_cash_open">Fondos apertura Caja diaria</option>
                    <option value="bank_deposit">Depósitos bancarios</option>
                    <option value="supplier_payment">Pagos a proveedores</option>
                    <option value="manual_income">Ingresos manuales</option>
                    <option value="manual_expense">Retiros / Gastos</option>
                  </select>
                </div>
              </div>

              <footer className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setOriginFilter("all");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvancedFiltersOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Aplicar filtros
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
