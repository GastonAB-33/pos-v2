import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  Plus,
  X,
  SlidersHorizontal,
  FilterX,
  Calendar,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { suppliersService } from "@/services/suppliers.service";
import { supplierCurrentAccountsService } from "@/services/supplier-current-accounts.service";
import { generalCashService } from "@/services/general-cash.service";
import { cashService } from "@/services/cash.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { auditService } from "@/services/audit.service";
import {
  SupplierPaymentModal,
  type SupplierPaymentSubmitPayload,
} from "@/modules/cuentas-corrientes-proveedores/components/SupplierPaymentModal";
import { SupplierForm } from "@/modules/proveedores/components/SupplierForm";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import { toSupplierServiceInput } from "@/modules/proveedores/utils/supplier-input";
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
  const canWriteProveedores = canWrite("proveedores");
  const canCreateSupplier = canWriteProveedores || canWriteModule;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    searchParams.get("supplierId") ?? searchParams.get("proveedorId") ?? null
  );
  const [movements, setMovements] = useState<SupplierCurrentAccountMovement[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);

  // Search & Filter
  type SupplierSort = "debt_desc" | "debt_asc" | "name_asc" | "name_desc";
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "debt" | "zero">("debt");
  const [sortBy, setSortBy] = useState<SupplierSort>("debt_desc");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  useBodyScrollLock(isAdvancedFiltersOpen);

  // Movements Search & Filter
  const [movementSearch, setMovementSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState<"all" | "debt" | "payment">("all");

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  const handleCreateSupplierSubmit = async (values: SupplierFormValues) => {
    if (!tenantId) return;
    setIsSubmittingSupplier(true);
    try {
      const created = await suppliersService.create(
        tenantId,
        toSupplierServiceInput(values)
      );

      if (created) {
        await auditService.createSafe(tenantId, {
          user_id: user?.id ?? null,
          module: "proveedores",
          action: "create",
          entity_type: "supplier",
          entity_id: created.id,
          description: `Proveedor creado desde Cuentas Corrientes: ${created.name}`,
          metadata: { name: created.name },
        });

        toast.success(`Proveedor "${created.name}" creado con éxito`);
        setIsCreateSupplierModalOpen(false);
        await loadSuppliers();
        setSelectedSupplierId(created.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el proveedor");
    } finally {
      setIsSubmittingSupplier(false);
    }
  };



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
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
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
    const list = suppliers.filter((s) => {
      const balance = s.current_balance ?? 0;
      if (filterMode === "debt" && balance <= 0) return false;
      if (filterMode === "zero" && balance !== 0) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.code?.toLowerCase().includes(q) ?? false;
        const matchesPhone = s.phone?.toLowerCase().includes(q) ?? false;
        const matchesTaxId = s.tax_id?.toLowerCase().includes(q) ?? false;
        const matchesEmail = s.email?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesCode && !matchesPhone && !matchesTaxId && !matchesEmail) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const balA = a.current_balance ?? 0;
      const balB = b.current_balance ?? 0;
      if (sortBy === "debt_desc") return balB - balA;
      if (sortBy === "debt_asc") return balA - balB;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [suppliers, filterMode, search, sortBy]);

  const activeAdvancedFiltersCount =
    (filterMode !== "all" ? 1 : 0) +
    (sortBy !== "debt_desc" ? 1 : 0);

  const paginatedSuppliers = usePagination(
    filteredSuppliers,
    10,
    `${search}_${filterMode}_${sortBy}`
  );

  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (movementFilter === "debt" && mov.type !== "debt") return false;
      if (movementFilter === "payment" && mov.type !== "payment") return false;

      if (movementSearch.trim()) {
        const q = movementSearch.toLowerCase();
        const matchNotes = mov.notes?.toLowerCase().includes(q) ?? false;
        const matchAmount = mov.amount.toString().includes(q);
        if (!matchNotes && !matchAmount) return false;
      }
      return true;
    });
  }, [movements, movementFilter, movementSearch]);

  const debtsCount = useMemo(
    () => movements.filter((m) => m.type === "debt").length,
    [movements]
  );
  const paymentsCount = useMemo(
    () => movements.filter((m) => m.type === "payment").length,
    [movements]
  );

  const paginatedMovements = usePagination(
    filteredMovements,
    15,
    `${movementSearch}_${movementFilter}_${selectedSupplierId}`
  );

  const totalDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => {
      const bal = s.current_balance ?? 0;
      return bal > 0 ? acc + bal : acc;
    }, 0);
  }, [suppliers]);

  const suppliersWithDebtCount = useMemo(() => {
    return suppliers.filter((s) => (s.current_balance ?? 0) > 0).length;
  }, [suppliers]);

  const handleSupplierPaymentSubmit = async (payload: SupplierPaymentSubmitPayload) => {
    if (!selectedSupplier || !tenantId) return;

    setIsSubmitting(true);
    try {
      const openSession = user?.id
        ? (await cashService.getOpenSessionByUser(tenantId, user.id)) ??
          (await cashService.getOpenSession(tenantId))
        : await cashService.getOpenSession(tenantId);

      const notesParts: string[] = [];
      if (payload.notes) notesParts.push(payload.notes);

      for (const alloc of payload.allocations) {
        if (alloc.code === "general_cash") {
          await generalCashService.createMovement(tenantId, {
            type: "expense",
            amount: alloc.amount,
            origin_type: "supplier_payment",
            concept: `Pago a proveedor: ${selectedSupplier.name}`,
            notes: payload.notes || null,
            created_by: user?.id ?? null,
          });
          notesParts.push(`Caja Fuerte: ${currency.format(alloc.amount)}`);
        } else if (alloc.code === "daily_cash") {
          if (openSession) {
            await cashService.createMovement(tenantId, {
              cash_session_id: openSession.id,
              movement_type: "expense",
              amount: alloc.amount,
              currency_code: "ARS",
              reference_type: "supplier_payment",
              reference_id: selectedSupplier.id,
              notes: `Pago proveedor: ${selectedSupplier.name}`,
              created_by: user?.id ?? null,
            });
            notesParts.push(`Caja Diaria: ${currency.format(alloc.amount)}`);
          } else {
            notesParts.push(`Efectivo: ${currency.format(alloc.amount)}`);
          }
        } else if (alloc.code === "bank_transfer") {
          if (alloc.bankAccountId) {
            try {
              await bankAccountMovementsService.createMovement(tenantId, {
                bank_account_id: alloc.bankAccountId,
                type: "expense",
                origin_type: "supplier_payment",
                concept: `Pago a proveedor: ${selectedSupplier.name}`,
                amount: alloc.amount,
                reference_id: selectedSupplier.id,
                voucher_number: null,
                notes: payload.notes || null,
                created_by: user?.id ?? null,
              });
            } catch (bankErr) {
              console.error("Error al registrar egreso en cuenta bancaria:", bankErr);
            }
            notesParts.push(`${alloc.name}: ${currency.format(alloc.amount)}`);
          } else {
            notesParts.push(`Transferencia: ${currency.format(alloc.amount)}`);
          }
        } else if (alloc.code === "cheque") {
          notesParts.push(`Cheque: ${currency.format(alloc.amount)}`);
        } else {
          notesParts.push(`${alloc.name}: ${currency.format(alloc.amount)}`);
        }
      }

      const finalNotes = notesParts.join(" | ") || "Pago a cuenta corriente";

      await supplierCurrentAccountsService.registerPayment(tenantId, {
        supplierId: selectedSupplier.id,
        amount: payload.totalAmount,
        notes: finalNotes,
        createdBy: user?.id,
      });

      toast.success("Pago a proveedor registrado correctamente");
      setIsPaymentModalOpen(false);
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
            CONTABLE › CTA. CTE. PROVEEDORES
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Cuentas Corrientes Proveedores
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Control de deuda por compras a crédito, historial de comprobantes y pagos a proveedores
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              void loadSuppliers();
              if (selectedSupplierId) {
                void loadMovements(selectedSupplierId);
              }
            }}
            disabled={isLoading || isMovementsLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading || isMovementsLoading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {canCreateSupplier && (
            <button
              type="button"
              onClick={() => setIsCreateSupplierModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Proveedor</span>
            </button>
          )}
        </div>
      </header>

      <div className="cuentas-corrientes-proveedores-workspace space-y-6">
        {/* KPI Metrics: solo visibles en el listado general de proveedores */}
        {!selectedSupplier && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <article className="rounded-2xl sm:rounded-3xl border border-rose-200/80 bg-rose-50/60 p-5 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Deuda Total con Proveedores
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-100 sm:text-3xl">
                {currency.format(totalDebt)}
              </p>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                Saldo acumulado a pagar
              </p>
            </article>

            <article className="rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-amber-50/60 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Proveedores con Saldo Pendiente
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  <Truck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-100 sm:text-3xl">
                {suppliersWithDebtCount}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                De {suppliers.length} proveedores activos
              </p>
            </article>

            <article className="rounded-2xl sm:rounded-3xl border border-emerald-200/80 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Proveedores al Día
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100 sm:text-3xl">
                {suppliers.length - suppliersWithDebtCount}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Sin saldo deudor pendiente
              </p>
            </article>
          </div>
        )}

        {/* Flujo: Si hay un proveedor seleccionado, se muestra su pantalla de detalle a ancho completo */}
        {selectedSupplier ? (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm flex flex-col overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            {/* Barra superior con botón Volver */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200/90 bg-slate-50/80 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setSelectedSupplierId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Volver al listado de proveedores</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void loadSuppliers();
                  void loadMovements(selectedSupplier.id);
                }}
                disabled={isMovementsLoading}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isMovementsLoading ? "animate-spin" : ""}`} />
                <span>Recargar</span>
              </button>
            </div>

            {/* Cabecera del Proveedor seleccionado */}
            <div className="p-4 sm:p-6 border-b border-slate-200/90 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedSupplier.name}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 dark:text-slate-400">
                  <span>
                    Código: <strong className="text-slate-700 dark:text-slate-300">{selectedSupplier.code || "-"}</strong>
                  </span>
                  {selectedSupplier.phone && <span>• Tel: {selectedSupplier.phone}</span>}
                  {selectedSupplier.email && <span>• Email: {selectedSupplier.email}</span>}
                  {selectedSupplier.tax_id && <span>• CUIT: {selectedSupplier.tax_id}</span>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                    Saldo Adeudado
                  </span>
                  <span
                    className={cn(
                      "text-2xl sm:text-3xl font-extrabold tracking-tight",
                      (selectedSupplier.current_balance ?? 0) > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : (selectedSupplier.current_balance ?? 0) < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {currency.format(selectedSupplier.current_balance ?? 0)}
                  </span>
                </div>

                {canWriteModule && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaymentModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 rounded-2xl shadow-sm transition dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 active:scale-95 cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-sm transition dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 cursor-pointer"
                    >
                      Ajuste / Nota de Crédito
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar de Búsqueda y Filtros de Movimientos */}
            <div className="p-3 sm:p-4 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="flex flex-1 min-w-0 items-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-900 transition-all">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="search"
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    placeholder="Buscar por detalle, nota o monto..."
                    className="flex-1 min-w-0 border-0 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                  {movementSearch && (
                    <button
                      type="button"
                      onClick={() => setMovementSearch("")}
                      className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full"
                      title="Limpiar búsqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-1 dark:border-slate-700/80 dark:bg-slate-900 shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setMovementFilter("all")}
                    className={cn(
                      "px-3 py-1 rounded-lg sm:rounded-xl text-xs font-semibold transition cursor-pointer shrink-0",
                      movementFilter === "all"
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    Todos ({movements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementFilter("debt")}
                    className={cn(
                      "px-3 py-1 rounded-lg sm:rounded-xl text-xs font-semibold transition cursor-pointer shrink-0",
                      movementFilter === "debt"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                    )}
                  >
                    Deudas ({debtsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementFilter("payment")}
                    className={cn(
                      "px-3 py-1 rounded-lg sm:rounded-xl text-xs font-semibold transition cursor-pointer shrink-0",
                      movementFilter === "payment"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                    )}
                  >
                    Pagos ({paymentsCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Movements Content */}
            <div className="flex-1 min-h-[300px]">
              {isMovementsLoading ? (
                <div className="p-4 sm:p-8">
                  <LoadingState
                    message="Cargando movimientos de cuenta corriente..."
                    description="Sincronizando comprobantes de compra, pagos y notas de crédito..."
                  />
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sin movimientos registrados
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {movementSearch || movementFilter !== "all"
                      ? "No hay movimientos que coincidan con los filtros aplicados."
                      : "Las compras a crédito y pagos al proveedor se registrarán aquí."}
                  </p>
                </div>
              ) : (
                <>
                  {/* ============================================================== */}
                  {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
                  {/* ============================================================== */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200/90 sticky top-0 z-10 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Detalle / Notas</th>
                          <th className="py-3 px-4 text-right">Monto</th>
                          <th className="py-3 px-4 text-right">Saldo Deudor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginatedMovements.pageItems.map((mov) => {
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
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                                    isDebt
                                      ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60"
                                      : isPayment
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60"
                                      : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60"
                                  )}
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
                                className={cn(
                                  "py-3 px-4 text-right font-bold whitespace-nowrap",
                                  isDebt ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                )}
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
                  </div>

                  {/* ============================================================== */}
                  {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
                  {/* ============================================================== */}
                  <div className="block md:hidden p-3 space-y-3">
                    {paginatedMovements.pageItems.map((mov) => {
                      const isDebt = mov.type === "debt";
                      const isPayment = mov.type === "payment";

                      return (
                        <article
                          key={mov.id}
                          className={cn(
                            "rounded-2xl border p-3.5 shadow-xs space-y-2.5 transition-all",
                            isDebt
                              ? "border-rose-200/90 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/15"
                              : isPayment
                              ? "border-emerald-200/90 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/15"
                              : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900"
                          )}
                        >
                          {/* Zona 1: Fecha y Tipo de movimiento */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <Calendar size={13} className="shrink-0 text-slate-400" />
                              <span>
                                {new Date(mov.created_at).toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                                isDebt
                                  ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800"
                                  : isPayment
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                              )}
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
                          </div>

                          {/* Zona 2: Detalle / Observaciones */}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug">
                              {mov.notes || "Sin observaciones"}
                            </p>
                          </div>

                          {/* Zona 3: Monto & Saldo Posterior */}
                          <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                MONTO
                              </p>
                              <p
                                className={cn(
                                  "text-base font-extrabold leading-tight",
                                  isDebt
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {isDebt ? "+" : "-"} {currency.format(mov.amount)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                SALDO POSTERIOR
                              </p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {currency.format(mov.balance_after)}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Paginación de Movimientos */}
                  <div className="p-3 border-t border-slate-200/90 dark:border-slate-800">
                    <PaginationControls
                      currentPage={paginatedMovements.currentPage}
                      pageCount={paginatedMovements.pageCount}
                      startItem={paginatedMovements.startItem}
                      endItem={paginatedMovements.endItem}
                      totalItems={paginatedMovements.totalItems}
                      onPageChange={paginatedMovements.setCurrentPage}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Si no hay proveedor seleccionado, se muestra el listado completo a ancho completo */
          <div className="space-y-4">
            {/* Toolbar con buscador y filtros unificados en tarjeta elevada (Mobile Filter Encapsulation Pattern) */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
              <div className="flex flex-col md:flex-row md:items-center gap-2.5">
                {/* 1. Buscador */}
                <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
                  <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar proveedor por nombre, código o teléfono..."
                    className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
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

                {/* 2. Filtros para DESKTOP (hidden md:flex) */}
                <div className="hidden md:flex items-center gap-2">
                  <div className="flex gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-800/50">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                        filterMode === "all"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      Todos ({suppliers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("debt")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                        filterMode === "debt"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                      )}
                    >
                      Con deuda ({suppliersWithDebtCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("zero")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                        filterMode === "zero"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                      )}
                    >
                      Al día ({suppliers.length - suppliersWithDebtCount})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAdvancedFiltersOpen(true)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs",
                      activeAdvancedFiltersCount > 0 &&
                        "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                    )}
                    title="Más filtros y ordenamiento"
                  >
                    <SlidersHorizontal size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Filtros</span>
                    {activeAdvancedFiltersCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {activeAdvancedFiltersCount}
                      </span>
                    )}
                  </button>

                  {(search || activeAdvancedFiltersCount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFilterMode("all");
                        setSortBy("debt_desc");
                      }}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer shadow-2xs"
                      title="Restablecer filtros"
                    >
                      <FilterX size={15} />
                    </button>
                  )}
                </div>

                {/* 3. Botón de Filtros Avanzados para MÓVIL (debajo del buscador, ancho completo: flex md:hidden) */}
                <div className="flex md:hidden items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedFiltersOpen(true)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs",
                      activeAdvancedFiltersCount > 0 &&
                        "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                    )}
                  >
                    <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
                    <span>Filtros avanzados</span>
                    {activeAdvancedFiltersCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {activeAdvancedFiltersCount}
                      </span>
                    )}
                  </button>

                  {(search || activeAdvancedFiltersCount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFilterMode("all");
                        setSortBy("debt_desc");
                      }}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0"
                      title="Limpiar filtros"
                    >
                      <FilterX size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Listado de Proveedores: Desktop Table vs Mobile Cards */}
            <div className="space-y-4">
              {isLoading ? (
                <LoadingState
                  message="Cargando cuentas corrientes de proveedores..."
                  description="Consultando listado de proveedores activos y saldos adeudados..."
                />
              ) : filteredSuppliers.length === 0 ? (
                <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-12 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No se encontraron proveedores
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Prueba cambiando el término de búsqueda o el filtro.
                  </p>
                  {canCreateSupplier && (
                    <button
                      type="button"
                      onClick={() => setIsCreateSupplierModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-sm transition cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Crear nuevo proveedor</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* ============================================================== */}
                  {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
                  {/* ============================================================== */}
                  <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200/90 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Proveedor</th>
                            <th className="py-3 px-4">Contacto</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4 text-right">Saldo Adeudado</th>
                            <th className="py-3 px-4 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {paginatedSuppliers.pageItems.map((sup) => {
                            const balance = sup.current_balance ?? 0;
                            const hasDebt = balance > 0;
                            const isCredit = balance < 0;

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
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                                      hasDebt
                                        ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60"
                                        : isCredit
                                        ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60"
                                        : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        hasDebt ? "bg-rose-500" : isCredit ? "bg-blue-500" : "bg-emerald-500"
                                      )}
                                    />
                                    <span>{hasDebt ? "Con deuda" : isCredit ? "A favor" : "Al día"}</span>
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <span
                                    className={cn(
                                      "text-sm font-bold",
                                      hasDebt
                                        ? "text-rose-600 dark:text-rose-400"
                                        : isCredit
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    )}
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer active:scale-95"
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
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
                  {/* ============================================================== */}
                  <div className="block md:hidden space-y-3">
                    {paginatedSuppliers.pageItems.map((sup) => {
                      const balance = sup.current_balance ?? 0;
                      const hasDebt = balance > 0;
                      const isCredit = balance < 0;

                      return (
                        <article
                          key={sup.id}
                          onClick={() => setSelectedSupplierId(sup.id)}
                          className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 transition-all active:scale-[0.99] cursor-pointer hover:border-blue-400 dark:hover:border-blue-600"
                        >
                          {/* Zona 1: Badges superiores */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                                {sup.code ? `CÓD: ${sup.code}` : "PROVEEDOR"}
                              </span>
                            </div>

                            {/* Badge de Estado con punto de color */}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                                hasDebt
                                  ? "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
                                  : isCredit
                                  ? "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  hasDebt ? "bg-rose-500 animate-pulse" : isCredit ? "bg-blue-500" : "bg-emerald-500"
                                )}
                              />
                              <span>{hasDebt ? "Con deuda" : isCredit ? "A favor" : "Al día"}</span>
                            </span>
                          </div>

                          {/* Zona 2: Nombre del Proveedor */}
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                              {sup.name}
                            </h3>
                          </div>

                          {/* Zona 3: Saldo Adeudado & Acciones Circulares */}
                          <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                SALDO ADEUDADO
                              </p>
                              <p
                                className={cn(
                                  "text-base sm:text-lg font-extrabold leading-tight",
                                  hasDebt
                                    ? "text-rose-600 dark:text-rose-400"
                                    : isCredit
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {currency.format(balance)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {canWriteModule && hasDebt && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSupplierId(sup.id);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-blue-200/90 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-300 active:scale-95 transition-all shadow-2xs"
                                  title="Registrar pago rápido"
                                >
                                  <DollarSign size={15} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSupplierId(sup.id);
                                }}
                                className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs"
                                title="Ingresar a cuenta corriente"
                              >
                                <ArrowRight size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Zona 4: Sub-panel secundario de contacto */}
                          {(sup.phone || sup.email || sup.tax_id) && (
                            <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 p-2 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:divide-slate-700/60 text-xs">
                              <div className="px-1 truncate">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  TELÉFONO
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                  {sup.phone || "-"}
                                </span>
                              </div>
                              <div className="px-1 truncate">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  {sup.tax_id ? "CUIT / DOC" : "EMAIL"}
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                  {sup.tax_id || sup.email || "-"}
                                </span>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  {/* Paginación de Proveedores */}
                  <PaginationControls
                    currentPage={paginatedSuppliers.currentPage}
                    pageCount={paginatedSuppliers.pageCount}
                    startItem={paginatedSuppliers.startItem}
                    endItem={paginatedSuppliers.endItem}
                    totalItems={paginatedSuppliers.totalItems}
                    onPageChange={paginatedSuppliers.setCurrentPage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal: Filtros Avanzados para Proveedores */}
        {isAdvancedFiltersOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setIsAdvancedFiltersOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                    <SlidersHorizontal size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Filtros avanzados
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      Filtrar y ordenar proveedores en cuenta corriente
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdvancedFiltersOpen(false)}
                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-750 transition-all cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Controles del Modal */}
              <div className="space-y-3.5">
                {/* 1. Estado de Cuenta */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Estado de cuenta
                  </label>
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value as "all" | "debt" | "zero")}
                    className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                  >
                    <option value="all">Todos los proveedores ({suppliers.length})</option>
                    <option value="debt">Con saldo pendiente / Deuda ({suppliersWithDebtCount})</option>
                    <option value="zero">Al día sin saldo adeudado ({suppliers.length - suppliersWithDebtCount})</option>
                  </select>
                </div>

                {/* 2. Criterio de Ordenamiento */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Ordenar listado por
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SupplierSort)}
                    className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                  >
                    <option value="debt_desc">Mayor saldo adeudado primero</option>
                    <option value="debt_asc">Menor saldo adeudado primero</option>
                    <option value="name_asc">Nombre del proveedor (A - Z)</option>
                    <option value="name_desc">Nombre del proveedor (Z - A)</option>
                  </select>
                </div>
              </div>

              {/* Footer con botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("all");
                    setSortBy("debt_desc");
                    setIsAdvancedFiltersOpen(false);
                  }}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
                >
                  Restablecer
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvancedFiltersOpen(false)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal: Registrar Pago a Proveedor (Diseño POS) */}
        {isPaymentModalOpen && selectedSupplier && (
          <SupplierPaymentModal
            open={isPaymentModalOpen}
            supplier={selectedSupplier}
            bankAccounts={bankAccounts}
            disabled={isSubmitting}
            onClose={() => setIsPaymentModalOpen(false)}
            onSubmit={handleSupplierPaymentSubmit}
          />
        )}

        {/* Modal: Registrar Deuda / Compra a Crédito */}
        {isDebtModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 dark:bg-slate-900 dark:border-slate-800">
              <header className="px-6 py-4 border-b border-slate-200/90 flex justify-between items-center bg-slate-50/90 dark:bg-slate-800/70 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Registrar Deuda / Compra</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedSupplier.name}</p>
                </div>
                <ModalCloseButton onClick={() => setIsDebtModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterDebt} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Este monto aumentará el saldo pendiente con el proveedor.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Concepto / Detalle de Compra
                  </label>
                  <textarea
                    rows={3}
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    placeholder="Ej: Factura A 0001-0004921 / Remito mercadería..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDebtModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50 transition"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 dark:bg-slate-900 dark:border-slate-800">
              <header className="px-6 py-4 border-b border-slate-200/90 flex justify-between items-center bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/70">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Ajuste de Cuenta Corriente</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedSupplier.name}</p>
                </div>
                <ModalCloseButton onClick={() => setIsAdjustmentModalOpen(false)} />
              </header>

              <form onSubmit={handleRegisterAdjustment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Tipo de Ajuste *
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as "credit_note" | "debit_note")}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="credit_note">Nota de Crédito / Bonificación (Disminuye deuda)</option>
                    <option value="debit_note">Nota de Débito / Recargo (Aumenta deuda)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Motivo / Observación *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    placeholder="Ej: Devolución de mercadería defectuosa NC 0002-1244"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition"
                  >
                    {isSubmitting ? "Registrando..." : "Guardar Ajuste"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Crear Proveedor */}
        {isCreateSupplierModalOpen ? (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-800">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200/90 pb-3 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Nuevo proveedor</h3>
                <IconButton
                  icon={X}
                  label="Cerrar"
                  onClick={() => setIsCreateSupplierModalOpen(false)}
                  disabled={isSubmittingSupplier}
                />
              </div>
              <SupplierForm
                mode="create"
                disabled={isSubmittingSupplier}
                onCancel={() => setIsCreateSupplierModalOpen(false)}
                onSubmit={handleCreateSupplierSubmit}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};
