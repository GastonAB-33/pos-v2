import { useEffect, useState } from "react";
import { ArrowLeftRight, AlertCircle, RefreshCw } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useCashModule } from "@/modules/caja/hooks/useCashModule";
import { CashMovementForm } from "@/modules/caja/components/CashMovementForm";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useToast } from "@/components/ui/useToast";
import type { CashMovementValues } from "@/modules/caja/schemas/cash.schemas";
import type { BankAccount, PaymentMethod } from "@/types/entities";

export interface ManualCashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "income" | "expense";
  onSuccess?: () => void;
  // Optional external overrides
  paymentMethods?: PaymentMethod[];
  bankAccounts?: BankAccount[];
  canWrite?: boolean;
}

export const ManualCashMovementModal = ({
  isOpen,
  onClose,
  defaultMode = "expense",
  onSuccess,
  paymentMethods: propPaymentMethods,
  bankAccounts: propBankAccounts,
  canWrite: propCanWrite,
}: ManualCashMovementModalProps) => {
  const { tenantId } = useTenant();
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const {
    currentSession,
    paymentMethods: modulePaymentMethods,
    bankAccounts: moduleBankAccounts,
    isSubmitting,
    isLoading,
    registerIncome,
    registerExpense,
    feedback,
  } = useCashModule(tenantId, userId);

  const { canWrite: checkPermission } = usePermissions();
  const toast = useToast();

  const [tab, setTab] = useState<"income" | "expense">(defaultMode);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultMode);
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const paymentMethods = propPaymentMethods ?? modulePaymentMethods;
  const bankAccounts = propBankAccounts ?? moduleBankAccounts;
  const canWrite = propCanWrite ?? (checkPermission("caja") || checkPermission("pos"));

  const handleModeToggle = (next: "income" | "expense") => {
    setTab(next);
  };

  const handleSubmit = async (values: CashMovementValues) => {
    if (tab === "income") {
      const ok = await registerIncome(values);
      if (ok) {
        toast.success("Ingreso registrado en caja diaria");
        onSuccess?.();
        onClose();
      } else if (feedback?.message) {
        toast.error(feedback.message);
      }
    } else {
      const ok = await registerExpense(values);
      if (ok) {
        toast.success("Egreso registrado en caja diaria");
        onSuccess?.();
        onClose();
      } else if (feedback?.message) {
        toast.error(feedback.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4">
      <div className="w-full max-w-lg flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <header className="shrink-0 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Movimiento Manual de Caja
            </h3>
          </div>
          <ModalCloseButton onClick={onClose} />
        </header>

        {/* Selector de Pestañas Ingreso / Egreso */}
        <div className="shrink-0 px-4 pt-2.5 pb-1">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleModeToggle("income")}
              className={`h-7 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "income"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>+ Ingreso</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                F2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle("expense")}
              className={`h-7 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "expense"
                  ? "bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>- Retiro / Egreso</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                F2
              </kbd>
            </button>
          </div>
        </div>

        {/* Contenido sin scroll */}
        <div className="px-4 pb-4 pt-2">
          {isLoading && !currentSession ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <RefreshCw className="h-5 w-5 animate-spin text-brand-600 dark:text-brand-400" />
              <span>Verificando estado de la caja diaria...</span>
            </div>
          ) : !currentSession ? (
            <div className="p-4 my-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center space-y-2">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto" />
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                No hay una caja diaria abierta
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 max-w-sm mx-auto">
                Para registrar egresos o movimientos manuales primero debes tener una caja diaria iniciada.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn-ghost text-xs px-3 py-1 cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          ) : (
            <CashMovementForm
              mode={tab}
              paymentMethods={paymentMethods}
              bankAccounts={bankAccounts}
              canWrite={canWrite}
              disabled={isSubmitting}
              onSubmit={handleSubmit}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onCancel={onClose}
              onToggleMode={handleModeToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
};
