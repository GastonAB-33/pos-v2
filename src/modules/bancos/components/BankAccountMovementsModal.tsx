import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Minus,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  bankAccountMovementsService,
  type BankAccountBalanceSummary,
} from "@/services/bank-account-movements.service";
import type {
  BankAccount,
  BankAccountMovement,
  BankAccountMovementOriginType,
} from "@/types/entities";
import { cn } from "@/utils/cn";

interface BankAccountMovementsModalProps {
  account: BankAccount | null;
  onClose: () => void;
  canWrite: boolean;
  onBalanceUpdated?: () => void;
}

const COMMON_EXPENSE_CONCEPTS = [
  "Pago de Luz / Electricidad",
  "Pago de Internet / Teléfono",
  "Pago de Gas",
  "Pago de Alquiler",
  "Pago de Impuestos / Tasas / Monotributo",
  "Pago a Proveedor",
  "Mantenimiento / Comisiones Bancarias",
  "Sueldos / Anticipos de Personal",
  "Retiro de Fondos / Dueño",
  "Otro Gasto",
];

const COMMON_INCOME_CONCEPTS = [
  "Aporte de Capital / Dueño",
  "Depósito en Efectivo",
  "Devolución / Reintegro",
  "Cobro de Venta / Mostrador",
  "Transferencia de Tercero",
  "Otro Ingreso",
];

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const formatCurrency = (val: number) => currencyFormatter.format(val);

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const getOriginLabel = (origin: BankAccountMovementOriginType): string => {
  switch (origin) {
    case "pos_sale":
      return "Venta POS";
    case "supplier_payment":
      return "Pago Proveedor";
    case "customer_collection":
      return "Cobranza Cliente";
    case "service_expense":
      return "Pago de Servicio";
    case "manual_income":
      return "Ingreso Manual";
    case "manual_expense":
      return "Egreso Manual";
    case "account_transfer":
      return "Transf. entre cuentas";
    default:
      return origin;
  }
};

export type BankDatePeriodPreset = "all" | "today" | "week" | "month" | "custom";

const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysAgoDateString = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateString(d);
};

const isDateInRange = (dateIso: string | undefined | null, from?: string, to?: string): boolean => {
  if (!dateIso) return false;
  try {
    const movDate = new Date(dateIso);
    const movDateStr = getLocalDateString(movDate);
    if (from && movDateStr < from) return false;
    if (to && movDateStr > to) return false;
    return true;
  } catch {
    return true;
  }
};

