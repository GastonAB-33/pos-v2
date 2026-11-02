import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
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
      return "Pago Compra Proveedor";
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

  // Filtro por período de fecha
  const [periodPreset, setPeriodPreset] = useState<BankDatePeriodPreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
        return "Día actual";
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
        return "Período personalizado";
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

  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {account.bank_name}
                </h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {account.account_type.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Titular: {account.holder_name}
                {account.alias ? ` • Alias: ${account.alias}` : ""}
                {account.cbu ? ` • CBU/CVU: ${account.cbu}` : ""}
              </p>
            </div>
          </div>

          <ModalCloseButton onClick={onClose} label="Cerrar ventana" />
        </div>

        {/* Tarjetas KPI de Saldo y Total Generado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
          {/* 1. Saldo Actual */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Saldo Disponible
                </span>
                <span className="rounded bg-blue-200/80 dark:bg-blue-900/80 px-1.5 py-0.2 text-[9px] font-bold text-blue-900 dark:text-blue-200 uppercase">
                  Actual
                </span>
              </div>
              <p className="text-lg font-mono font-black text-blue-950 dark:text-blue-100 mt-0.5">
                {formatCurrency(summary.currentBalance)}
              </p>
              <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                Saldo actual en cuenta
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
          </div>

          {/* 2. Total Ingresos en Período */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Total Ingresos
                </span>
                <span className="rounded bg-emerald-200/80 dark:bg-emerald-900/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900 dark:text-emerald-200">
                  {periodSummary.incomeCount}
                </span>
              </div>
              <p className="text-lg font-mono font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                +{formatCurrency(periodSummary.income)}
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                {getPeriodDescription()}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 shrink-0">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>

          {/* 3. Total Egresos en Período */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Total Egresos
                </span>
                <span className="rounded bg-rose-200/80 dark:bg-rose-900/80 px-1.5 py-0.2 text-[9px] font-bold text-rose-900 dark:text-rose-200">
                  {periodSummary.expenseCount}
                </span>
              </div>
              <p className="text-lg font-mono font-black text-rose-900 dark:text-rose-100 mt-0.5">
                -{formatCurrency(periodSummary.expense)}
              </p>
              <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                {getPeriodDescription()}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 shrink-0">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          {/* 4. Total Generado (Neto del Período) */}
          <div
            className={cn(
              "rounded-xl border p-3.5 shadow-xs flex items-center justify-between transition-colors",
              periodSummary.net >= 0
                ? "border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/60 dark:bg-cyan-950/40"
                : "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/40"
            )}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider",
                    periodSummary.net >= 0
                      ? "text-cyan-800 dark:text-cyan-300"
                      : "text-amber-800 dark:text-amber-300"
                  )}
                >
                  Total Generado
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                    periodSummary.net >= 0
                      ? "bg-cyan-200/80 dark:bg-cyan-900/80 text-cyan-900 dark:text-cyan-200"
                      : "bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200"
                  )}
                >
                  Neto
                </span>
              </div>
              <p
                className={cn(
                  "text-lg font-mono font-black mt-0.5",
                  periodSummary.net >= 0
                    ? "text-cyan-950 dark:text-cyan-100"
                    : "text-amber-950 dark:text-amber-100"
                )}
              >
                {periodSummary.net >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(periodSummary.net))}
              </p>
              <p
                className={cn(
                  "text-[10px] mt-0.5 font-medium",
                  periodSummary.net >= 0
                    ? "text-cyan-700/90 dark:text-cyan-300/90"
                    : "text-amber-700/90 dark:text-amber-300/90"
                )}
              >
                {getPeriodDescription()}
              </p>
            </div>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                periodSummary.net >= 0
                  ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              )}
            >
              {periodSummary.net >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>

        {/* Barra de Período de Fechas */}
        <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Presets de Fecha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mr-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              <span>Período:</span>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => applyPeriodPreset("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
                  periodPreset === "all"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => applyPeriodPreset("today")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
                  periodPreset === "today"
                    ? "bg-white text-blue-800 shadow-2xs dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300"
                )}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => applyPeriodPreset("week")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
                  periodPreset === "week"
                    ? "bg-white text-blue-800 shadow-2xs dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300"
                )}
              >
                Última semana
              </button>
              <button
                type="button"
                onClick={() => applyPeriodPreset("month")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
                  periodPreset === "month"
                    ? "bg-white text-blue-800 shadow-2xs dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300"
                )}
              >
                Último mes
              </button>
            </div>
          </div>

          {/* Selectores de Fecha Desde / Hasta */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Desde:
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleCustomDateChange("from", e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Hasta:
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleCustomDateChange("to", e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            {(dateFrom || dateTo || periodPreset !== "all") && (
              <button
                type="button"
                onClick={() => applyPeriodPreset("all")}
                title="Quitar filtro de fechas y ver todos"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition shadow-2xs"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Acciones y Filtros */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          {/* Búsqueda y Filtros de tipo */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por concepto o comprobante..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
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
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
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
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition",
                  filterType === "expense"
                    ? "bg-white text-rose-800 shadow-2xs dark:bg-slate-700 dark:text-rose-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-rose-700"
                )}
              >
                Egresos ({periodSummary.expenseCount})
              </button>
            </div>
          </div>

          {/* Botones de Registro Rápido */}
          {canWrite && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openFormModal("income")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition"
              >
                <Plus size={14} className="stroke-[3]" />
                Registrar Ingreso
              </button>
              <button
                type="button"
                onClick={() => openFormModal("expense")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition"
              >
                <Minus size={14} className="stroke-[3]" />
                Registrar Egreso
              </button>
            </div>
          )}
        </div>

        {/* Tabla de Movimientos */}
        <div className="flex-1 overflow-y-auto p-4">
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {searchQuery
                  ? "No hay movimientos que coincidan con la búsqueda."
                  : periodPreset !== "all" || dateFrom || dateTo
                  ? "No se encontraron movimientos registrados en el período de fechas seleccionado."
                  : "Los cobros del POS, pagos a proveedores y registros manuales aparecerán aquí."}
              </p>
              {(periodPreset !== "all" || dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => applyPeriodPreset("all")}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ver todos los movimientos
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
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
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{mov.notes}</p>
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
          )}
        </div>

        {/* Modal de Registro de Movimiento */}
        {formModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      formModalOpen === "income"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
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
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMovement} autoComplete="off" className="space-y-3">
                {/* Concepto Preset */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Concepto / Motivo
                  </label>
                  <select
                    value={movementForm.presetConcept}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, presetConcept: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
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

                {/* Concepto Personalizado (si elige Otro o quiere especificar) */}
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
                      data-lpignore="true"
                      value={movementForm.customConcept}
                      onChange={(e) =>
                        setMovementForm((curr) => ({ ...curr, customConcept: e.target.value }))
                      }
                      placeholder="Ej: Edesur Factura 98412 - Mes Septiembre"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}

                {/* Monto */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Monto ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500 dark:text-slate-400">$</span>
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
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(null)}
                    disabled={isSubmitting}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition ${
                      formModalOpen === "income"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
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
