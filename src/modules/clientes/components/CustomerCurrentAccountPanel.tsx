import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { CurrentAccountAdjustmentModal } from "@/modules/clientes/components/CurrentAccountAdjustmentModal";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
import { CurrentAccountPaymentModal } from "@/modules/clientes/components/CurrentAccountPaymentModal";
import { CustomerManualMovementModal } from "@/modules/cuentas-corrientes/components/CustomerManualMovementModal";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { customersService } from "@/services/customers.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { auditService } from "@/services/audit.service";
import { useToast } from "@/components/ui/useToast";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, DollarSign, Pencil, PlusCircle, RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Customer } from "@/types/entities";

interface CustomerCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  customer: Customer;
  canWrite: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
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
  onClose,
  onBalanceUpdated,
}: CustomerCurrentAccountPanelProps) => {
  const toast = useToast();
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(customer);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);

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
    const documentNumber = fiscalCuit || values.documentNumber.trim();
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

  const submitPayment = async (values: {
    amount: number;
    payment_method_id: string;
    notes?: string;
    payment_details?: Record<string, unknown> | null;
    pricing_rule?: {
      mode: "original" | "update_to_today_price" | "surcharge_percentage" | "surcharge_fixed";
      surcharge_percent?: number;
      surcharge_amount?: number;
      notes?: string;
    } | null;
  }) => {
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
    onBalanceUpdated();
    return true;
  };

  const canRegisterPayment = canWrite && Boolean(userId) && hasOpenCashSession;
  const canUpdatePricingRule = canWrite && Boolean(userId);

  return (
    <section className="current-account-detail ui-card space-y-4">
      {/* Barra de navegación superior con botón Volver */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ArrowLeft size={14} />
          <span>Volver al listado de clientes</span>
        </button>

        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Pencil size={13} />
              <span>Editar cliente</span>
            </button>
          )}
          <IconButton
            icon={RefreshCw}
            label="Recargar cuenta corriente"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            loading={isLoading}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentCustomer.full_name}
            </h3>
            {canWrite && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="Editar datos del cliente y límite de cuenta corriente"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md shadow-xs transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Pencil size={11} />
                <span>Editar</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentCustomer.document_type?.toUpperCase()} {currentCustomer.document_number}
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
            className={`text-2xl font-bold tracking-tight ${
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

      <div className="current-account-balance-grid">
        <article>
          <p>Deuda original</p>
          <strong>{currency.format(balance)}</strong>
        </article>
        <article className="current-account-balance-grid__updated">
          <p>Saldo actualizado</p>
          <strong>{currency.format(accountSummary.updatedBalance)}</strong>
          <span title="El recargo o actualizacion vigente reemplaza al anterior; no se suma varias veces.">
            Regla vigente
          </span>
        </article>
      </div>

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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition dark:bg-slate-100 dark:text-slate-900"
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={isSubmitting || !canRegisterPayment}
          >
            <DollarSign size={14} />
            <span>Registrar cobro</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-sm transition dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            onClick={() => setIsManualDebtModalOpen(true)}
            disabled={isSubmitting}
          >
            <PlusCircle size={14} />
            <span>Adeudar / Movimiento manual</span>
          </button>
          <button
            type="button"
            className="ui-btn-ghost text-xs py-2"
            onClick={() => setIsAdjustmentModalOpen(true)}
            disabled={isSubmitting || !canUpdatePricingRule}
          >
            Actualizar regla / Ajuste
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin permisos de escritura para registrar movimientos.</p>
      )}

      {isLoading ? (
        <div className="ui-loading">
          Cargando movimientos...
        </div>
      ) : (
        <CurrentAccountMovementsTable
          movements={movements}
          saleDetailsById={saleDetailsById}
          accountSummary={accountSummary}
        />
      )}

      <CurrentAccountPaymentModal
        open={isPaymentModalOpen}
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
    </section>
  );
};
