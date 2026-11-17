import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { LoadingState } from "@/components/ui/UiStates";
import { CurrentAccountAdjustmentModal } from "@/modules/clientes/components/CurrentAccountAdjustmentModal";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
import { CurrentAccountPaymentModal } from "@/modules/clientes/components/CurrentAccountPaymentModal";
import { CustomerManualMovementModal } from "@/modules/cuentas-corrientes/components/CustomerManualMovementModal";
import { ManualPackageLoanModal } from "@/modules/clientes/components/ManualPackageLoanModal";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { customersService } from "@/services/customers.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { auditService } from "@/services/audit.service";
import { useToast } from "@/components/ui/useToast";
import { useEffect, useMemo, useState } from "react";
import { DollarSign, Package, PlusCircle } from "lucide-react";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";
import { parseCustomerPackageDebts, serializeCustomerPackageDebts, useTenantReturnablePackages } from "@/utils/returnable-packages";
import type { Customer } from "@/types/entities";

interface CustomerCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  customer: Customer;
  canWrite: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
  isEditModalOpen?: boolean;
  onEditModalOpenChange?: (open: boolean) => void;
  refreshKey?: number;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const splitCustomerName = (fullName: string): { firstName: string; lastName: string } => {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
  };
};

export const CustomerCurrentAccountPanel = ({
  tenantId,
  userId,
  customer,
  canWrite,
  onClose: _onClose,
  onBalanceUpdated,
  isEditModalOpen: controlledIsEditOpen,
  onEditModalOpenChange,
  refreshKey,
}: CustomerCurrentAccountPanelProps) => {
  const toast = useToast();
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(customer);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [isAddPackageModalOpen, setIsAddPackageModalOpen] = useState(false);
  const [internalIsEditOpen, setInternalIsEditOpen] = useState(false);
  const isEditModalOpen = controlledIsEditOpen !== undefined ? controlledIsEditOpen : internalIsEditOpen;
  const setIsEditModalOpen = (open: boolean) => {
    setInternalIsEditOpen(open);
    onEditModalOpenChange?.(open);
  };
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const { packages: tenantPackageTypes } = useTenantReturnablePackages(tenantId);

  useEffect(() => {
    setCurrentCustomer(customer);
  }, [customer]);

  const {
    movements,
    balance,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    saleDetailsById,
    debtSales,
    pendingAllocationsByMovementId,
    accountSummary,
    isLoading,
    isSubmitting,
    hasOpenCashSession,
    feedback,
    clearFeedback,
    reload,
    registerPayment,
    registerAdjustment,
  } = useCurrentAccount(tenantId, currentCustomer, userId);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      clearFeedback();
      void reload();
    }
  }, [refreshKey, clearFeedback, reload]);

  const profile = useMemo(() => {
    return tenantId && currentCustomer?.id
      ? posCustomerProfilesService.getProfile(tenantId, currentCustomer.id)
      : { enabled: true, limit: null };
  }, [tenantId, currentCustomer?.id]);

  const accountEnabled = currentCustomer.current_account_enabled ?? profile.enabled;
  const accountLimit = currentCustomer.current_account_limit ?? profile.limit;
  const availableCredit = accountLimit != null ? Number((accountLimit - balance).toFixed(2)) : null;

  const editInitialValues = useMemo((): PosCustomerModalValues => {
    const names = splitCustomerName(currentCustomer.full_name);
    return {
      firstName: names.firstName,
      lastName: names.lastName,
      documentType: currentCustomer.document_type ?? "dni",
      documentNumber: currentCustomer.document_number ?? "",
      phone: currentCustomer.phone ?? "",
      email: currentCustomer.email ?? "",
      address: currentCustomer.address ?? "",
      fiscalBusinessName: currentCustomer.fiscal_business_name ?? "",
      fiscalAddress: currentCustomer.fiscal_address ?? "",
      fiscalCondition: currentCustomer.fiscal_condition ?? "",
      fiscalCuit: currentCustomer.document_type === "cuit" ? currentCustomer.document_number : "",
      currentAccountEnabled: accountEnabled,
      currentAccountLimit:
        accountLimit != null && Number.isFinite(accountLimit) ? accountLimit.toString() : "",
    };
  }, [currentCustomer, accountEnabled, accountLimit]);

  const handleEditCustomerSubmit = async (values: PosCustomerModalValues) => {
    if (!tenantId) return;

    const normalizeOptional = (input?: string) => {
      const normalized = input?.trim() ?? "";
      return normalized ? normalized : null;
    };

    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.replace(/\s+/g, " ").trim();
    const fiscalCuit = (values.fiscalCuit ?? "").trim();
    const documentType = fiscalCuit ? "cuit" : values.documentType;
    const documentNumber = fiscalCuit || (values.documentNumber ?? "").trim();
    const currentAccountLimitRaw = values.currentAccountLimit ?? "";
    const parsedLimit = Number(currentAccountLimitRaw);
    const newAccountLimit =
      currentAccountLimitRaw.trim() && Number.isFinite(parsedLimit) && parsedLimit >= 0
        ? Number(parsedLimit.toFixed(2))
        : null;

    setIsUpdatingCustomer(true);
    try {
      const updated = await customersService.update(tenantId, currentCustomer.id, {
        code: currentCustomer.code,
        full_name: fullName,
        document_type: documentType,
        document_number: documentNumber,
        fiscal_business_name: normalizeOptional(values.fiscalBusinessName),
        fiscal_address: normalizeOptional(values.fiscalAddress),
        fiscal_condition: normalizeOptional(values.fiscalCondition),
        price_list_id: currentCustomer.price_list_id,
        email: normalizeOptional(values.email),
        phone: normalizeOptional(values.phone),
        address: normalizeOptional(values.address),
        observations: currentCustomer.observations,
        current_balance: currentCustomer.current_balance,
        current_account_enabled: values.currentAccountEnabled,
        current_account_limit: newAccountLimit,
        is_active: currentCustomer.is_active,
      });

      posCustomerProfilesService.saveProfile(tenantId, currentCustomer.id, {
        enabled: values.currentAccountEnabled,
        limit: newAccountLimit,
      });

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "update",
        entity_type: "customer",
        entity_id: currentCustomer.id,
        description: `Cliente editado desde Cuentas Corrientes: ${fullName}`,
        metadata: {
          current_account_enabled: values.currentAccountEnabled,
          current_account_limit: newAccountLimit,
        },
      });

      if (updated) {
        setCurrentCustomer(updated);
      }
      toast.success(`Cliente "${fullName}" actualizado con éxito`);
      setIsEditModalOpen(false);
      onBalanceUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar los datos del cliente");
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  const submitPayment = async (values: Parameters<typeof registerPayment>[0]) => {
    const success = await registerPayment(values);
    if (!success) return false;
    onBalanceUpdated();
    return true;
  };

  const submitAdjustment = async (values: {
    mode: "original" | "update_to_today_price" | "surcharge_percentage" | "surcharge_fixed";
    surcharge_percent?: number;
    surcharge_amount?: number;
    notes?: string;
  }) => {
    const success = await registerAdjustment(values);
    if (!success) return false;
    if (tenantId && currentCustomer?.id) {
      try {
        const fresh = await customersService.getById(tenantId, currentCustomer.id);
        if (fresh) {
          setCurrentCustomer(fresh);
        }
      } catch {
        // Fallback silently
      }
    }
    onBalanceUpdated();
    return true;
  };

  const packageDebts = useMemo(() => {
    return parseCustomerPackageDebts(currentCustomer.observations);
  }, [currentCustomer.observations]);

  
  const handleAddPackageDebt = async (packageName: string, addQty: number = 1) => {
    if (!tenantId) return false;
    const currentDebts = { ...packageDebts };
    const currentQty = currentDebts[packageName] || 0;
    const newQty = currentQty + addQty;
    currentDebts[packageName] = newQty;

    const updatedObservations = serializeCustomerPackageDebts(currentCustomer.observations, currentDebts);
    try {
      const updated = await customersService.update(tenantId, currentCustomer.id, {
        code: currentCustomer.code,
        full_name: currentCustomer.full_name,
        document_type: currentCustomer.document_type,
        document_number: currentCustomer.document_number,
        fiscal_business_name: currentCustomer.fiscal_business_name,
        fiscal_address: currentCustomer.fiscal_address,
        fiscal_condition: currentCustomer.fiscal_condition,
        price_list_id: currentCustomer.price_list_id,
        email: currentCustomer.email,
        phone: currentCustomer.phone,
        address: currentCustomer.address,
        observations: updatedObservations,
        current_balance: currentCustomer.current_balance,
        current_account_enabled: currentCustomer.current_account_enabled,
        current_account_limit: currentCustomer.current_account_limit,
        is_active: currentCustomer.is_active,
      });

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "update",
        entity_type: "customer",
        entity_id: currentCustomer.id,
        description: `Préstamo de envase anotado: ${packageName} (+${addQty} u.)`,
        metadata: {
          borrowed_package: packageName,
          borrowed_quantity: addQty,
          total_package_debt: newQty,
        },
      });

      if (updated) {
        setCurrentCustomer(updated);
      } else {
        setCurrentCustomer((prev) => ({ ...prev, observations: updatedObservations }));
      }
      toast.success(`Se anotó el préstamo de ${addQty}x ${packageName}`);
      onBalanceUpdated();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar el préstamo del envase");
      return false;
    }
  };

  const handleReturnPackage = async (packageName: string, returnQty: number = 1) => {
    if (!tenantId) return;
    const currentDebts = { ...packageDebts };
    const currentQty = currentDebts[packageName] || 0;
    const newQty = Math.max(0, currentQty - returnQty);

    if (newQty <= 0) {
      delete currentDebts[packageName];
    } else {
      currentDebts[packageName] = newQty;
    }

    const updatedObservations = serializeCustomerPackageDebts(currentCustomer.observations, currentDebts);
    try {
      const updated = await customersService.update(tenantId, currentCustomer.id, {
        code: currentCustomer.code,
        full_name: currentCustomer.full_name,
        document_type: currentCustomer.document_type,
        document_number: currentCustomer.document_number,
        fiscal_business_name: currentCustomer.fiscal_business_name,
        fiscal_address: currentCustomer.fiscal_address,
        fiscal_condition: currentCustomer.fiscal_condition,
        price_list_id: currentCustomer.price_list_id,
        email: currentCustomer.email,
        phone: currentCustomer.phone,
        address: currentCustomer.address,
        observations: updatedObservations,
        current_balance: currentCustomer.current_balance,
        current_account_enabled: currentCustomer.current_account_enabled,
        current_account_limit: currentCustomer.current_account_limit,
        is_active: currentCustomer.is_active,
      });

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "update",
        entity_type: "customer",
        entity_id: currentCustomer.id,
        description: `Devolución de envase registrada: ${packageName} (${returnQty} u.)`,
        metadata: {
          returned_package: packageName,
          returned_quantity: returnQty,
          remaining_debts: currentDebts,
        },
      });

      if (updated) {
        setCurrentCustomer(updated);
      } else {
        setCurrentCustomer((prev) => ({ ...prev, observations: updatedObservations }));
      }
      toast.success(`Se registró la devolución de ${packageName}`);
      onBalanceUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar la devolución del envase");
    }
  };

  const canRegisterPayment = canWrite && Boolean(userId) && hasOpenCashSession;
  const canUpdatePricingRule =
    canWrite && Boolean(userId) && accountSummary.accountingBalance > 0;

  return (
    <section className="current-account-detail rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {currentCustomer.full_name}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatCustomerDocument(currentCustomer.document_type, currentCustomer.document_number)}
            {currentCustomer.phone ? ` • Tel: ${currentCustomer.phone}` : ""}
            {currentCustomer.email ? ` • Email: ${currentCustomer.email}` : ""}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                accountEnabled
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}
            >
              CC {accountEnabled ? "Habilitada" : "Deshabilitada"}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Límite:{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {accountLimit != null ? currency.format(accountLimit) : "Sin límite"}
              </strong>
            </span>
            {accountLimit != null && (
              <span className="text-xs text-slate-600 dark:text-slate-300">
                • Disponible:{" "}
                <strong
                  className={
                    availableCredit != null && availableCredit < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {currency.format(Math.max(0, availableCredit ?? 0))}
                </strong>
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
            Saldo Adeudado
          </span>
          <span
            className={`text-2xl sm:text-3xl font-black tracking-tight ${
              balance > 0
                ? "text-rose-600 dark:text-rose-400"
                : balance < 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {currency.format(balance)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <article className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Deuda original
          </p>
          <strong className="block mt-1 text-base sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {currency.format(balance)}
          </strong>
        </article>
        <article className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Saldo actualizado
            </p>
            <span
              className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded-full shrink-0"
              title="El recargo o actualización vigente reemplaza al anterior; no se suma varias veces."
            >
              Regla vigente
            </span>
          </div>
          <strong className="block mt-1 text-base sm:text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {currency.format(accountSummary.updatedBalance)}
          </strong>
        </article>
      </div>

      {/* Envases retornables adeudados */}
      {Object.keys(packageDebts).length > 0 ? (
        <div className="rounded-2xl border border-amber-300/90 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Envases retornables pendientes
              </span>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setIsAddPackageModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100 transition dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
              >
                <PlusCircle size={13} />
                <span>+ Prestar otro envase</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {Object.entries(packageDebts).map(([packageName, qty]) => (
              <div
                key={packageName}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2.5 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {packageName}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                    Adeuda: {qty} {qty === 1 ? "unidad" : "unidades"}
                  </div>
                </div>

                {canWrite && (
                  <button
                    type="button"
                    onClick={() => void handleReturnPackage(packageName, 1)}
                    title={`Registrar devolución de 1 ${packageName}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                  >
                    <span>✓ Recibir 1</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Package className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>No adeuda envases retornables</span>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setIsAddPackageModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <PlusCircle size={13} />
              <span>Anotar préstamo de envase</span>
            </button>
          )}
        </div>
      )}

      {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}
      {canWrite && !userId ? (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          No hay usuario activo en sesion. Inicia sesion nuevamente para registrar pagos o ajustes.
        </div>
      ) : canWrite && !hasOpenCashSession ? (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          No hay caja abierta para el usuario actual. Puedes consultar movimientos y registrar deudas manuales,
          pero para registrar pagos en efectivo/tarjeta debes abrir caja.
        </div>
      ) : hasOpenCashSession ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">Caja abierta para registrar cobros</p>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-sm shadow-blue-500/25 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={isSubmitting || !canRegisterPayment}
          >
            <DollarSign size={14} />
            <span>Registrar cobro</span>
          </button>
          <button
            type="button"
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50/70 hover:bg-rose-100 border border-rose-200 rounded-2xl shadow-xs transition dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 active:scale-95 disabled:opacity-50 cursor-pointer"
            onClick={() => setIsManualDebtModalOpen(true)}
            disabled={isSubmitting}
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">Adeudar / Movimiento manual</span>
            <span className="inline sm:hidden">Adeudar manual</span>
          </button>
          <button
            type="button"
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50/70 hover:bg-amber-100 border border-amber-300/90 rounded-2xl shadow-xs transition dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 active:scale-95 disabled:opacity-50 cursor-pointer"
            onClick={() => setIsAddPackageModalOpen(true)}
            disabled={isSubmitting}
          >
            <Package size={14} />
            <span className="hidden sm:inline">Prestar / Anotar Envase</span>
            <span className="inline sm:hidden">Prestar Envase</span>
          </button>
          <button
            type="button"
            className="w-full sm:w-auto justify-center rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 active:scale-95 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={() => setIsAdjustmentModalOpen(true)}
            disabled={isSubmitting || !canUpdatePricingRule}
            title={accountSummary.accountingBalance <= 0 ? "El cliente no tiene deuda pendiente de pago" : undefined}
          >
            <span>Actualizar regla / Ajuste</span>
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin permisos de escritura para registrar movimientos.</p>
      )}

      {isLoading ? (
        <LoadingState
          message="Cargando movimientos de cuenta corriente..."
          description="Sincronizando cobranzas, ventas a crédito y notas de débito/crédito..."
        />
      ) : (
        <CurrentAccountMovementsTable
          movements={movements}
          saleDetailsById={saleDetailsById}
          accountSummary={accountSummary}
          pendingAllocationsByMovementId={pendingAllocationsByMovementId}
        />
      )}

      <CurrentAccountPaymentModal
        open={isPaymentModalOpen}
        customer={currentCustomer}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        originBanks={originBanks}
        installmentPlans={installmentPlans}
        accountSummary={accountSummary}
        disabled={isSubmitting}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={submitPayment}
      />

      <CurrentAccountAdjustmentModal
        open={isAdjustmentModalOpen}
        debtSales={debtSales}
        accountSummary={accountSummary}
        customerName={currentCustomer?.full_name}
        disabled={isSubmitting}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSubmit={submitAdjustment}
      />

      <CustomerManualMovementModal
        open={isManualDebtModalOpen}
        tenantId={tenantId}
        userId={userId}
        customer={currentCustomer}
        onClose={() => setIsManualDebtModalOpen(false)}
        onSuccess={() => {
          void reload();
          onBalanceUpdated();
        }}
      />

      {isEditModalOpen && (
        <PosCustomerModal
          mode="edit"
          initialValues={editInitialValues}
          currentBalance={balance}
          disabled={isUpdatingCustomer}
          onCancel={() => setIsEditModalOpen(false)}
          onSubmit={handleEditCustomerSubmit}
        />
      )}
      <ManualPackageLoanModal
        isOpen={isAddPackageModalOpen}
        customerName={currentCustomer.full_name}
        configuredPackages={tenantPackageTypes}
        onClose={() => setIsAddPackageModalOpen(false)}
        onSubmit={handleAddPackageDebt}
      />
    </section>
  );
};
