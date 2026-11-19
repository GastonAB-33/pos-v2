import React, { useState, useEffect } from "react";
import { Navbar, NavTab } from "./components/Navbar";
import { KpiStats } from "./components/KpiStats";
import { TenantsManager } from "./components/TenantsManager";
import { CrmPipeline } from "./components/CrmPipeline";
import { BillingTransactions } from "./components/BillingTransactions";
import { ExtendTrialModal } from "./components/ExtendTrialModal";
import { ManualActivationModal } from "./components/ManualActivationModal";
import { ActivateLeadTrialModal } from "./components/ActivateLeadTrialModal";
import { AuthGateModal } from "./components/AuthGateModal";
import { TenantNotesModal } from "./components/TenantNotesModal";
import { crmService } from "./services/crm.service";
import {
  TenantAccount,
  CrmLead,
  BillingTransaction,
  CrmStats,
  LeadStage,
  SubscriptionStatus,
} from "./types/crm.types";
import { CheckCircle2, AlertCircle, Sparkles, MessageSquare } from "lucide-react";

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

  // Estado de autenticación SuperAdmin
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("jireh_crm_auth") === "true";
  });

  // Modales
  const [selectedTenantForTrial, setSelectedTenantForTrial] = useState<TenantAccount | null>(null);
  const [selectedTenantForActivation, setSelectedTenantForActivation] = useState<TenantAccount | null>(null);
  const [selectedLeadForActivation, setSelectedLeadForActivation] = useState<CrmLead | null>(null);
  const [selectedTenantForNotes, setSelectedTenantForNotes] = useState<TenantAccount | null>(null);
  const [loadingTenantTelemetryId, setLoadingTenantTelemetryId] = useState<string | null>(null);
  const [isRefreshingAllTelemetry, setIsRefreshingAllTelemetry] = useState<boolean>(false);
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

    // Sincronizar leads remotos de Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qfquvyxyodmnyqlchpbf.supabase.co";
    const anonKey =
      import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_NmP-WEg3k_lNF-p005-Teg_p3Hnrn49";

    fetch(`${supabaseUrl}/rest/v1/crm_leads?select=*&order=created_at.desc`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    })
      .then((res) => res.json())
      .then((remoteRows) => {
        if (Array.isArray(remoteRows) && remoteRows.length > 0) {
          const localLeads = crmService.getLeads();
          const localLeadsById = new Map(localLeads.map((l) => [l.id, l]));

          const remoteMapped: CrmLead[] = remoteRows.map((row) => {
            const local = localLeadsById.get(row.id);
            // Si localmente ya se activó a 'trial' u otra etapa superior, preservar el estado local
            // en caso de que la base de datos remota aún no se haya actualizado
            const effectiveStage: LeadStage =
              local && local.stage !== "lead"
                ? local.stage
                : ((row.stage as LeadStage) || "lead");

            return {
              id: row.id,
              tenantId: row.tenant_id || local?.tenantId,
              businessName: row.business_name,
              contactName: row.contact_name,
              email: row.email,
              phone: row.phone,
              clientPassword: row.client_password || local?.clientPassword,
              category: row.category || "Almacén y Kiosco",
              stage: effectiveStage,
              selectedPlan: row.selected_plan || 'Plan "Me Estoy Formalizando"',
              estimatedMrr: Number(row.estimated_mrr) || 40000,
              source: row.source || "landing_page",
              notes: row.notes || local?.notes,
              trialStartedAt: row.trial_started_at || local?.trialStartedAt,
              trialEndsAt: row.trial_ends_at || local?.trialEndsAt,
              createdAt: row.created_at,
            };
          });

          const existingIds = new Set(remoteMapped.map((r) => r.id));
          const uniqueLocal = localLeads.filter((item) => !existingIds.has(item.id));
          const merged = [...remoteMapped, ...uniqueLocal];
          localStorage.setItem("jireh_crm_leads", JSON.stringify(merged));
          setLeads(merged);
        }
      })
      .catch((err) => console.warn("Sincronización remota de leads omitida:", err));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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
        ? "Comercio suspendido. Los datos se mantienen protegidos."
        : "Comercio reactivado con éxito."
    );
  };

  const handleMoveLeadStage = (leadId: string, newStage: LeadStage) => {
    crmService.updateLeadStage(leadId, newStage);
    loadData();
  };

  const handleSaveNotes = (tenantId: string, notes: string) => {
    try {
      crmService.updateTenantNotes(tenantId, notes);
      loadData();
      showToast("Bitácora de interacciones actualizada exitosamente.");
    } catch (err: any) {
      showToast(err.message || "Error al actualizar la bitácora.");
    }
  };

  const handleLockCrm = () => {
    sessionStorage.removeItem("jireh_crm_auth");
    setIsAuthenticated(false);
  };

  const handleRefreshTelemetry = async (tenant: TenantAccount) => {
    setLoadingTenantTelemetryId(tenant.id);
    try {
      const data = await crmService.fetchTenantTelemetry(tenant);
      crmService.updateTenantMetrics(tenant.id, {
        productsCount: data.productsCount,
        salesCount: data.salesCount,
        slug: data.slug,
      });
      loadData();
      showToast(
        `✓ ${tenant.tradeName}: ${data.productsCount} producto${
          data.productsCount === 1 ? "" : "s"
        }, ${data.salesCount} venta${data.salesCount === 1 ? "" : "s"} registrada${
          data.salesCount === 1 ? "" : "s"
        }`
      );
    } catch (err: any) {
      showToast(err.message || "Error al consultar métricas del comercio.");
    } finally {
      setLoadingTenantTelemetryId(null);
    }
  };

  const handleRefreshAllTelemetry = async () => {
    setIsRefreshingAllTelemetry(true);
    let updatedCount = 0;
    try {
      const currentTenants = crmService.getTenants();
      for (const t of currentTenants) {
        try {
          const data = await crmService.fetchTenantTelemetry(t);
          crmService.updateTenantMetrics(t.id, {
            productsCount: data.productsCount,
            salesCount: data.salesCount,
            slug: data.slug,
          });
          updatedCount++;
        } catch (e) {
          console.warn(`Error refrescando métricas para ${t.tradeName}:`, e);
        }
      }
      loadData();
      showToast(`✓ Métricas actualizadas para ${updatedCount} comercios desde la base de datos.`);
    } catch (err: any) {
      showToast(err.message || "Error al actualizar métricas.");
    } finally {
      setIsRefreshingAllTelemetry(false);
    }
  };

  const handleActivateTrialSuccess = (
    updatedLead: CrmLead,
    tenantSlug: string,
    email: string,
    pass: string
  ) => {
    // 1. Actualizar lead en la lista local
    const currentLeads = crmService.getLeads();
    const nextLeads = currentLeads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    localStorage.setItem("jireh_crm_leads", JSON.stringify(nextLeads));

    // 2. Registrar el nuevo tenant en el CRM
    const currentTenants = crmService.getTenants();
    const newTenant: TenantAccount = {
      id: updatedLead.tenantId || `tenant-${tenantSlug}`,
      legalName: updatedLead.businessName,
      tradeName: updatedLead.businessName,
      slug: tenantSlug,
      cuit: "30-00000000-0",
      phone: updatedLead.phone,
      email: email,
      category: updatedLead.category,
      subscriptionStatus: "trial",
      trialEndsAt: updatedLead.trialEndsAt || new Date(Date.now() + 7 * 86400000).toISOString(),
      subscriptionEndsAt: null,
      planId: "formalizando",
      mrrAmount: 40000,
      productsCount: 0,
      salesCount: 0,
      notes: `Creado desde Lead ${updatedLead.businessName}. Contraseña inicial: ${pass}`,
      createdAt: new Date().toISOString(),
    };

    const nextTenants = [newTenant, ...currentTenants.filter((t) => t.id !== newTenant.id)];
    localStorage.setItem("jireh_crm_tenants", JSON.stringify(nextTenants));

    loadData();
    showToast(`¡Comercio "${updatedLead.businessName}" activado en la nube con 7 días de prueba!`);
  };

  const handleFilterExpiring = () => {
    setFilterExpiringOnly(true);
    setCurrentTab("tenants");
  };

  const newLeads = leads.filter((l) => l.stage === "lead");

  if (!isAuthenticated) {
    return <AuthGateModal onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Barra de navegación del CRM */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        expiringCount={stats.expiringIn48h}
        newLeadsCount={newLeads.length}
        onLock={handleLockCrm}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* En la pestaña Dashboard siempre mostramos las tarjetas KPI */}
        <KpiStats stats={stats} onFilterExpiring={handleFilterExpiring} />

        {/* 1. Vista Dashboard */}
        {currentTab === "dashboard" && (
          <div className="space-y-6">
            {/* Sección destacada: Nuevas Fichas Web Recibidas */}
            {newLeads.length > 0 && (
              <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-5 space-y-4 shadow-xl shadow-emerald-950/30 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span>Fichas de Prueba Recibidas</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-extrabold text-emerald-300 border border-emerald-500/30">
                          {newLeads.length} pendiente{newLeads.length > 1 ? "s" : ""} de activación
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300">
                        Prospectos que enviaron la ficha desde la web esperando tu contacto por WhatsApp para activar sus 7 días.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentTab("crm")}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Ver en el embudo (CRM) →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {newLeads.map((lead) => {
                    const whatsappMsg = encodeURIComponent(
                      `Hola ${lead.contactName}! Te escribo de Jireh respecto a la ficha que enviaste para tu comercio "${lead.businessName}". ¿Cómo estás? Estoy listo para activar tu período de prueba de 7 días y entregarte tus accesos.`
                    );

                    return (
                      <div
                        key={lead.id}
                        className="rounded-xl border border-emerald-500/30 bg-slate-900/90 p-4 shadow-md space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-white">{lead.businessName}</h4>
                            <span className="text-[11px] text-slate-400 block">{lead.category}</span>
                          </div>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                            Ficha Web
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 space-y-1 border-t border-slate-800 pt-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Titular:</span>
                            <span className="font-semibold text-white">{lead.contactName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">WhatsApp:</span>
                            <span className="font-bold text-emerald-400">{lead.phone}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Email:</span>
                            <span className="text-slate-300 truncate max-w-[170px]">{lead.email}</span>
                          </div>
                          {lead.clientPassword && (
                            <div className="flex justify-between text-amber-300">
                              <span className="text-slate-500">Clave elegida:</span>
                              <span className="font-mono font-bold">{lead.clientPassword}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Plan:</span>
                            <span className="text-sky-400 font-medium">{lead.selectedPlan}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setSelectedLeadForActivation(lead)}
                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-950/40 transition"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Activar Prueba 7 Días</span>
                          </button>

                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Escribir por WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

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
              onOpenNotes={(t) => setSelectedTenantForNotes(t)}
              onRefreshTelemetry={handleRefreshTelemetry}
              onRefreshAllTelemetry={handleRefreshAllTelemetry}
              loadingTenantId={loadingTenantTelemetryId}
              isRefreshingAll={isRefreshingAllTelemetry}
            />
          </div>
        )}

        {/* 2. Vista Pipeline CRM */}
        {currentTab === "crm" && (
          <CrmPipeline
            leads={leads}
            onMoveStage={handleMoveLeadStage}
            onActivateTrial={(lead) => setSelectedLeadForActivation(lead)}
          />
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
              onOpenNotes={(t) => setSelectedTenantForNotes(t)}
              onRefreshTelemetry={handleRefreshTelemetry}
              onRefreshAllTelemetry={handleRefreshAllTelemetry}
              loadingTenantId={loadingTenantTelemetryId}
              isRefreshingAll={isRefreshingAllTelemetry}
            />
          </div>
        )}

        {/* 4. Vista Cobranzas */}
        {currentTab === "billing" && <BillingTransactions transactions={transactions} />}
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

      <ActivateLeadTrialModal
        isOpen={Boolean(selectedLeadForActivation)}
        lead={selectedLeadForActivation}
        onClose={() => setSelectedLeadForActivation(null)}
        onSuccess={handleActivateTrialSuccess}
      />

      <TenantNotesModal
        isOpen={Boolean(selectedTenantForNotes)}
        tenant={selectedTenantForNotes}
        onClose={() => setSelectedTenantForNotes(null)}
        onSaveNotes={handleSaveNotes}
      />
    </div>
  );
};

export default App;
