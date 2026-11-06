import React, { useState, useEffect } from "react";
import { Navbar, NavTab } from "./components/Navbar";
import { KpiStats } from "./components/KpiStats";
import { TenantsManager } from "./components/TenantsManager";
import { CrmPipeline } from "./components/CrmPipeline";
import { BillingTransactions } from "./components/BillingTransactions";
import { ExtendTrialModal } from "./components/ExtendTrialModal";
import { ManualActivationModal } from "./components/ManualActivationModal";
import { crmService } from "./services/crm.service";
import { TenantAccount, CrmLead, BillingTransaction, CrmStats, LeadStage, SubscriptionStatus } from "./types/crm.types";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [tenants, setTenants] = useState<TenantAccount[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [stats, setStats] = useState<CrmStats>({
    totalTenants: 0,
    activeTenants: 0,
    activeTrials: 0,
    expiringIn48h: 0,
    totalMrr: 0,
  });

  // Modales
  const [selectedTenantForTrial, setSelectedTenantForTrial] = useState<TenantAccount | null>(null);
  const [selectedTenantForActivation, setSelectedTenantForActivation] = useState<TenantAccount | null>(null);
  const [filterExpiringOnly, setFilterExpiringOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const t = crmService.getTenants();
    const l = crmService.getLeads();
    const tx = crmService.getTransactions();
    const s = crmService.getStats();

    setTenants(t);
    setLeads(l);
    setTransactions(tx);
    setStats(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExtendTrial = (tenantId: string, days: number) => {
    try {
      const updated = crmService.extendTrial(tenantId, days);
      loadData();
      showToast(`Prueba de ${updated.tradeName} extendida por ${days} días exitosamente.`);
    } catch (err: any) {
      showToast(err.message || "Error extendiendo prueba.");
    }
  };

  const handleManualActivation = (
    tenantId: string,
    planId: string,
    months: number,
    paymentMethod: "transfer" | "cash" | "card" | "mercadopago",
    amount: number,
    notes?: string
  ) => {
    try {
      const { tenant } = crmService.manualActivate(tenantId, planId, months, paymentMethod, amount, notes);
      loadData();
      showToast(`Comercio ${tenant.tradeName} activado oficialmente por ${months} mes(es).`);
    } catch (err: any) {
      showToast(err.message || "Error activando suscripción.");
    }
  };

  const handleToggleStatus = (tenantId: string, currentStatus: SubscriptionStatus) => {
    const newStatus: SubscriptionStatus = currentStatus === "suspended" ? "active" : "suspended";
    crmService.updateTenantStatus(tenantId, newStatus);
    loadData();
    showToast(
      newStatus === "suspended"
        ? "Comercio suspendido (se activará paywall en su sistema)."
        : "Comercio reactivado con éxito."
    );
  };

  const handleMoveLeadStage = (leadId: string, newStage: LeadStage) => {
    crmService.updateLeadStage(leadId, newStage);
    loadData();
  };

  const handleFilterExpiring = () => {
    setFilterExpiringOnly(true);
    setCurrentTab("tenants");
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-slate-100">
      {/* Barra de navegación superior */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setFilterExpiringOnly(false);
          setCurrentTab(tab);
        }}
        expiringCount={stats.expiringIn48h}
      />

      {/* Notificación Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* En la pestaña Dashboard siempre mostramos las tarjetas KPI */}
        <KpiStats stats={stats} onFilterExpiring={handleFilterExpiring} />

        {/* 1. Vista Dashboard: resumen rápido de tenants y pipeline */}
        {currentTab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white">Comercios y Estado de Suscripciones</h2>
                <p className="text-xs text-slate-400">
                  Control en tiempo real de licencias, pruebas de 7 días y botones de acción rápida.
                </p>
              </div>
            </div>

            <TenantsManager
              tenants={tenants}
              filterExpiringOnly={filterExpiringOnly}
              onExtendTrial={(t) => setSelectedTenantForTrial(t)}
              onActivateManual={(t) => setSelectedTenantForActivation(t)}
              onToggleStatus={handleToggleStatus}
            />
          </div>
        )}

        {/* 2. Vista Pipeline CRM */}
        {currentTab === "crm" && (
          <CrmPipeline leads={leads} onMoveStage={handleMoveLeadStage} />
        )}

        {/* 3. Vista Comercios (Tenants) */}
        {currentTab === "tenants" && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-black text-white">Listado Maestro de Comercios</h2>
              <p className="text-xs text-slate-400">
                Gestiona permisos, activaciones manuales y extensiones de período para cada comercio.
              </p>
            </div>

            <TenantsManager
              tenants={tenants}
              filterExpiringOnly={filterExpiringOnly}
              onExtendTrial={(t) => setSelectedTenantForTrial(t)}
              onActivateManual={(t) => setSelectedTenantForActivation(t)}
              onToggleStatus={handleToggleStatus}
            />
          </div>
        )}

        {/* 4. Vista Cobranzas */}
        {currentTab === "billing" && (
          <BillingTransactions transactions={transactions} />
        )}

      </main>

      {/* Modales globales de acción */}
      <ExtendTrialModal
        isOpen={Boolean(selectedTenantForTrial)}
        tenant={selectedTenantForTrial}
        onClose={() => setSelectedTenantForTrial(null)}
        onConfirm={handleExtendTrial}
      />

      <ManualActivationModal
        isOpen={Boolean(selectedTenantForActivation)}
        tenant={selectedTenantForActivation}
        onClose={() => setSelectedTenantForActivation(null)}
        onConfirm={handleManualActivation}
      />
    </div>
  );
};

export default App;
