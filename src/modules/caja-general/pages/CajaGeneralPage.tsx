import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { LoadingState } from "@/components/ui/UiStates";
import { IconButton } from "@/components/ui/IconButton";
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

const originLabels: Record<GeneralCashOriginType, { label: string; icon: typeof Vault }> = {
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
        [...allMovements].sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
      setSummary(cashSummary);
    } catch {
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
      <div className="caja-general-workspace space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Saldo en Caja Fuerte
              </span>
              <Vault className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900">
              {currency.format(summary.currentBalance)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Efectivo real resguardado
            </p>
          </article>

          <article className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                Ingresos por Cierres
              </span>
              <ArrowDownLeft className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-blue-900">
              {currency.format(summary.inflowFromDailyCash)}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              Recaudación de cajas diarias
            </p>
          </article>

          <article className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Fondos de Apertura
              </span>
              <ArrowUpRight className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900">
              {currency.format(summary.outflowToDailyCash)}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Entregado a cajas diarias
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                Total Movimientos
              </span>
              <DollarSign className="h-5 w-5 text-slate-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {summary.totalMovements}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {currency.format(summary.totalIncome)} in / {currency.format(summary.totalExpense)} out
            </p>
          </article>
        </div>

        {/* Toolbar & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por concepto o notas..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">Todos los tipos</option>
              <option value="income">Solo Ingresos (+)</option>
              <option value="expense">Solo Egresos (-)</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
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

          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Recargar"
              onClick={loadData}
              loading={isLoading}
            />

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
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Ingreso a Caja Fuerte
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Retiro / Egreso
                </button>
              </>
            )}
          </div>
        </div>

        {/* Movements Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Historial de Movimientos de Caja Fuerte
              </h3>
              <p className="text-xs text-slate-500">
                {filteredMovements.length} movimientos registrados
              </p>
            </div>
          </header>

          {isLoading ? (
            <div className="p-8">
              <LoadingState message="Cargando movimientos de Caja General..." />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-12 text-center">
              <Vault className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">
                No se encontraron movimientos
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Los cierres de caja diaria y transferencias manuales aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Origen / Motivo</th>
                    <th className="py-3 px-4">Concepto / Notas</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-right">Saldo en Caja Fuerte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((mov) => {
                    const isIncome = mov.type === "income";
                    const originInfo = originLabels[mov.origin_type] || {
                      label: mov.origin_type,
                      icon: Vault,
                    };
                    const IconComponent = originInfo.icon;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {new Date(mov.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isIncome
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
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
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <IconComponent className="h-3.5 w-3.5 text-slate-400" />
                            <span>{originInfo.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-medium text-slate-900">{mov.concept}</p>
                          {mov.notes && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{mov.notes}</p>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold text-xs whitespace-nowrap ${
                            isIncome ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isIncome ? "+" : "-"} {currency.format(mov.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-xs text-slate-800 whitespace-nowrap">
                          {currency.format(mov.balance_after)}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-900">Ingreso a Caja Fuerte</h3>
                <ModalCloseButton onClick={() => setIsIncomeModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterIncome} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "0") setAmount("");
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Origen / Tipo de Ingreso
                  </label>
                  <select
                    value={originType}
                    onChange={(e) => setOriginType(e.target.value as GeneralCashOriginType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="manual_income">Aporte de capital / Fondos propios</option>
                    <option value="daily_cash_close">Cierre de Caja diaria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Aporte de socios para reserva de efectivo"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Observaciones adicionales
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles adicionales..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsIncomeModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-900">Retiro / Egreso de Caja Fuerte</h3>
                <ModalCloseButton onClick={() => setIsExpenseModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterExpense} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "0") setAmount("");
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                  {summary.currentBalance < Number(amount) && (
                    <p className="text-xs text-amber-600 mt-1">
                      Nota: El monto supera el saldo disponible en caja fuerte ({currency.format(summary.currentBalance)}).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="bank_deposit">Depósito en cuenta bancaria</option>
                    <option value="supplier_payment">Pago a proveedor en efectivo</option>
                    <option value="daily_cash_open">Fondo para apertura de Caja diaria</option>
                    <option value="manual_expense">Retiro de socios / Ganancias / Gastos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Depósito efectivo Banco Galicia"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Observaciones / Comprobante
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Nro de ticket de depósito bancario, recibo provisorio, etc."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
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
