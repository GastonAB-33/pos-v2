import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
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
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";
import {
  generalCashService,
  type GeneralCashSummary,
} from "@/services/general-cash.service";
import type { GeneralCashMovement, GeneralCashOriginType } from "@/types/entities";

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
  const user = useAuthStore((state) => state.user);
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
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [originFilter, setOriginFilter] = useState<string>("all");

  // Modals
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [amount, setAmount] = useState<string>("");
  const [originType, setOriginType] = useState<GeneralCashOriginType>("manual_income");
  const [concept, setConcept] = useState("");
  const [notes, setNotes] = useState("");

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

  const handleRegisterIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0");
      return;
    }
    if (!concept.trim()) {
      toast.error("El concepto es obligatorio");
      return;
    }
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      await generalCashService.createMovement(tenantId, {
        type: "income",
        amount: numAmount,
        origin_type: originType,
        concept: concept.trim(),
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      });
      toast.success("Ingreso a Caja Fuerte registrado correctamente");
      setIsIncomeModalOpen(false);
      setAmount("");
      setConcept("");
      setNotes("");
      await loadData();
    } catch {
      toast.error("Error al registrar el ingreso en Caja General");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0");
      return;
    }
    if (!concept.trim()) {
      toast.error("El concepto es obligatorio");
      return;
    }
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      await generalCashService.createMovement(tenantId, {
        type: "expense",
        amount: numAmount,
        origin_type: originType,
        concept: concept.trim(),
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      });
      toast.success("Egreso de Caja Fuerte registrado correctamente");
      setIsExpenseModalOpen(false);
      setAmount("");
      setConcept("");
      setNotes("");
      await loadData();
    } catch {
      toast.error("Error al registrar el egreso en Caja General");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tenantId) {
    return <PagePlaceholder title="Caja general" description="No hay un comercio activo" />;
  }

  if (!canReadModule) {
    return (
      <PagePlaceholder
        title="Caja general"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Caja general"
      description="Caja fuerte central: control de efectivo acumulado, transferencias a bancos y fondo de caja diaria"
    >
      <div className="caja-general-workspace space-y-3">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Saldo en Caja Fuerte
              </span>
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                <Vault className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-emerald-700">
              {formatMoney(summary.currentBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Efectivo real resguardado
            </p>
          </article>

          <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Ingresos por Cierres
              </span>
              <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatMoney(summary.inflowFromDailyCash)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Recaudación de cajas diarias
            </p>
          </article>

          <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Fondos de Apertura
              </span>
              <div className="p-1 rounded-md bg-amber-50 text-amber-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatMoney(summary.outflowToDailyCash)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Entregado a cajas diarias
            </p>
          </article>

          <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Total Movimientos
              </span>
              <div className="p-1 rounded-md bg-slate-100 text-slate-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {summary.totalMovements}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              +{formatMoney(summary.totalIncome)} / -{formatMoney(summary.totalExpense)}
            </p>
          </article>
        </div>

        {/* Toolbar & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <div className="relative w-full sm:w-56 min-w-[170px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar concepto o notas..."
                className="h-8 w-full pl-8 pr-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
              className="h-8 text-xs border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
            >
              <option value="all">Todos los tipos</option>
              <option value="income">Solo Ingresos (+)</option>
              <option value="expense">Solo Egresos (-)</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="h-8 text-xs border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
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

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Recargar movimientos"
              className="h-8 w-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            {canWriteModule && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAmount("");
                    setOriginType("manual_income");
                    setConcept("Aporte de capital a caja fuerte");
                    setNotes("");
                    setIsIncomeModalOpen(true);
                  }}
                  className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ingreso
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAmount("");
                    setOriginType("bank_deposit");
                    setConcept("Depósito en cuenta bancaria");
                    setNotes("");
                    setIsExpenseModalOpen(true);
                  }}
                  className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors shadow-xs"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Retiro / Egreso
                </button>
              </>
            )}
          </div>
        </div>

        {/* Movements Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <header className="px-3.5 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xs font-semibold text-slate-800">
                Historial de Movimientos de Caja Fuerte
              </h3>
              <p className="text-[11px] text-slate-400">
                {filteredMovements.length} movimientos registrados
              </p>
            </div>
          </header>

          {isLoading ? (
            <div className="p-6">
              <LoadingState message="Cargando movimientos de Caja General..." />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-8 text-center">
              <Vault className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">
                No se encontraron movimientos
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Los cierres de caja diaria y transferencias aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Fecha / Hora</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Origen / Motivo</th>
                    <th className="py-2 px-3">Concepto / Notas</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3 text-right">Saldo en Caja Fuerte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {filteredMovements.map((mov) => {
                    const isIncome = mov.type === "income";
                    const originInfo = originLabels[mov.origin_type] || {
                      label: mov.origin_type,
                      icon: Vault,
                    };
                    const IconComponent = originInfo.icon;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {formatDate(mov.created_at)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              isIncome
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-rose-50 text-rose-700 border border-rose-200/60"
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {isIncome ? "Ingreso" : "Egreso"}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <IconComponent className="h-3.5 w-3.5 text-slate-400" />
                            <span>{originInfo.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-medium text-slate-800">{mov.concept}</p>
                          {mov.notes && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{mov.notes}</p>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${
                            isIncome ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isIncome ? "+" : "-"} {formatMoney(mov.amount)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                          {formatMoney(mov.balance_after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Ingreso a Caja Fuerte */}
        {isIncomeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                <h3 className="text-xs font-semibold text-slate-800">Ingreso a Caja Fuerte</h3>
                <ModalCloseButton onClick={() => setIsIncomeModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterIncome} className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={handleNumericInputFocus}
                    onBlur={handleNumericInputBlur}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Origen / Tipo de Ingreso
                  </label>
                  <select
                    value={originType}
                    onChange={(e) => setOriginType(e.target.value as GeneralCashOriginType)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="manual_income">Aporte de capital / Fondos propios</option>
                    <option value="daily_cash_close">Cierre de Caja diaria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Aporte de socios para reserva de efectivo"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Observaciones adicionales
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles adicionales..."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsIncomeModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                  >
                    {isSubmitting ? "Registrando..." : "Registrar Ingreso"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Egreso / Retiro de Caja Fuerte */}
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                <h3 className="text-xs font-semibold text-slate-800">Retiro / Egreso de Caja Fuerte</h3>
                <ModalCloseButton onClick={() => setIsExpenseModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterExpense} className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={handleNumericInputFocus}
                    onBlur={handleNumericInputBlur}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    autoFocus
                  />
                  {summary.currentBalance < Number(amount) && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Nota: El monto supera el saldo disponible ({formatMoney(summary.currentBalance)}).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Destino del Dinero
                  </label>
                  <select
                    value={originType}
                    onChange={(e) => {
                      const val = e.target.value as GeneralCashOriginType;
                      setOriginType(val);
                      if (val === "bank_deposit") setConcept("Depósito en cuenta bancaria");
                      else if (val === "supplier_payment") setConcept("Pago a proveedor en efectivo");
                      else if (val === "daily_cash_open") setConcept("Fondo inicial apertura caja diaria");
                      else setConcept("Retiro de socios / Gastos");
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="bank_deposit">Depósito en cuenta bancaria</option>
                    <option value="supplier_payment">Pago a proveedor en efectivo</option>
                    <option value="daily_cash_open">Fondo para apertura de Caja diaria</option>
                    <option value="manual_expense">Retiro de socios / Ganancias / Gastos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Depósito efectivo Banco Galicia"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Observaciones / Comprobante
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Nro de ticket de depósito bancario, recibo, etc."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                  >
                    {isSubmitting ? "Registrando..." : "Registrar Egreso"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PagePlaceholder>
  );
};
