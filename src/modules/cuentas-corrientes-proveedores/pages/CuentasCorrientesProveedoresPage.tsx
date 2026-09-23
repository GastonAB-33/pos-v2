import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { LoadingState } from "@/components/ui/UiStates";
import { IconButton } from "@/components/ui/IconButton";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import {
  Building2,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  Search,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { suppliersService } from "@/services/suppliers.service";
import { supplierCurrentAccountsService } from "@/services/supplier-current-accounts.service";
import { generalCashService } from "@/services/general-cash.service";
import { cashService } from "@/services/cash.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import type {
  Supplier,
  SupplierCurrentAccountMovement,
  BankAccount,
} from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CuentasCorrientesProveedoresPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();

  const canReadModule = canRead("cuentas_corrientes_proveedores");
  const canWriteModule = canWrite("cuentas_corrientes_proveedores");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [movements, setMovements] = useState<SupplierCurrentAccountMovement[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "debt" | "zero">("all");

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentSource, setPaymentSource] = useState<"general_cash" | "daily_cash" | "bank_transfer" | "other">("general_cash");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Adjustment form state
  const [adjustmentType, setAdjustmentType] = useState<"credit_note" | "debit_note">("credit_note");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const loadSuppliers = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [allSuppliers, accounts] = await Promise.all([
        suppliersService.getAllByTenant(tenantId),
        bankAccountsService.getAllByTenant(tenantId),
      ]);
      const activeSuppliers = allSuppliers.filter((s) => s.is_active);
      setSuppliers(activeSuppliers);
      setBankAccounts(accounts.filter((a) => a.is_active));

      if (!selectedSupplierId && activeSuppliers.length > 0) {
        setSelectedSupplierId(activeSuppliers[0].id);
      }
    } catch {
      toast.error("No se pudieron cargar los proveedores");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovements = async (supplierId: string) => {
    if (!tenantId) return;
    setIsMovementsLoading(true);
    try {
      const movs = await supplierCurrentAccountsService.getBySupplier(tenantId, supplierId);
      setMovements([...movs].reverse());
    } catch {
      toast.error("Error al cargar movimientos del proveedor");
    } finally {
      setIsMovementsLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, [tenantId]);

  useEffect(() => {
    if (selectedSupplierId) {
      void loadMovements(selectedSupplierId);
    } else {
      setMovements([]);
    }
  }, [selectedSupplierId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) ?? null,
    [suppliers, selectedSupplierId]
  );

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const balance = s.current_balance ?? 0;
      if (filterMode === "debt" && balance <= 0) return false;
      if (filterMode === "zero" && balance !== 0) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.code?.toLowerCase().includes(q) ?? false;
        const matchesPhone = s.phone?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesCode && !matchesPhone) return false;
      }
      return true;
    });
  }, [suppliers, filterMode, search]);

  const totalDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => {
      const bal = s.current_balance ?? 0;
      return bal > 0 ? acc + bal : acc;
    }, 0);
  }, [suppliers]);

  const suppliersWithDebtCount = useMemo(() => {
    return suppliers.filter((s) => (s.current_balance ?? 0) > 0).length;
  }, [suppliers]);

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !tenantId) return;

    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido a pagar");
      return;
    }

    setIsSubmitting(true);
    try {
      let notesSummary = paymentNotes.trim();

      if (paymentSource === "general_cash") {
        await generalCashService.createMovement(tenantId, {
          type: "expense",
          amount: numAmount,
          origin_type: "supplier_payment",
          concept: `Pago a proveedor: ${selectedSupplier.name}`,
          notes: notesSummary || null,
          created_by: user?.id ?? null,
        });
        notesSummary = `Pago efectivo de Caja Fuerte | ${notesSummary}`.trim();
      } else if (paymentSource === "daily_cash") {
        const openSession = user?.id
          ? (await cashService.getOpenSessionByUser(tenantId, user.id)) ?? (await cashService.getOpenSession(tenantId))
          : await cashService.getOpenSession(tenantId);

        if (openSession) {
          await cashService.createMovement(tenantId, {
            cash_session_id: openSession.id,
            movement_type: "expense",
            amount: numAmount,
            currency_code: "ARS",
            reference_type: "supplier_payment",
            reference_id: selectedSupplier.id,
            notes: `Pago proveedor: ${selectedSupplier.name}`,
            created_by: user?.id ?? null,
          });
          notesSummary = `Pago efectivo de Caja Diaria (Sesión #${openSession.id.slice(-6)}) | ${notesSummary}`.trim();
        } else {
          notesSummary = `Pago efectivo (Caja diaria no abierta) | ${notesSummary}`.trim();
        }
      } else if (paymentSource === "bank_transfer") {
        const bank = bankAccounts.find((b) => b.id === selectedBankId);
        notesSummary = `Transferencia bancaria ${bank ? `(${bank.bank_name})` : ""} | ${notesSummary}`.trim();
      }

      await supplierCurrentAccountsService.registerPayment(tenantId, {
        supplierId: selectedSupplier.id,
        amount: numAmount,
        notes: notesSummary || "Pago a cuenta corriente",
        createdBy: user?.id,
      });

      toast.success("Pago a proveedor registrado correctamente");
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      await loadSuppliers();
      await loadMovements(selectedSupplier.id);
    } catch {
      toast.error("Error al registrar el pago al proveedor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !tenantId) return;

    const numAmount = parseFloat(adjustmentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido para el ajuste");
      return;
    }
    if (!adjustmentNotes.trim()) {
      toast.error("El motivo u observación es obligatorio para el ajuste");
      return;
    }

    setIsSubmitting(true);
    try {
      if (adjustmentType === "credit_note") {
        await supplierCurrentAccountsService.registerPayment(tenantId, {
          supplierId: selectedSupplier.id,
          amount: numAmount,
          notes: `Nota de crédito / Descuento proveedor: ${adjustmentNotes.trim()}`,
          createdBy: user?.id,
        });
      } else {
        await supplierCurrentAccountsService.registerDebt(tenantId, {
          supplierId: selectedSupplier.id,
          amount: numAmount,
          notes: `Nota de débito / Recargo proveedor: ${adjustmentNotes.trim()}`,
          createdBy: user?.id,
        });
      }

      toast.success("Ajuste registrado correctamente");
      setIsAdjustmentModalOpen(false);
      setAdjustmentAmount("");
      setAdjustmentNotes("");
      await loadSuppliers();
      await loadMovements(selectedSupplier.id);
    } catch {
      toast.error("Error al registrar el ajuste de cuenta corriente");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tenantId) {
    return <PagePlaceholder title="Cta. cte. proveedores" description="No hay un comercio activo" />;
  }

  if (!canReadModule) {
    return (
      <PagePlaceholder
        title="Cta. cte. proveedores"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Cta. cte. proveedores"
      description="Control de deuda por compras a crédito, historial de comprobantes y pagos a proveedores"
    >
      <div className="cuentas-corrientes-proveedores-workspace space-y-4">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                Deuda Total con Proveedores
              </span>
              <Building2 className="h-5 w-5 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-900">
              {currency.format(totalDebt)}
            </p>
            <p className="mt-1 text-xs text-rose-700">
              Saldo acumulado a pagar
            </p>
          </article>

          <article className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Proveedores con Saldo Pendiente
              </span>
              <Truck className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900">
              {suppliersWithDebtCount}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              De {suppliers.length} proveedores activos
            </p>
          </article>

          <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Proveedores al Día
              </span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900">
              {suppliers.length - suppliersWithDebtCount}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Sin saldo deudor pendiente
            </p>
          </article>
        </div>

        {/* Master - Detail Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Suppliers List */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50/60">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proveedor por nombre o código..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-between gap-1 text-xs">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      filterMode === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("debt")}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      filterMode === "debt" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Con deuda
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("zero")}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      filterMode === "zero" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Al día
                  </button>
                </div>

                <IconButton
                  icon={RefreshCw}
                  label="Recargar"
                  onClick={loadSuppliers}
                  loading={isLoading}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-6">
                  <LoadingState message="Cargando proveedores..." />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No se encontraron proveedores.
                </div>
              ) : (
                filteredSuppliers.map((sup) => {
                  const active = sup.id === selectedSupplierId;
                  const balance = sup.current_balance ?? 0;
                  const hasDebt = balance > 0;

                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => setSelectedSupplierId(sup.id)}
                      className={`w-full text-left p-3.5 transition-colors ${
                        active ? "bg-slate-100 border-l-4 border-slate-900" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {sup.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Cód: {sup.code || "-"} {sup.phone ? `• Tel: ${sup.phone}` : ""}
                          </p>
                        </div>

                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                            hasDebt
                              ? "bg-rose-100 text-rose-800"
                              : balance < 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {currency.format(balance)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Supplier Details & History */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {selectedSupplier ? (
              <>
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedSupplier.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Código: {selectedSupplier.code || "-"} • Email: {selectedSupplier.email || "-"} • Tel: {selectedSupplier.phone || "-"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
                        Saldo Adeudado
                      </span>
                      <span
                        className={`text-xl font-bold ${
                          (selectedSupplier.current_balance ?? 0) > 0
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {currency.format(selectedSupplier.current_balance ?? 0)}
                      </span>
                    </div>

                    {canWriteModule && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAmount(
                              (selectedSupplier.current_balance ?? 0) > 0
                                ? String(selectedSupplier.current_balance)
                                : ""
                            );
                            setPaymentSource("general_cash");
                            setPaymentNotes("");
                            setIsPaymentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          Registrar Pago
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdjustmentAmount("");
                            setAdjustmentType("credit_note");
                            setAdjustmentNotes("");
                            setIsAdjustmentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition-colors"
                        >
                          Ajuste / Nota de Crédito
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Movements Table */}
                <div className="flex-1 overflow-y-auto">
                  {isMovementsLoading ? (
                    <div className="p-8">
                      <LoadingState message="Cargando cuenta corriente..." />
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">Sin movimientos registrados</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Las compras a crédito y pagos al proveedor se registrarán aquí.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Detalle / Notas</th>
                          <th className="py-2.5 px-3 text-right">Monto</th>
                          <th className="py-2.5 px-3 text-right">Saldo Deudor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {movements.map((mov) => {
                          const isDebt = mov.type === "debt";
                          const isPayment = mov.type === "payment";

                          return (
                            <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {new Date(mov.created_at).toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    isDebt
                                      ? "bg-rose-100 text-rose-800"
                                      : isPayment
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {isDebt ? (
                                    <>
                                      <ArrowUpRight className="h-3 w-3" /> Deuda (Compra)
                                    </>
                                  ) : isPayment ? (
                                    <>
                                      <ArrowDownLeft className="h-3 w-3" /> Pago
                                    </>
                                  ) : (
                                    "Ajuste"
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                                {mov.notes || "Sin observaciones"}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                                  isDebt ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {isDebt ? "+" : "-"} {currency.format(mov.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                {currency.format(mov.balance_after)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <Truck className="h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">
                  Selecciona un proveedor de la lista
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Registrar Pago a Proveedor */}
        {isPaymentModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-semibold text-slate-900">Registrar Pago a Proveedor</h3>
                  <p className="text-xs text-slate-500">{selectedSupplier.name}</p>
                </div>
                <ModalCloseButton onClick={() => setIsPaymentModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto a Pagar ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "0") setPaymentAmount("");
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Saldo total adeudado: {currency.format(selectedSupplier.current_balance ?? 0)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Medio / Origen de Fondos *
                  </label>
                  <select
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="general_cash">Efectivo de Caja Fuerte (Caja General)</option>
                    <option value="daily_cash">Efectivo de Caja diaria actual</option>
                    <option value="bank_transfer">Transferencia bancaria</option>
                    <option value="other">Cheque / Otro medio</option>
                  </select>
                </div>

                {paymentSource === "bank_transfer" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Cuenta Bancaria de Origen
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bank_name} - {acc.holder_name} ({acc.alias || acc.cbu?.slice(-4) || "Cta"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Observaciones / Nro de Recibo o Transferencia
                  </label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ej: Recibo proveedor N° 0001-00004523"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
                  >
                    {isSubmitting ? "Registrando..." : "Confirmar Pago"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Registrar Ajuste / Nota de Crédito */}
        {isAdjustmentModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-semibold text-slate-900">Ajuste de Cuenta Corriente</h3>
                  <p className="text-xs text-slate-500">{selectedSupplier.name}</p>
                </div>
                <ModalCloseButton onClick={() => setIsAdjustmentModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterAdjustment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tipo de Ajuste *
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as "credit_note" | "debit_note")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="credit_note">Nota de Crédito / Bonificación (Disminuye deuda)</option>
                    <option value="debit_note">Nota de Débito / Recargo (Aumenta deuda)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "0") setAdjustmentAmount("");
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Motivo / Observación *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    placeholder="Ej: Devolución de mercadería defectuosa NC 0002-1244"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
                  >
                    {isSubmitting ? "Registrando..." : "Guardar Ajuste"}
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