export const BankAccountMovementsModal = ({
  account,
  onClose,
  canWrite,
  onBalanceUpdated,
}: BankAccountMovementsModalProps) => {
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  useBodyScrollLock(Boolean(account));

  const [movements, setMovements] = useState<BankAccountMovement[]>([]);
  const [summary, setSummary] = useState<BankAccountBalanceSummary>({
    currentBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalMovements: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  // Filtros de fecha
  const [periodPreset, setPeriodPreset] = useState<BankDatePeriodPreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Paneles desplegables (optimizados para ahorrar espacio en móvil)
  const [showMetrics, setShowMetrics] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const applyPeriodPreset = (preset: BankDatePeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "today") {
      const today = getLocalDateString();
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === "week") {
      setDateFrom(getDaysAgoDateString(7));
      setDateTo(getLocalDateString());
    } else if (preset === "month") {
      setDateFrom(getDaysAgoDateString(30));
      setDateTo(getLocalDateString());
    }
  };

  const handleCustomDateChange = (field: "from" | "to", value: string) => {
    setPeriodPreset("custom");
    if (field === "from") {
      setDateFrom(value);
    } else {
      setDateTo(value);
    }
  };

  const handleClearAllFilters = () => {
    applyPeriodPreset("all");
    setFilterType("all");
    setSearchQuery("");
  };

  // Submodal para registrar nuevo movimiento
  const [formModalOpen, setFormModalOpen] = useState<"income" | "expense" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movementForm, setMovementForm] = useState({
    presetConcept: "",
    customConcept: "",
    amount: "",
    voucherNumber: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!account?.tenant_id || !account?.id) return;
    setIsLoading(true);
    try {
      const [movs, summ] = await Promise.all([
        bankAccountMovementsService.getByBankAccount(account.tenant_id, account.id),
        bankAccountMovementsService.getBalanceByBankAccount(account.tenant_id, account.id),
      ]);
      setMovements(movs);
      setSummary(summ);
    } catch (err) {
      console.error("Error al cargar movimientos de cuenta bancaria:", err);
      toast.error("No se pudieron cargar los movimientos de la cuenta.");
    } finally {
      setIsLoading(false);
    }
  }, [account?.id, account?.tenant_id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openFormModal = (type: "income" | "expense") => {
    setFormModalOpen(type);
    setMovementForm({
      presetConcept: type === "expense" ? COMMON_EXPENSE_CONCEPTS[0] : COMMON_INCOME_CONCEPTS[0],
      customConcept: "",
      amount: "",
      voucherNumber: "",
      notes: "",
    });
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.tenant_id || !account?.id || !formModalOpen) return;

    const parsedAmount = parseFloat(movementForm.amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0.");
      return;
    }

    const effectiveConcept =
      movementForm.presetConcept === "Otro Gasto" ||
      movementForm.presetConcept === "Otro Ingreso" ||
      !movementForm.presetConcept
        ? movementForm.customConcept.trim()
        : movementForm.presetConcept;

    if (!effectiveConcept) {
      toast.error("Ingresá o seleccioná un concepto para el movimiento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const originType: BankAccountMovementOriginType =
        formModalOpen === "income"
          ? "manual_income"
          : effectiveConcept.toLowerCase().includes("luz") ||
            effectiveConcept.toLowerCase().includes("internet") ||
            effectiveConcept.toLowerCase().includes("gas") ||
            effectiveConcept.toLowerCase().includes("alquiler") ||
            effectiveConcept.toLowerCase().includes("impuesto")
          ? "service_expense"
          : "manual_expense";

      await bankAccountMovementsService.createMovement(account.tenant_id, {
        bank_account_id: account.id,
        type: formModalOpen,
        origin_type: originType,
        concept: effectiveConcept,
        amount: parsedAmount,
        voucher_number: movementForm.voucherNumber.trim() || null,
        notes: movementForm.notes.trim() || null,
        created_by: user?.id ?? null,
      });

      toast.success(
        formModalOpen === "income"
          ? `Ingreso de ${formatCurrency(parsedAmount)} registrado.`
          : `Egreso de ${formatCurrency(parsedAmount)} registrado.`
      );

      setFormModalOpen(null);
      await loadData();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err) {
      console.error("Error al registrar movimiento:", err);
      toast.error("Error al registrar el movimiento en la cuenta bancaria.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const movementsInPeriod = useMemo(() => {
    if (!dateFrom && !dateTo) return movements;
    return movements.filter((m) => isDateInRange(m.created_at, dateFrom, dateTo));
  }, [movements, dateFrom, dateTo]);

  const periodSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const m of movementsInPeriod) {
      if (m.type === "income") {
        income += m.amount;
        incomeCount++;
      } else if (m.type === "expense") {
        expense += m.amount;
        expenseCount++;
      }
    }

    const net = income - expense;
    return {
      income,
      expense,
      net,
      incomeCount,
      expenseCount,
      totalCount: movementsInPeriod.length,
    };
  }, [movementsInPeriod]);

  const getPeriodDescription = () => {
    switch (periodPreset) {
      case "today":
        return "Hoy";
      case "week":
        return "Últimos 7 días";
      case "month":
        return "Últimos 30 días";
      case "custom":
        if (dateFrom && dateTo) {
          return `${dateFrom} al ${dateTo}`;
        }
        if (dateFrom) return `Desde ${dateFrom}`;
        if (dateTo) return `Hasta ${dateTo}`;
        return "Personalizado";
      case "all":
      default:
        return "Histórico acumulado";
    }
  };

  const filteredMovements = useMemo(() => {
    return movementsInPeriod.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchConcept = (m.concept || "").toLowerCase().includes(q);
      const matchVoucher = (m.voucher_number || "").toLowerCase().includes(q);
      const matchNotes = (m.notes || "").toLowerCase().includes(q);
      const matchOrigin = getOriginLabel(m.origin_type).toLowerCase().includes(q);
      return matchConcept || matchVoucher || matchNotes || matchOrigin;
    });
  }, [movementsInPeriod, filterType, searchQuery]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (periodPreset !== "all" || dateFrom || dateTo) count++;
    if (filterType !== "all") count++;
    return count;
  }, [periodPreset, dateFrom, dateTo, filterType]);

  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-5xl rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[96vh] sm:max-h-[92vh] overscroll-contain">
        {/* Encabezado con Botones de Registro integrados */}
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {account.bank_name}
                </h2>
                <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                  {account.account_type.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Titular: {account.holder_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canWrite && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openFormModal("income")}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Registrar Ingreso"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span className="hidden sm:inline">Ingreso</span>
                </button>
                <button
                  type="button"
                  onClick={() => openFormModal("expense")}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Registrar Egreso"
                >
                  <Minus size={14} className="stroke-[3]" />
                  <span className="hidden sm:inline">Egreso</span>
                </button>
              </div>
            )}
            <ModalCloseButton onClick={onClose} label="Cerrar ventana" />
          </div>
        </div>

        {/* Panel Desplegable 1: Barra Compacta de Saldo y Métricas */}
        <div className="px-3.5 sm:px-6 py-2 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-7 w-7 rounded-lg bg-blue-100/80 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-none">
                Saldo Disponible
              </span>
              <span className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-slate-100 block leading-tight mt-0.5 truncate">
                {formatCurrency(summary.currentBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-xs font-mono font-bold">
              <span className="text-slate-400 text-[10px] uppercase">Neto:</span>
              <span
                className={
                  periodSummary.net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {periodSummary.net >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(periodSummary.net))}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowMetrics((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 whitespace-nowrap",
                showMetrics
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/70 dark:border-blue-800 dark:text-blue-300 font-bold"
                  : "bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50"
              )}
            >
              <span className="sm:hidden">{showMetrics ? "Ocultar" : "Métricas"}</span>
              <span className="hidden sm:inline">{showMetrics ? "Ocultar métricas" : "Ver métricas"}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200 shrink-0",
                  showMetrics && "rotate-180"
                )}
              />
            </button>
          </div>
        </div>

        {/* Panel Desplegable Expandido de Métricas KPI */}
        {showMetrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
            {/* 1. Saldo Disponible Actual */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 sm:p-3 dark:border-blue-900/60 dark:bg-blue-950/40 shadow-2xs min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 truncate">
                  Saldo Disponible
                </span>
                <span className="rounded bg-blue-200/80 dark:bg-blue-900/80 px-1 py-0.2 text-[8.5px] font-bold text-blue-900 dark:text-blue-200">
                  ACTUAL
                </span>
              </div>
              <p className="text-sm sm:text-base font-mono font-black text-blue-950 dark:text-blue-100 mt-1">
                {formatCurrency(summary.currentBalance)}
              </p>
            </div>

            {/* 2. Total Ingresos */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 sm:p-3 dark:border-emerald-900/60 dark:bg-emerald-950/40 shadow-2xs min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 truncate">
                  Total Ingresos
                </span>
                <span className="rounded bg-emerald-200/80 dark:bg-emerald-900/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900 dark:text-emerald-200">
                  {periodSummary.incomeCount}
                </span>
              </div>
              <p className="text-sm sm:text-base font-mono font-black text-emerald-900 dark:text-emerald-100 mt-1">
                +{formatCurrency(periodSummary.income)}
              </p>
            </div>

            {/* 3. Total Egresos */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 sm:p-3 dark:border-rose-900/60 dark:bg-rose-950/40 shadow-2xs min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 truncate">
                  Total Egresos
                </span>
                <span className="rounded bg-rose-200/80 dark:bg-rose-900/80 px-1.5 py-0.2 text-[9px] font-bold text-rose-900 dark:text-rose-200">
                  {periodSummary.expenseCount}
                </span>
              </div>
              <p className="text-sm sm:text-base font-mono font-black text-rose-900 dark:text-rose-100 mt-1">
                -{formatCurrency(periodSummary.expense)}
              </p>
            </div>

            {/* 4. Total Generado (Neto) */}
            <div
              className={cn(
                "rounded-xl border p-2.5 sm:p-3 shadow-2xs min-w-0",
                periodSummary.net >= 0
                  ? "border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/60 dark:bg-cyan-950/40"
                  : "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/40"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    periodSummary.net >= 0
                      ? "text-cyan-800 dark:text-cyan-300"
                      : "text-amber-800 dark:text-amber-300"
                  )}
                >
                  Neto Período
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[8.5px] font-bold uppercase shrink-0",
                    periodSummary.net >= 0
                      ? "bg-cyan-200/80 dark:bg-cyan-900/80 text-cyan-900 dark:text-cyan-200"
                      : "bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200"
                  )}
                >
                  {periodPreset === "all" ? "Total" : getPeriodDescription()}
                </span>
              </div>
              <p
                className={cn(
                  "text-sm sm:text-base font-mono font-black mt-1",
                  periodSummary.net >= 0
                    ? "text-cyan-950 dark:text-cyan-100"
                    : "text-amber-950 dark:text-amber-100"
                )}
              >
                {periodSummary.net >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(periodSummary.net))}
              </p>
            </div>
          </div>
        )}

        {/* Panel Desplegable 2: Barra de Búsqueda y Filtros Inteligentes */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            {/* Buscador */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar concepto o comprobante..."
                className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                autoComplete="off"
                data-lpignore="true"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Borrar texto"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Segmentado Rápido de Tipo (Desktop / Tablet) */}
            <div className="hidden sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer",
                  filterType === "all"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                Todos ({periodSummary.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("income")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer",
                  filterType === "income"
                    ? "bg-white text-emerald-800 shadow-2xs dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-700"
                )}
              >
                Ingresos ({periodSummary.incomeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("expense")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer",
                  filterType === "expense"
                    ? "bg-white text-rose-800 shadow-2xs dark:bg-slate-700 dark:text-rose-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-rose-700"
                )}
              >
                Egresos ({periodSummary.expenseCount})
              </button>
            </div>

            {/* Botón Desplegable de Filtros Inteligentes (Período y Tipo) */}
            <button
              type="button"
              onClick={() => setShowFiltersPanel((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer shrink-0",
                activeFiltersCount > 0 || showFiltersPanel
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:border-blue-700 dark:text-blue-300 font-bold"
                  : "border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <SlidersHorizontal size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Período & Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showFiltersPanel && "rotate-180"
                )}
              />
            </button>
          </div>

          {/* Chips de Filtros Activos (visibles cuando el panel está plegado para ahorrar espacio) */}
          {!showFiltersPanel && (activeFiltersCount > 0 || searchQuery) && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                Filtros:
              </span>

              {periodPreset !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[11px] font-medium shrink-0">
                  <Calendar size={11} />
                  <span>{getPeriodDescription()}</span>
                  <button
                    type="button"
                    onClick={() => applyPeriodPreset("all")}
                    className="hover:text-blue-900 dark:hover:text-blue-100 ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {filterType !== "all" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border shrink-0",
                    filterType === "income"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                  )}
                >
                  <span>{filterType === "income" ? "Solo Ingresos" : "Solo Egresos"}</span>
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className="ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[11px] shrink-0">
                  <span>"{searchQuery}"</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="hover:text-slate-900 ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline ml-1 cursor-pointer shrink-0"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {/* Panel Desplegable de Configuración de Filtros y Fechas */}
          {showFiltersPanel && (
            <div className="pt-2 pb-1 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
              {/* 1. Selector de Período Rápido */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Calendar size={12} className="text-blue-500" />
                    <span>Período de Fecha</span>
                  </span>
                  {periodPreset !== "all" && (
                    <button
                      type="button"
                      onClick={() => applyPeriodPreset("all")}
                      className="text-[10.5px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Ver todo el historial
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "all", label: "Todo" },
                    { id: "today", label: "Hoy" },
                    { id: "week", label: "7 días" },
                    { id: "month", label: "30 días" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPeriodPreset(preset.id as any)}
                      className={cn(
                        "py-1.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer",
                        periodPreset === preset.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Rango Personalizado Desde / Hasta */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleCustomDateChange("from", e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleCustomDateChange("to", e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
              </div>

              {/* 3. Filtro de Tipo en Móvil */}
              <div className="sm:hidden pt-0.5">
                <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer",
                      filterType === "all"
                        ? "bg-slate-900 text-white dark:bg-slate-700 font-bold"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    Todos ({periodSummary.totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("income")}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer",
                      filterType === "income"
                        ? "bg-emerald-600 text-white font-bold"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    Ingresos ({periodSummary.incomeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("expense")}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer",
                      filterType === "expense"
                        ? "bg-rose-600 text-white font-bold"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400"
                    )}
                  >
                    Egresos ({periodSummary.expenseCount})
                  </button>
                </div>
              </div>

              {/* Botones de acción del panel desplegable */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(false)}
                  className="px-3.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-2xs cursor-pointer"
                >
                  Aplicar y cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contenido: Hybrid Table & Mobile Data Cards (Maximizado para ocupar todo el alto disponible) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="p-8">
              <LoadingState message="Cargando movimientos bancarios..." />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Sin movimientos registrados
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "No hay movimientos que coincidan con la búsqueda."
                  : periodPreset !== "all" || dateFrom || dateTo
                  ? "No se encontraron movimientos registrados en el período seleccionado."
                  : "Los cobros del POS, pagos a proveedores y registros manuales aparecerán aquí."}
              </p>
              {(periodPreset !== "all" || dateFrom || dateTo || searchQuery || filterType !== "all") && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Ver todos los movimientos</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* ============================================================== */}
              {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
              {/* ============================================================== */}
              <div className="hidden md:block rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200/90 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Concepto</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Origen</th>
                      <th className="py-2.5 px-3">Comprobante</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3 text-right">Saldo Resultante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMovements.map((mov) => {
                      const isIncome = mov.type === "income";
                      return (
                        <tr
                          key={mov.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatDateTime(mov.created_at)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {mov.concept}
                            {mov.notes && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                {mov.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isIncome
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 dark:border dark:border-rose-800"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowDownRight size={10} className="stroke-[3]" />
                              ) : (
                                <ArrowUpRight size={10} className="stroke-[3]" />
                              )}
                              {isIncome ? "Ingreso" : "Egreso"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {getOriginLabel(mov.origin_type)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {mov.voucher_number || "-"}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(mov.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatCurrency(mov.balance_after)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ============================================================== */}
              {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
              {/* ============================================================== */}
              <div className="block md:hidden space-y-2.5">
                {filteredMovements.map((mov) => {
                  const isIncome = mov.type === "income";
                  return (
                    <article
                      key={mov.id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2 transition-all"
                    >
                      {/* Zona 1: Badges de Tipo, Origen y Fecha */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          {/* Tipo */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold border",
                              isIncome
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                                : "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
                            )}
                          >
                            {isIncome ? (
                              <ArrowDownRight size={11} className="stroke-[3]" />
                            ) : (
                              <ArrowUpRight size={11} className="stroke-[3]" />
                            )}
                            <span>{isIncome ? "Ingreso" : "Egreso"}</span>
                          </span>

                          {/* Origen */}
                          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                            {getOriginLabel(mov.origin_type)}
                          </span>
                        </div>

                        {/* Fecha y Hora */}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          <Clock size={11} className="text-slate-400" />
                          <span>{formatDateTime(mov.created_at)}</span>
                        </div>
                      </div>

                      {/* Zona 2: Concepto y Observaciones */}
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                          {mov.concept}
                        </h4>
                        {mov.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            {mov.notes}
                          </p>
                        )}
                      </div>

                      {/* Zona 3: Monto Principal & Saldo Resultante */}
                      <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            MONTO
                          </p>
                          <p
                            className={cn(
                              "text-base sm:text-lg font-mono font-black leading-tight",
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(mov.amount)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            SALDO POSTERIOR
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
                            {formatCurrency(mov.balance_after)}
                          </p>
                        </div>
                      </div>

                      {/* Zona 4: Comprobante (si existe) */}
                      {mov.voucher_number && (
                        <div className="rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 px-2.5 py-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <Receipt size={12} className="text-slate-400" />
                            <span>Comprobante / Ref:</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {mov.voucher_number}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Registro de Movimiento Manual */}
        {formModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overscroll-contain">
            <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4 my-auto overscroll-contain">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl",
                      formModalOpen === "income"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    )}
                  >
                    {formModalOpen === "income" ? (
                      <ArrowDownRight size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {formModalOpen === "income"
                        ? "Registrar Ingreso Bancario"
                        : "Registrar Egreso Bancario / Pago"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cuenta: {account.bank_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMovement} autoComplete="off" className="space-y-3">
                {/* Concepto Preset */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Concepto / Motivo *
                  </label>
                  <select
                    value={movementForm.presetConcept}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, presetConcept: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(formModalOpen === "income"
                      ? COMMON_INCOME_CONCEPTS
                      : COMMON_EXPENSE_CONCEPTS
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Concepto Personalizado */}
                {(movementForm.presetConcept === "Otro Gasto" ||
                  movementForm.presetConcept === "Otro Ingreso" ||
                  movementForm.presetConcept === "Pago de Luz / Electricidad" ||
                  movementForm.presetConcept === "Pago de Internet / Teléfono") && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Detalle adicional (ej: Empresa, Factura, Mes)
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      value={movementForm.customConcept}
                      onChange={(e) =>
                        setMovementForm((curr) => ({ ...curr, customConcept: e.target.value }))
                      }
                      placeholder="Ej: Edesur Factura 98412 - Mes Septiembre"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Monto */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Monto ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      autoComplete="off"
                      data-lpignore="true"
                      value={movementForm.amount}
                      onChange={(e) =>
                        setMovementForm((curr) => ({ ...curr, amount: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Nº Comprobante */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Nº de Comprobante / Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    data-lpignore="true"
                    value={movementForm.voucherNumber}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, voucherNumber: e.target.value }))
                    }
                    placeholder="Ej: Transf. #849102"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Observaciones (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={movementForm.notes}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, notes: e.target.value }))
                    }
                    placeholder="Anotaciones internas..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer",
                      formModalOpen === "income"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    )}
                  >
                    {isSubmitting ? "Guardando..." : "Confirmar Movimiento"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
