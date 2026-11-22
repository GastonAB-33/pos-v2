import { useEffect, useState, useCallback, useMemo } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  Building2,
  Calendar,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  FilterX,
  X,
  Wallet,
  CheckCircle2,
  Eye,
  EyeOff,
  TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAccountingCatalogs } from "@/modules/configuracion/hooks/useAccountingCatalogs";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { BankAccountMovementsModal } from "../components/BankAccountMovementsModal";
import type { BankAccount, BankAccountType, BankAccountMovement } from "@/types/entities";
import { cn } from "@/utils/cn";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getAccountTypeLabel = (type: BankAccount["account_type"]): string => {
  switch (type) {
    case "cuenta_corriente":
      return "Cuenta Corriente";
    case "caja_ahorro":
      return "Caja de Ahorro";
    case "billetera_virtual":
      return "Billetera Virtual";
    default:
      return "Otro";
  }
};

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
    const itemDate = new Date(dateIso);
    const itemDateStr = getLocalDateString(itemDate);
    if (from && itemDateStr < from) return false;
    if (to && itemDateStr > to) return false;
    return true;
  } catch {
    return true;
  }
};

export const BancosPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();

  const canReadModule = canRead("bancos");
  const canWriteModule = canWrite("bancos");

  const {
    bankAccounts,
    isLoading,
    feedback,
    clearFeedback,
    reload,
    upsertBankAccount,
    toggleBankAccount,
    toggleBankAccountPosAvailable,
  } = useAccountingCatalogs(tenantId, user?.id ?? null, canReadModule);

  // Bank Account Movements and Balances state
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
  const [allMovements, setAllMovements] = useState<BankAccountMovement[]>([]);
  const [_isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [selectedMovementsAccount, setSelectedMovementsAccount] = useState<BankAccount | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterPos, setFilterPos] = useState<"all" | "pos" | "no_pos">("all");
  const [periodPreset, setPeriodPreset] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyWithMovements, setOnlyWithMovements] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const applyDatePreset = (preset: "all" | "today" | "week" | "month" | "custom") => {
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

  const loadMovementsAndBalances = useCallback(async () => {
    if (!tenantId) return;
    setIsMovementsLoading(true);
    try {
      // Optimización crítica de egress: Traer solo los 500 movimientos bancarios más recientes
      const movs = await bankAccountMovementsService.getRecentByTenant(tenantId, 500);
      setAllMovements(movs);

      // Calcular saldos a partir del último movimiento ordenado cronológicamente
      const sorted = [...movs].sort((a, b) =>
        (a.created_at || "").localeCompare(b.created_at || "")
      );
      const balances: Record<string, number> = {};
      for (const m of sorted) {
        balances[m.bank_account_id] = Number(m.balance_after) || 0;
      }
      setAccountBalances(balances);
    } catch (err) {
      console.error("Error loading bank account movements and balances:", err);
    } finally {
      setIsMovementsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && canReadModule) {
      loadMovementsAndBalances();
    }
  }, [tenantId, canReadModule, loadMovementsAndBalances, bankAccounts]);

  const handleRefreshAll = () => {
    reload();
    loadMovementsAndBalances();
  };

  useEffect(() => {
    if (feedback) {
      if (feedback.type === "success") toast.success(feedback.message);
      else toast.error(feedback.message);
      clearFeedback();
    }
  }, [feedback, clearFeedback, toast]);

  // Modals state for New/Edit Bank Account
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Bloquear scroll de la pantalla de fondo mientras cualquier modal esté abierto
  useBodyScrollLock(advancedFiltersOpen || accountModalOpen || Boolean(selectedMovementsAccount));
  const [accountForm, setAccountForm] = useState<{
    bank_name: string;
    account_type: BankAccount["account_type"];
    holder_name: string;
    cbu: string;
    alias: string;
    currency_code: string;
    notes: string;
    is_active: boolean;
    is_pos_available: boolean;
  }>({
    bank_name: "",
    account_type: "cuenta_corriente",
    holder_name: "",
    cbu: "",
    alias: "",
    currency_code: "ARS",
    notes: "",
    is_active: true,
    is_pos_available: true,
  });

  const openAccountModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        bank_name: account.bank_name,
        account_type: account.account_type,
        holder_name: account.holder_name,
        cbu: account.cbu || "",
        alias: account.alias || "",
        currency_code: account.currency_code,
        notes: account.notes || "",
        is_active: account.is_active,
        is_pos_available: account.is_pos_available !== false,
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        bank_name: "",
        account_type: "cuenta_corriente",
        holder_name: "",
        cbu: "",
        alias: "",
        currency_code: "ARS",
        notes: "",
        is_active: true,
        is_pos_available: true,
      });
    }
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertBankAccount(
      {
        bank_name: accountForm.bank_name.trim(),
        account_type: accountForm.account_type,
        holder_name: accountForm.holder_name.trim(),
        cbu: accountForm.cbu.trim() || null,
        alias: accountForm.alias.trim() || null,
        currency_code: accountForm.currency_code.trim() || "ARS",
        notes: accountForm.notes.trim() || null,
        is_active: accountForm.is_active,
        is_pos_available: accountForm.is_pos_available,
      },
      editingAccount ? editingAccount.id : undefined
    );
    setAccountModalOpen(false);
  };

  // Period state & description
  const isPeriodFilterActive = periodPreset !== "all" || Boolean(dateFrom || dateTo);

  const periodDescription = useMemo(() => {
    switch (periodPreset) {
      case "today":
        return "Movs. de Hoy";
      case "week":
        return "Últimos 7 días";
      case "month":
        return "Últimos 30 días";
      case "custom":
        if (dateFrom && dateTo) return `${dateFrom} al ${dateTo}`;
        if (dateFrom) return `Desde ${dateFrom}`;
        if (dateTo) return `Hasta ${dateTo}`;
        return "Período personalizado";
      case "all":
      default:
        return "Todas las fechas";
    }
  }, [periodPreset, dateFrom, dateTo]);

  // Actividad por cuenta bancaria en el período seleccionado
  const periodActivityByAccount = useMemo(() => {
    const map: Record<
      string,
      {
        income: number;
        expense: number;
        net: number;
        incomeCount: number;
        expenseCount: number;
        totalCount: number;
      }
    > = {};

    for (const acc of bankAccounts) {
      map[acc.id] = {
        income: 0,
        expense: 0,
        net: 0,
        incomeCount: 0,
        expenseCount: 0,
        totalCount: 0,
      };
    }

    for (const mov of allMovements) {
      if (!map[mov.bank_account_id]) {
        map[mov.bank_account_id] = {
          income: 0,
          expense: 0,
          net: 0,
          incomeCount: 0,
          expenseCount: 0,
          totalCount: 0,
        };
      }

      if (isPeriodFilterActive) {
        if (!isDateInRange(mov.created_at, dateFrom, dateTo)) {
          continue;
        }
      }

      const amt = Number(mov.amount) || 0;
      map[mov.bank_account_id].totalCount++;
      if (mov.type === "income") {
        map[mov.bank_account_id].income += amt;
        map[mov.bank_account_id].incomeCount++;
      } else {
        map[mov.bank_account_id].expense += amt;
        map[mov.bank_account_id].expenseCount++;
      }
    }

    for (const key of Object.keys(map)) {
      map[key].income = Number(map[key].income.toFixed(2));
      map[key].expense = Number(map[key].expense.toFixed(2));
      map[key].net = Number((map[key].income - map[key].expense).toFixed(2));
    }

    return map;
  }, [bankAccounts, allMovements, isPeriodFilterActive, dateFrom, dateTo]);

  // Totales consolidados de todos los bancos en el período seleccionado
  const periodConsolidatedTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let movementsCount = 0;

    for (const acc of bankAccounts) {
      if (!acc.is_active) continue;
      const act = periodActivityByAccount[acc.id];
      if (act) {
        income += act.income;
        expense += act.expense;
        movementsCount += act.totalCount;
      }
    }

    const net = income - expense;
    return {
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      net: Number(net.toFixed(2)),
      movementsCount,
    };
  }, [bankAccounts, periodActivityByAccount]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterType !== "all") count++;
    if (filterStatus !== "all") count++;
    if (filterPos !== "all") count++;
    if (isPeriodFilterActive) count++;
    if (onlyWithMovements) count++;
    return count;
  }, [filterType, filterStatus, filterPos, isPeriodFilterActive, onlyWithMovements]);

  const handleClearFilters = () => {
    setSearch("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterPos("all");
    setOnlyWithMovements(false);
    applyDatePreset("all");
  };

  // Filtered bank accounts
  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      // Type filter
      if (filterType !== "all" && acc.account_type !== filterType) {
        return false;
      }
      // Status filter
      if (filterStatus === "active" && !acc.is_active) {
        return false;
      }
      if (filterStatus === "inactive" && acc.is_active) {
        return false;
      }
      // POS filter
      if (filterPos === "pos" && acc.is_pos_available === false) {
        return false;
      }
      if (filterPos === "no_pos" && acc.is_pos_available !== false) {
        return false;
      }
      // Solo con movimientos en el período (si está activo el toggle)
      if (isPeriodFilterActive && onlyWithMovements) {
        const act = periodActivityByAccount[acc.id];
        if (!act || act.totalCount === 0) {
          return false;
        }
      }
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchBank = acc.bank_name.toLowerCase().includes(query);
        const matchHolder = acc.holder_name.toLowerCase().includes(query);
        const matchAlias = (acc.alias || "").toLowerCase().includes(query);
        const matchCbu = (acc.cbu || "").toLowerCase().includes(query);
        const matchNotes = (acc.notes || "").toLowerCase().includes(query);
        return matchBank || matchHolder || matchAlias || matchCbu || matchNotes;
      }
      return true;
    });
  }, [
    bankAccounts,
    search,
    filterType,
    filterStatus,
    filterPos,
    isPeriodFilterActive,
    onlyWithMovements,
    periodActivityByAccount,
  ]);

  // Overall KPIs
  const totalActiveAccounts = useMemo(
    () => bankAccounts.filter((a) => a.is_active).length,
    [bankAccounts]
  );
  const totalPosAccounts = useMemo(
    () => bankAccounts.filter((a) => a.is_active && a.is_pos_available !== false).length,
    [bankAccounts]
  );
  const totalConsolidatedBalance = useMemo(() => {
    return bankAccounts.reduce((acc, curr) => {
      if (!curr.is_active) return acc;
      return acc + (accountBalances[curr.id] ?? 0);
    }, 0);
  }, [bankAccounts, accountBalances]);

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No hay un comercio activo
      </div>
    );
  }

  if (!canReadModule) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No tenés permisos de lectura para este módulo
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header flotante moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            CONTABLE › BANCOS Y FINANZAS
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Bancos y Finanzas
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Gestión de cuentas bancarias y billeteras virtuales de la empresa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {canWriteModule && (
            <button
              type="button"
              onClick={() => openAccountModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Cuenta Bancaria</span>
            </button>
          )}
        </div>
      </header>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {isPeriodFilterActive ? (
          <>
            {/* 1. Flujo Neto en Período */}
            <div className="col-span-3 lg:col-span-1 rounded-2xl border border-indigo-200/90 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/40 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
              <div className="min-w-0 flex-1 mr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Flujo Neto Período
                  </span>
                  <span className="rounded bg-indigo-200/80 dark:bg-indigo-900/80 px-1.5 py-0.2 text-[9px] font-bold text-indigo-900 dark:text-indigo-200 uppercase truncate max-w-[120px]">
                    {periodDescription}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xl sm:text-2xl font-mono font-black mt-0.5 leading-none",
                    periodConsolidatedTotals.net >= 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  )}
                >
                  {periodConsolidatedTotals.net >= 0 ? "+" : ""}
                  {currency.format(periodConsolidatedTotals.net)}
                </p>
                <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80 mt-1 truncate">
                  Ingresos menos egresos de todas las cuentas
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* 2. Total Ingresos en Período */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Ingresos Período
                </p>
                <p className="text-base sm:text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                  +{currency.format(periodConsolidatedTotals.income)}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  En todas las cuentas
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 items-center justify-center shrink-0 ml-1.5">
                <ArrowDownRight className="h-5 w-5" />
              </div>
            </div>

            {/* 3. Total Egresos en Período */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Egresos Período
                </p>
                <p className="text-base sm:text-xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                  -{currency.format(periodConsolidatedTotals.expense)}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  {periodConsolidatedTotals.movementsCount} movs en total
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 items-center justify-center shrink-0 ml-1.5">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>

            {/* 4. Saldo Consolidado Actual */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Saldo Actual
                </p>
                <p className="text-base sm:text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                  {currency.format(totalConsolidatedBalance)}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  Total disponible hoy
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 items-center justify-center shrink-0 ml-1.5">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Saldo Consolidado: Full-width en móvil (col-span-3), 1 col en desktop (lg:col-span-1) */}
            <div className="col-span-3 lg:col-span-1 rounded-2xl border border-indigo-200/90 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/40 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
              <div className="min-w-0 flex-1 mr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Saldo Consolidado
                  </span>
                  <span className="rounded bg-indigo-200/80 dark:bg-indigo-900/80 px-1.5 py-0.2 text-[9px] font-bold text-indigo-900 dark:text-indigo-200 uppercase">
                    Total
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-slate-100 mt-0.5 leading-none">
                  {currency.format(totalConsolidatedBalance)}
                </p>
                <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80 mt-1">
                  Total disponible en bancos y billeteras
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* Total Cuentas */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Total Cuentas
                </p>
                <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  {bankAccounts.length}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  En sistema
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 items-center justify-center shrink-0 ml-1.5">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            {/* Cuentas Activas */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Activas
                </p>
                <p className="text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {totalActiveAccounts}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  Operativas
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 items-center justify-center shrink-0 ml-1.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            {/* Disponibles en POS */}
            <div className="col-span-1 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  En POS
                </p>
                <p className="text-lg sm:text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
                  {totalPosAccounts}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                  Para cobrar
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 items-center justify-center shrink-0 ml-1.5">
                <Eye className="h-5 w-5" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter Strip con Mobile Encapsulation (/mobile-data-cards standard) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          {/* 1. Buscador */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por banco, titular, alias o CBU..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* 2. Filtros Desktop (en pantallas medianas y grandes) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Tipo */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todos los tipos</option>
              <option value="cuenta_corriente">Cuenta Corriente</option>
              <option value="caja_ahorro">Caja de Ahorro</option>
              <option value="billetera_virtual">Billetera Virtual</option>
              <option value="otro">Otro</option>
            </select>

            {/* Estado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activas</option>
              <option value="inactive">Solo Inactivas</option>
            </select>

            {/* POS */}
            <select
              value={filterPos}
              onChange={(e) => setFilterPos(e.target.value as any)}
              className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Cobro en POS</option>
              <option value="pos">Disponibles en POS</option>
              <option value="no_pos">Ocultas en POS</option>
            </select>

            {/* Fecha de Movimientos Desktop */}
            <select
              value={periodPreset}
              onChange={(e) => applyDatePreset(e.target.value as any)}
              className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Movs. de Hoy</option>
              <option value="week">Movs. últimos 7 días</option>
              <option value="month">Movs. últimos 30 días</option>
            </select>

            {(search || activeFiltersCount > 0) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                title="Limpiar todos los filtros"
              >
                <FilterX size={16} />
              </button>
            )}
          </div>

          {/* 3. Botón de Filtros Avanzados (Móvil: debajo del buscador) */}
          <div className="flex md:hidden items-center gap-2 shrink-0 w-full">
            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen(true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer",
                activeFiltersCount > 0 &&
                  "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
              )}
            >
              <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
              <span>Filtros avanzados</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {(search || activeFiltersCount > 0) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0"
                title="Limpiar filtros"
              >
                <FilterX size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Modal for Mobile */}
      {advancedFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overscroll-contain touch-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdvancedFiltersOpen(false);
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 max-h-[85vh] flex flex-col overscroll-contain touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-slate-200/90 dark:border-slate-800 flex justify-between items-center bg-slate-50/90 dark:bg-slate-800/70 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Filtros Avanzados
                </h3>
              </div>
              <ModalCloseButton onClick={() => setAdvancedFiltersOpen(false)} />
            </header>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* 1. Período de Movimientos de los Bancos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-500" />
                    <span>Período de Movimientos</span>
                  </label>
                  {(periodPreset !== "all" || dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => applyDatePreset("all")}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Todas las fechas
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Calcula ingresos, egresos y flujos de todas las cuentas en este rango.
                </p>

                {/* Presets de Fecha */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { id: "all", label: "Todas" },
                    { id: "today", label: "Hoy" },
                    { id: "week", label: "7 días" },
                    { id: "month", label: "30 días" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyDatePreset(item.id as any)}
                      className={cn(
                        "py-1.5 text-xs font-semibold rounded-xl border text-center transition cursor-pointer",
                        periodPreset === item.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Selectores Desde / Hasta */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setDateFrom(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                      autoComplete="off"
                      data-lpignore="true"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setDateTo(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
                      autoComplete="off"
                      data-lpignore="true"
                    />
                  </div>
                </div>

                {/* Toggle: Solo bancos con movimientos */}
                {isPeriodFilterActive && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <label
                      htmlFor="only-with-movs"
                      className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Solo bancos con actividad en el período
                    </label>
                    <input
                      id="only-with-movs"
                      type="checkbox"
                      checked={onlyWithMovements}
                      onChange={(e) => setOnlyWithMovements(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* 2. Tipo de Cuenta */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Tipo de Cuenta
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "all", label: "Todos los tipos" },
                    { id: "cuenta_corriente", label: "Cuenta Corriente" },
                    { id: "caja_ahorro", label: "Caja de Ahorro" },
                    { id: "billetera_virtual", label: "Billetera Virtual" },
                    { id: "otro", label: "Otro" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilterType(item.id)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all",
                        filterType === item.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Estado */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Estado
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all", label: "Todos" },
                    { id: "active", label: "Activas" },
                    { id: "inactive", label: "Inactivas" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilterStatus(item.id as any)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium rounded-xl border text-center transition-all",
                        filterStatus === item.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Disponibilidad POS */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Cobros en Punto de Venta (POS)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all", label: "Todos" },
                    { id: "pos", label: "En POS" },
                    { id: "no_pos", label: "Ocultos" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilterPos(item.id as any)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium rounded-xl border text-center transition-all",
                        filterPos === item.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <footer className="p-4 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Limpiar todo
              </button>
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
              >
                Aplicar Filtros
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Main Container: Hybrid Table & Mobile Data Cards */}
      <div className="bancos-workspace space-y-4">
        {isLoading ? (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 shadow-xs">
            <LoadingState
              message="Cargando cuentas bancarias..."
              description="Consultando saldos conciliados, transferencias y bancos vinculados..."
            />
          </div>
        ) : filteredBankAccounts.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
            <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {bankAccounts.length === 0
                ? "Sin cuentas bancarias configuradas"
                : "No se encontraron cuentas con los filtros seleccionados"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {bankAccounts.length === 0
                ? "Agregá las cuentas bancarias o billeteras virtuales de tu negocio para registrar cobros y conciliar movimientos."
                : "Probá cambiando el texto de búsqueda o limpiando los filtros avanzados."}
            </p>
            {bankAccounts.length === 0 ? (
              canWriteModule && (
                <button
                  type="button"
                  onClick={() => openAccountModal()}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear primera cuenta</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <FilterX className="h-3.5 w-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* ============================================================== */}
            {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
            {/* ============================================================== */}
            <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-slate-800/70 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200/90 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Banco / Entidad</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Titular</th>
                    <th className="py-3 px-4">CBU / CVU</th>
                    <th className="py-3 px-4">Alias</th>
                    <th className="py-3 px-4 text-right">Saldo Actual</th>
                    {isPeriodFilterActive && (
                      <th className="py-3 px-4 text-right">Movs. ({periodDescription})</th>
                    )}
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Cobros POS</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBankAccounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span>{acc.bank_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {getAccountTypeLabel(acc.account_type)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-200">
                        {acc.holder_name}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">
                        {acc.cbu || "-"}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">
                        {acc.alias || "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {currency.format(accountBalances[acc.id] ?? 0)}
                      </td>
                      {isPeriodFilterActive && (() => {
                        const act = periodActivityByAccount[acc.id] || {
                          income: 0,
                          expense: 0,
                          net: 0,
                          totalCount: 0,
                        };
                        return (
                          <td className="py-3 px-4 text-right">
                            {act.totalCount > 0 ? (
                              <div className="flex flex-col items-end">
                                <span
                                  className={cn(
                                    "font-mono font-bold text-xs",
                                    act.net >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {act.net >= 0 ? "+" : ""}
                                  {currency.format(act.net)}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  +{currency.format(act.income)} / -{currency.format(act.expense)} ({act.totalCount} movs)
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                Sin movs. ($ 0)
                              </span>
                            )}
                          </td>
                        );
                      })()}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            acc.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              acc.is_active ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{acc.is_active ? "Activa" : "Inactiva"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {canWriteModule ? (
                          <button
                            type="button"
                            onClick={() => toggleBankAccountPosAvailable(acc.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                              acc.is_pos_available !== false
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-900/60"
                                : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700"
                            }`}
                            title="Clic para alternar disponibilidad en POS"
                          >
                            {acc.is_pos_available !== false ? (
                              <>
                                <Eye size={12} />
                                <span>En POS</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={12} />
                                <span>Oculto</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                              acc.is_pos_available !== false
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border dark:border-slate-700"
                            }`}
                          >
                            {acc.is_pos_available !== false ? "✓ En POS" : "No"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedMovementsAccount(acc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-900/60 rounded-full transition-all active:scale-95 mr-2 shadow-2xs cursor-pointer"
                          title="Ver movimientos e ingresos/egresos"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                          <span>Movimientos</span>
                        </button>
                        {canWriteModule && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAccountModal(acc)}
                              className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                              title="Editar cuenta"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleBankAccount(acc.id)}
                              className={`!rounded-full h-8 w-8 inline-flex items-center justify-center border ml-1.5 active:scale-95 transition-all shadow-2xs cursor-pointer ${
                                acc.is_active
                                  ? "border-amber-200 bg-white hover:bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-slate-800 dark:text-amber-400"
                                  : "border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-slate-800 dark:text-emerald-400"
                              }`}
                              title={acc.is_active ? "Desactivar cuenta" : "Activar cuenta"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ============================================================== */}
            {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
            {/* ============================================================== */}
            <div className="block md:hidden space-y-3">
              {filteredBankAccounts.map((acc) => (
                <article
                  key={acc.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 transition-all"
                >
                  {/* Zona 1: Badges superiores */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {getAccountTypeLabel(acc.account_type)}
                      </span>

                      {/* Cobro en POS pill badge */}
                      {canWriteModule ? (
                        <button
                          type="button"
                          onClick={() => toggleBankAccountPosAvailable(acc.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition active:scale-95",
                            acc.is_pos_available !== false
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}
                          title="Clic para cambiar cobro en POS"
                        >
                          {acc.is_pos_available !== false ? (
                            <>
                              <Eye size={11} />
                              <span>En POS</span>
                            </>
                          ) : (
                            <>
                              <EyeOff size={11} />
                              <span>Oculto</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            acc.is_pos_available !== false
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          {acc.is_pos_available !== false ? "✓ En POS" : "Oculto"}
                        </span>
                      )}
                    </div>

                    {/* Status badge con punto */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                        acc.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          acc.is_active ? "bg-emerald-500" : "bg-slate-400"
                        )}
                      />
                      <span>{acc.is_active ? "Activa" : "Inactiva"}</span>
                    </span>
                  </div>

                  {/* Zona 2: Banco y Titular */}
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug line-clamp-2">
                      {acc.bank_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Titular: <span className="font-medium text-slate-700 dark:text-slate-300">{acc.holder_name}</span>
                    </p>
                  </div>

                  {/* Zona 3: Saldo Disponible Destacado */}
                  <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        SALDO ACTUAL
                      </p>
                      <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
                        {currency.format(accountBalances[acc.id] ?? 0)}
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-blue-100/80 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Zona 3.5: Movimientos del Período (Si hay filtro de fecha activo) */}
                  {isPeriodFilterActive && (() => {
                    const act = periodActivityByAccount[acc.id] || {
                      income: 0,
                      expense: 0,
                      net: 0,
                      incomeCount: 0,
                      expenseCount: 0,
                      totalCount: 0,
                    };
                    return (
                      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                            <Calendar size={11} />
                            <span>{periodDescription}</span>
                          </span>
                          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.2 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">
                            {act.totalCount} {act.totalCount === 1 ? "movimiento" : "movimientos"}
                          </span>
                        </div>

                        {act.totalCount > 0 ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-2 border border-slate-200/60 dark:border-slate-800">
                                <p className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  + Ingresos ({act.incomeCount})
                                </p>
                                <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs mt-0.5">
                                  +{currency.format(act.income)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-2 border border-slate-200/60 dark:border-slate-800">
                                <p className="text-[9.5px] font-semibold text-rose-600 dark:text-rose-400">
                                  - Egresos ({act.expenseCount})
                                </p>
                                <p className="font-mono font-bold text-rose-700 dark:text-rose-300 text-xs mt-0.5">
                                  -{currency.format(act.expense)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                Flujo neto en período:
                              </span>
                              <span
                                className={cn(
                                  "font-mono font-extrabold text-xs",
                                  act.net >= 0
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-rose-700 dark:text-rose-300"
                                )}
                              >
                                {act.net >= 0 ? "+" : ""}
                                {currency.format(act.net)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-1 font-medium italic">
                            Sin movimientos registrados en este período ($ 0,00)
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Zona 4: Sub-panel de Datos Bancarios (CBU / Alias) */}
                  <div className="rounded-xl bg-slate-50/60 border border-slate-200/60 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/60 dark:bg-slate-800/30 dark:border-slate-700/40 dark:divide-slate-700/40">
                    <div className="px-1.5 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        CBU / CVU
                      </p>
                      <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                        {acc.cbu || "-"}
                      </p>
                    </div>
                    <div className="px-1.5 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Alias
                      </p>
                      <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                        {acc.alias || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Zona 5: Botonera de Acciones (Espaciosa y sin recortes) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMovementsAccount(acc)}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-900/60 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                      title="Ver movimientos"
                    >
                      <ArrowLeftRight size={14} className="text-sky-600 dark:text-sky-400" />
                      <span>Ver Movimientos</span>
                    </button>

                    {canWriteModule && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openAccountModal(acc)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          title="Editar cuenta"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBankAccount(acc.id)}
                          className={cn(
                            "h-9 w-9 inline-flex items-center justify-center rounded-xl border active:scale-95 transition-all shadow-2xs cursor-pointer",
                            acc.is_active
                              ? "border-amber-200 bg-white hover:bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-slate-800 dark:text-amber-400"
                              : "border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-slate-800 dark:text-emerald-400"
                          )}
                          title={acc.is_active ? "Desactivar cuenta" : "Activar cuenta"}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Nueva / Editar Cuenta Bancaria */}
        {accountModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAccountModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 my-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="px-6 py-4 border-b border-slate-200/90 dark:border-slate-800 flex justify-between items-center bg-slate-50/90 dark:bg-slate-800/70">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                      {editingAccount ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Configuración de datos y vinculación de cobros
                    </p>
                  </div>
                </div>
                <ModalCloseButton onClick={() => setAccountModalOpen(false)} />
              </header>

              <form onSubmit={handleSaveAccount} autoComplete="off" className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Banco o Entidad *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={accountForm.bank_name}
                    onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                    placeholder="Ej: Banco Galicia / Mercado Pago / Ualá"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Tipo de Cuenta
                    </label>
                    <select
                      value={accountForm.account_type}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, account_type: e.target.value as BankAccountType })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="cuenta_corriente">Cuenta corriente</option>
                      <option value="caja_ahorro">Caja de ahorro</option>
                      <option value="billetera_virtual">Billetera virtual</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Moneda
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      data-lpignore="true"
                      value={accountForm.currency_code}
                      onChange={(e) => setAccountForm({ ...accountForm, currency_code: e.target.value })}
                      placeholder="ARS"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Titular de la Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={accountForm.holder_name}
                    onChange={(e) => setAccountForm({ ...accountForm, holder_name: e.target.value })}
                    placeholder="Razón Social o Nombre del titular"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      CBU / CVU (22 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={22}
                      autoComplete="off"
                      data-lpignore="true"
                      value={accountForm.cbu}
                      onChange={(e) => setAccountForm({ ...accountForm, cbu: e.target.value })}
                      placeholder="0070000000000000000000"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Alias
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      data-lpignore="true"
                      value={accountForm.alias}
                      onChange={(e) => setAccountForm({ ...accountForm, alias: e.target.value })}
                      placeholder="mi.negocio.pos"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={accountForm.notes}
                    onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                    placeholder="Observaciones internas, sucursal, etc."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="acc_is_active"
                      checked={accountForm.is_active}
                      onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 h-4 w-4"
                    />
                    <label
                      htmlFor="acc_is_active"
                      className="text-xs text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                    >
                      Cuenta activa para registrar operaciones y transferencias
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="acc_is_pos_available"
                      checked={accountForm.is_pos_available}
                      onChange={(e) => setAccountForm({ ...accountForm, is_pos_available: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 dark:bg-slate-900 h-4 w-4"
                    />
                    <label
                      htmlFor="acc_is_pos_available"
                      className="text-xs text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                    >
                      Disponible para recibir pagos desde el modal de cobro del POS
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    Guardar Cuenta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Movimientos de Cuenta Bancaria */}
        {selectedMovementsAccount && (
          <BankAccountMovementsModal
            account={selectedMovementsAccount}
            onClose={() => setSelectedMovementsAccount(null)}
            canWrite={canWriteModule}
            onBalanceUpdated={loadMovementsAndBalances}
          />
        )}
      </div>
    </div>
  );
};
