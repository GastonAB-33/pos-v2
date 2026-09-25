import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  ArrowLeft,
  ArrowRight,
  PlusCircle,
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
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();

  const canReadModule = canRead("cuentas_corrientes_proveedores");
  const canWriteModule = canWrite("cuentas_corrientes_proveedores");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    searchParams.get("supplierId") ?? searchParams.get("proveedorId") ?? null
  );
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
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
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

  // Debt form state
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNotes, setDebtNotes] = useState("");

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

      const initialId = searchParams.get("supplierId") ?? searchParams.get("proveedorId");
      if (initialId && activeSuppliers.some((s) => s.id === initialId)) {
        setSelectedSupplierId(initialId);
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

  const handleRegisterDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !tenantId) return;

    const numAmount = parseFloat(debtAmount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido a adeudar mayor a 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await supplierCurrentAccountsService.registerDebt(tenantId, {
        supplierId: selectedSupplier.id,
        amount: numAmount,
        notes: debtNotes.trim() || "Compra a crédito / Deuda manual",
        createdBy: user?.id,
      });

      toast.success("Deuda registrada correctamente");
      setIsDebtModalOpen(false);
      setDebtAmount("");
      setDebtNotes("");
      await loadSuppliers();
      await loadMovements(selectedSupplier.id);
    } catch {
      toast.error("Error al registrar la deuda con el proveedor");
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

        {/* Flujo: Si hay un proveedor seleccionado, se muestra su pantalla de detalle a ancho completo */}
        {selectedSupplier ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            {/* Barra superior con botón Volver */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setSelectedSupplierId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <ArrowLeft size={14} />
                <span>Volver al listado de proveedores</span>
              </button>

              <IconButton
                icon={RefreshCw}
                label="Recargar cuenta corriente"
                onClick={() => {
                  void loadSuppliers();
                  void loadMovements(selectedSupplier.id);
                }}
                loading={isMovementsLoading}
              />
            </div>

            {/* Cabecera del Proveedor seleccionado */}
            <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedSupplier.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Código: {selectedSupplier.code || "-"} {selectedSupplier.phone ? `• Tel: ${selectedSupplier.phone}` : ""} {selectedSupplier.email ? `• Email: ${selectedSupplier.email}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
                    Saldo Adeudado
                  </span>
                  <span
                    className={`text-2xl font-bold tracking-tight ${
                      (selectedSupplier.current_balance ?? 0) > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : (selectedSupplier.current_balance ?? 0) < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {currency.format(selectedSupplier.current_balance ?? 0)}
                  </span>
                </div>

                {canWriteModule && (
                  <div className="flex flex-wrap items-center gap-2">
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition dark:bg-slate-100 dark:text-slate-900"
                    >
                      <DollarSign size={14} />
                      <span>Registrar Pago</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDebtAmount("");
                        setDebtNotes("");
                        setIsDebtModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-sm transition dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      <PlusCircle size={14} />
                      <span>Adeudar / Compra</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentAmount("");
                        setAdjustmentType("credit_note");
                        setAdjustmentNotes("");
                        setIsAdjustmentModalOpen(true);
                      }}
                      className="ui-btn-ghost text-xs py-2"
                    >
                      Ajuste / Nota de Crédito
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Movements Table */}
            <div className="flex-1 overflow-x-auto min-h-[300px]">
              {isMovementsLoading ? (
                <div className="p-12">
                  <LoadingState message="Cargando movimientos de cuenta corriente..." />
                </div>
              ) : movements.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sin movimientos registrados</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Las compras a crédito y pagos al proveedor se registrarán aquí.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200 sticky top-0 z-10 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Detalle / Notas</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                      <th className="py-3 px-4 text-right">Saldo Deudor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {movements.map((mov) => {
                      const isDebt = mov.type === "debt";
                      const isPayment = mov.type === "payment";

                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(mov.created_at).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isDebt
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : isPayment
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
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
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {mov.notes || "Sin observaciones"}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                              isDebt ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isDebt ? "+" : "-"} {currency.format(mov.amount)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {currency.format(mov.balance_after)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* Si no hay proveedor seleccionado, se muestra el listado completo a ancho completo */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            {/* Toolbar con buscador y filtros */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proveedor por nombre, código o teléfono..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "all"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Todos ({suppliers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("debt")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "debt"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Con deuda ({suppliersWithDebtCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("zero")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "zero"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Al día ({suppliers.length - suppliersWithDebtCount})
                  </button>
                </div>

                <IconButton
                  icon={RefreshCw}
                  label="Recargar proveedores"
                  onClick={loadSuppliers}
                  loading={isLoading}
                />
              </div>
            </div>

            {/* Tabla de proveedores */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12">
                  <LoadingState message="Cargando proveedores..." />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No se encontraron proveedores
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Prueba cambiando el término de búsqueda o el filtro.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Saldo Adeudado</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSuppliers.map((sup) => {
                      const balance = sup.current_balance ?? 0;
                      const hasDebt = balance > 0;

                      return (
                        <tr
                          key={sup.id}
                          onClick={() => setSelectedSupplierId(sup.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {sup.name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Cód: {sup.code || "-"} {sup.phone ? `• Tel: ${sup.phone}` : ""}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            <p>{sup.phone || "-"}</p>
                            {sup.email ? (
                              <p className="text-[11px] text-slate-400">{sup.email}</p>
                            ) : null}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                hasDebt
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : balance < 0
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {hasDebt ? "Con deuda" : balance < 0 ? "A favor" : "Al día"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span
                              className={`text-sm font-bold ${
                                hasDebt
                                  ? "text-rose-600 dark:text-rose-400"
                                  : balance < 0
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {currency.format(balance)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSupplierId(sup.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <span>Ingresar</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

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

        {/* Modal: Registrar Deuda / Compra a Crédito */}
        {isDebtModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden dark:bg-slate-900">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Registrar Deuda / Compra</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedSupplier.name}</p>
                </div>
                <ModalCloseButton onClick={() => setIsDebtModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterDebt} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">
                    Monto Adeudado ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "0") setDebtAmount("");
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                    Este monto aumentará el saldo pendiente con el proveedor.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">
                    Concepto / Detalle de Compra
                  </label>
                  <textarea
                    rows={3}
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    placeholder="Ej: Factura A 0001-0004921 / Remito mercadería..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDebtModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                  >
                    {isSubmitting ? "Registrando..." : "Confirmar Deuda"}
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
