import { useEffect, useState, useCallback } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { LoadingState } from "@/components/ui/UiStates";
import { IconButton } from "@/components/ui/IconButton";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import {
  Building2,
  CreditCard,
  Layers,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  ArrowLeftRight,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAccountingCatalogs } from "@/modules/configuracion/hooks/useAccountingCatalogs";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { BankAccountMovementsModal } from "../components/BankAccountMovementsModal";
import type { BankAccount, InstallmentPlan } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const BancosPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();

  const canReadModule = canRead("bancos");
  const canWriteModule = canWrite("bancos");

  const [activeTab, setActiveTab] = useState<"accounts" | "origin_banks" | "installment_plans">("accounts");

  const {
    bankAccounts,
    originBanks,
    installmentPlans,
    isLoading,
    feedback,
    clearFeedback,
    reload,
    upsertBankAccount,
    toggleBankAccount,
    toggleOriginBank,
    upsertInstallmentPlan,
    toggleInstallmentPlan,
  } = useAccountingCatalogs(tenantId, user?.id ?? null, canReadModule);

  // Bank Account Movements state
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
  const [selectedMovementsAccount, setSelectedMovementsAccount] = useState<BankAccount | null>(null);

  const loadBalances = useCallback(async () => {
    if (!tenantId) return;
    try {
      const balances = await bankAccountMovementsService.getAllBalancesByTenant(tenantId);
      setAccountBalances(balances);
    } catch (err) {
      console.error("Error loading bank account balances:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && canReadModule) {
      loadBalances();
    }
  }, [tenantId, canReadModule, loadBalances, bankAccounts]);

  const handleRefreshAll = () => {
    reload();
    loadBalances();
  };

  useEffect(() => {
    if (feedback) {
      if (feedback.type === "success") toast.success(feedback.message);
      else toast.error(feedback.message);
      clearFeedback();
    }
  }, [feedback, clearFeedback, toast]);

  // Modals state
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState<{
    bank_name: string;
    account_type: BankAccount["account_type"];
    holder_name: string;
    cbu: string;
    alias: string;
    currency_code: string;
    notes: string;
    is_active: boolean;
  }>({
    bank_name: "",
    account_type: "cuenta_corriente",
    holder_name: "",
    cbu: "",
    alias: "",
    currency_code: "ARS",
    notes: "",
    is_active: true,
  });

  const [installmentPlanModalOpen, setInstallmentPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InstallmentPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    installments: 1,
    interest_percent: 0,
    card_brand: "",
    notes: "",
    is_active: true,
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
      },
      editingAccount ? editingAccount.id : undefined
    );
    setAccountModalOpen(false);
  };

  const openPlanModal = (plan?: InstallmentPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        code: plan.code,
        name: plan.name,
        installments: plan.installments,
        interest_percent: plan.interest_percent,
        card_brand: plan.card_brand || "",
        notes: plan.notes || "",
        is_active: plan.is_active,
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        code: "",
        name: "",
        installments: 1,
        interest_percent: 0,
        card_brand: "",
        notes: "",
        is_active: true,
      });
    }
    setInstallmentPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertInstallmentPlan(
      {
        code: planForm.code.trim() || `PLAN-${planForm.installments}C`,
        name: planForm.name.trim(),
        installments: planForm.installments,
        interest_percent: planForm.interest_percent,
        card_brand: planForm.card_brand.trim() || null,
        notes: planForm.notes.trim() || null,
        is_active: planForm.is_active,
      },
      editingPlan ? editingPlan.id : undefined
    );
    setInstallmentPlanModalOpen(false);
  };

  if (!tenantId) {
    return <PagePlaceholder title="Bancos" description="No hay un comercio activo" />;
  }

  if (!canReadModule) {
    return (
      <PagePlaceholder
        title="Bancos"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Bancos y Finanzas"
      description="Gestión de cuentas bancarias de la empresa, bancos emisores y planes de cuotas"
    >
      <div className="bancos-workspace space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("accounts")}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === "accounts"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 className="h-4 w-4" />
              Cuentas Bancarias ({bankAccounts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("origin_banks")}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === "origin_banks"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Bancos Emisores ({originBanks.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("installment_plans")}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === "installment_plans"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="h-4 w-4" />
              Planes de Cuotas ({installmentPlans.length})
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <IconButton
              icon={RefreshCw}
              label="Recargar catálogos y saldos"
              onClick={handleRefreshAll}
              loading={isLoading}
            />

            {canWriteModule && (
              <>
                {activeTab === "accounts" && (
                  <button
                    type="button"
                    onClick={() => openAccountModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva Cuenta Bancaria
                  </button>
                )}
                {activeTab === "installment_plans" && (
                  <button
                    type="button"
                    onClick={() => openPlanModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo Plan de Cuotas
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Cuentas Bancarias */}
        {activeTab === "accounts" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8">
                <LoadingState message="Cargando cuentas bancarias..." />
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Sin cuentas bancarias configuradas</p>
                <p className="text-xs text-slate-500 mt-1">
                  Agregá las cuentas bancarias o billeteras virtuales de tu negocio.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Banco / Entidad</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Titular</th>
                      <th className="py-3 px-4">CBU / CVU</th>
                      <th className="py-3 px-4">Alias</th>
                      <th className="py-3 px-4 text-right">Saldo Actual</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bankAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{acc.bank_name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 capitalize">
                          {acc.account_type.replace("_", " ")}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">{acc.holder_name}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">{acc.cbu || "-"}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">{acc.alias || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {currency.format(accountBalances[acc.id] ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              acc.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {acc.is_active ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedMovementsAccount(acc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors mr-2 shadow-xs"
                            title="Ver movimientos e ingresos/egresos"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-sky-600" />
                            Movimientos
                          </button>
                          {canWriteModule && (
                            <>
                              <button
                                type="button"
                                onClick={() => openAccountModal(acc)}
                                className="text-slate-600 hover:text-slate-900 p-1 rounded"
                                title="Editar cuenta"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleBankAccount(acc.id)}
                                className={`p-1 rounded ml-1 ${
                                  acc.is_active ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                                }`}
                                title={acc.is_active ? "Desactivar cuenta" : "Activar cuenta"}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Bancos Emisores */}
        {activeTab === "origin_banks" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Bancos Emisores de Tarjetas</h4>
                <p className="text-xs text-slate-500">
                  Catálogo de entidades bancarias habilitadas para transacciones con tarjeta.
                </p>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {originBanks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{bank.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-mono">{bank.code}</p>
                  </div>
                  {canWriteModule && (
                    <button
                      type="button"
                      onClick={() => toggleOriginBank(bank.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        bank.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {bank.is_active ? "Activo" : "Inactivo"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Planes de Cuotas */}
        {activeTab === "installment_plans" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {installmentPlans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Sin planes de cuotas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nombre del Plan</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4 text-center">Cuotas</th>
                      <th className="py-3 px-4 text-right">Recargo / Interés</th>
                      <th className="py-3 px-4">Tarjeta / Marca</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      {canWriteModule && <th className="py-3 px-4 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {installmentPlans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{plan.name}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-500">{plan.code}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{plan.installments}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">
                          {plan.interest_percent}%
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{plan.card_brand || "Todas"}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              plan.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {plan.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        {canWriteModule && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openPlanModal(plan)}
                              className="text-slate-600 hover:text-slate-900 p-1 rounded"
                              title="Editar plan"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleInstallmentPlan(plan.id)}
                              className={`p-1 rounded ml-1 ${
                                plan.is_active ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                              }`}
                              title={plan.is_active ? "Desactivar plan" : "Activar plan"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Cuenta Bancaria */}
        {accountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-900">
                  {editingAccount ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
                </h3>
                <ModalCloseButton onClick={() => setAccountModalOpen(false)} />
              </header>

              <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Banco o Entidad *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.bank_name}
                    onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                    placeholder="Ej: Banco Galicia / Mercado Pago"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tipo de Cuenta
                    </label>
                    <select
                      value={accountForm.account_type}
                      onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="cuenta_corriente">Cuenta corriente</option>
                      <option value="caja_ahorro">Caja de ahorro</option>
                      <option value="billetera_virtual">Billetera virtual</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Moneda
                    </label>
                    <input
                      type="text"
                      value={accountForm.currency_code}
                      onChange={(e) => setAccountForm({ ...accountForm, currency_code: e.target.value })}
                      placeholder="ARS"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Titular de la Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.holder_name}
                    onChange={(e) => setAccountForm({ ...accountForm, holder_name: e.target.value })}
                    placeholder="Razón Social o Nombre del titular"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    CBU / CVU (22 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    value={accountForm.cbu}
                    onChange={(e) => setAccountForm({ ...accountForm, cbu: e.target.value })}
                    placeholder="0070000000000000000000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={accountForm.alias}
                    onChange={(e) => setAccountForm({ ...accountForm, alias: e.target.value })}
                    placeholder="mi.negocio.pos"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="acc_is_active"
                    checked={accountForm.is_active}
                    onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label htmlFor="acc_is_active" className="text-xs text-slate-700 font-medium">
                    Cuenta activa para cobros y pagos
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    Guardar Cuenta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Plan de Cuotas */}
        {installmentPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-900">
                  {editingPlan ? "Editar Plan de Cuotas" : "Nuevo Plan de Cuotas"}
                </h3>
                <ModalCloseButton onClick={() => setInstallmentPlanModalOpen(false)} />
              </header>

              <form onSubmit={handleSavePlan} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre del Plan *
                  </label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Ej: 3 Cuotas sin interés / Ahora 6"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Cantidad de Cuotas *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      required
                      value={planForm.installments}
                      onChange={(e) => setPlanForm({ ...planForm, installments: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Recargo / Interés (%) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      required
                      value={planForm.interest_percent}
                      onChange={(e) => setPlanForm({ ...planForm, interest_percent: parseFloat(e.target.value) || 0 })}
                      placeholder="0.0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Marca de Tarjeta (Opcional)
                  </label>
                  <input
                    type="text"
                    value={planForm.card_brand}
                    onChange={(e) => setPlanForm({ ...planForm, card_brand: e.target.value })}
                    placeholder="Visa, Mastercard, Cabal o dejar vacío para todas"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="plan_is_active"
                    checked={planForm.is_active}
                    onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label htmlFor="plan_is_active" className="text-xs text-slate-700 font-medium">
                    Plan activo para POS y cobros
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setInstallmentPlanModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    Guardar Plan
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
            onBalanceUpdated={loadBalances}
          />
        )}
      </div>
    </PagePlaceholder>
  );
};
