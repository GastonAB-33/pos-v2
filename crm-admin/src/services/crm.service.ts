import { TenantAccount, CrmLead, BillingTransaction, CrmStats, LeadStage, SubscriptionStatus } from "../types/crm.types";

const INITIAL_TENANTS: TenantAccount[] = [
  {
    id: "tenant-la25",
    legalName: "La 25 Autoservicio S.R.L.",
    tradeName: "Autoservicio La 25",
    slug: "la25",
    cuit: "30-71829102-4",
    phone: "+54 9 266 412-3456",
    email: "contacto@la25.com",
    category: "Minimarket / Supermercado",
    subscriptionStatus: "active",
    trialEndsAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    subscriptionEndsAt: new Date(Date.now() + 25 * 86400000).toISOString(),
    planId: "formalizando",
    mrrAmount: 40000,
    productsCount: 420,
    salesCount: 1850,
    notes: "Comercio piloto. Usa balanza y facturación AFIP.",
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: "tenant-kiosco-central",
    legalName: "Martín López",
    tradeName: "Kiosco Central 24hs",
    slug: "kiosco-central",
    cuit: "20-38491029-3",
    phone: "+54 9 11 5829-1029",
    email: "martin.kiosco@gmail.com",
    category: "Almacén y Kiosco",
    subscriptionStatus: "trial",
    trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 días restantes
    subscriptionEndsAt: null,
    planId: "arrancando",
    mrrAmount: 25000,
    productsCount: 95,
    salesCount: 140,
    notes: "Se registró por landing. Llamar al día 5 para coordinar pago.",
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "tenant-ferreteria-san-jose",
    legalName: "San José Ferreterías S.A.",
    tradeName: "Ferretería San José",
    slug: "ferreteria-san-jose",
    cuit: "30-65928172-1",
    phone: "+54 9 351 948-2819",
    email: "administracion@sanjoseferreteria.com",
    category: "Ferretería y Corralón",
    subscriptionStatus: "trial",
    trialEndsAt: new Date(Date.now() + 1 * 86400000).toISOString(), // 1 día restante (Alerta)
    subscriptionEndsAt: null,
    planId: "imperio",
    mrrAmount: 60000,
    productsCount: 850,
    salesCount: 310,
    notes: "Tiene 2 sucursales. Muy interesado en cuentas corrientes de clientes.",
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "tenant-boutique-roma",
    legalName: "Camila Varela",
    tradeName: "Roma Indumentaria",
    slug: "roma-indumentaria",
    cuit: "27-39182910-4",
    phone: "+54 9 261 491-0293",
    email: "roma.moda@gmail.com",
    category: "Indumentaria y Calzado",
    subscriptionStatus: "past_due",
    trialEndsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    subscriptionEndsAt: null,
    planId: "formalizando",
    mrrAmount: 40000,
    productsCount: 180,
    salesCount: 65,
    notes: "Prueba venció hace 48hs. Pendiente transferencia bancaria.",
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
];

const INITIAL_LEADS: CrmLead[] = [
  {
    id: "lead-1",
    tenantId: "tenant-kiosco-central",
    businessName: "Kiosco Central 24hs",
    contactName: "Martín López",
    email: "martin.kiosco@gmail.com",
    phone: "+54 9 11 5829-1029",
    category: "Almacén y Kiosco",
    stage: "trial",
    selectedPlan: 'Plan "Estoy Arrancando"',
    estimatedMrr: 25000,
    source: "landing_page",
    trialStartedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    notes: "Cargó 95 productos. Está usando el lector de código de barras.",
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "lead-2",
    tenantId: "tenant-ferreteria-san-jose",
    businessName: "Ferretería San José",
    contactName: "Carlos Gómez",
    email: "administracion@sanjoseferreteria.com",
    phone: "+54 9 351 948-2819",
    category: "Ferretería y Corralón",
    stage: "contacted",
    selectedPlan: 'Plan "Imperio Multicomercio"',
    estimatedMrr: 60000,
    source: "landing_page",
    trialStartedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    trialEndsAt: new Date(Date.now() + 1 * 86400000).toISOString(),
    notes: "Hablamos por WhatsApp ayer. Pide ayuda para importar un Excel de 2.000 productos.",
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "lead-3",
    tenantId: "tenant-la25",
    businessName: "Autoservicio La 25",
    contactName: "Alejandro",
    email: "contacto@la25.com",
    phone: "+54 9 266 412-3456",
    category: "Minimarket / Supermercado",
    stage: "won",
    selectedPlan: 'Plan "Me Estoy Formalizando"',
    estimatedMrr: 40000,
    source: "direct",
    notes: "Cliente oficial activo. Factura por AFIP todos los días.",
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: "lead-4",
    businessName: "Panadería Don Pancho",
    contactName: "Francisco Rossi",
    email: "donpancho@gmail.com",
    phone: "+54 9 266 492-1928",
    category: "Gastronomía / Cafetería",
    stage: "lead",
    selectedPlan: 'Plan "Me Estoy Formalizando"',
    estimatedMrr: 40000,
    source: "whatsapp",
    notes: "Consultó precio para 2 cajas en el mostrador. Enviar video demostrativo.",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

const INITIAL_TRANSACTIONS: BillingTransaction[] = [
  {
    id: "tx-101",
    tenantId: "tenant-la25",
    tradeName: "Autoservicio La 25",
    amount: 40000,
    currency: "ARS",
    paymentMethod: "transfer",
    paymentStatus: "approved",
    planId: "formalizando",
    billingCycle: "monthly",
    periodStart: new Date(Date.now() - 5 * 86400000).toISOString(),
    periodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
    referenceId: "TRF-9281928",
    verifiedBy: "SuperAdmin",
    notes: "Comprobante de Banco Galicia verificado.",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const STORAGE_KEYS = {
  tenants: "jireh_crm_tenants",
  leads: "jireh_crm_leads",
  transactions: "jireh_crm_transactions",
};

export const crmService = {
  getTenants(): TenantAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.tenants);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(INITIAL_TENANTS));
      return INITIAL_TENANTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_TENANTS;
    }
  },

  getLeads(): CrmLead[] {
    const raw = localStorage.getItem(STORAGE_KEYS.leads);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_LEADS;
    }
  },

  getTransactions(): BillingTransaction[] {
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(INITIAL_TRANSACTIONS));
      return INITIAL_TRANSACTIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  },

  getStats(): CrmStats {
    const tenants = this.getTenants();
    const now = Date.now();
    const activeTenants = tenants.filter((t) => t.subscriptionStatus === "active").length;
    const activeTrials = tenants.filter(
      (t) => t.subscriptionStatus === "trial" && new Date(t.trialEndsAt).getTime() > now
    ).length;
    
    const expiringIn48h = tenants.filter((t) => {
      const trialMs = new Date(t.trialEndsAt).getTime();
      const diffHours = (trialMs - now) / (1000 * 3600);
      return t.subscriptionStatus === "trial" && diffHours > 0 && diffHours <= 48;
    }).length;

    const totalMrr = tenants
      .filter((t) => t.subscriptionStatus === "active")
      .reduce((sum, t) => sum + (t.mrrAmount || 0), 0);

    return {
      totalTenants: tenants.length,
      activeTenants,
      activeTrials,
      expiringIn48h,
      totalMrr,
    };
  },

  extendTrial(tenantId: string, days: number): TenantAccount {
    const tenants = this.getTenants();
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("Comercio no encontrado");

    const currentExpiry = new Date(tenant.trialEndsAt).getTime() > Date.now()
      ? new Date(tenant.trialEndsAt)
      : new Date();
    
    currentExpiry.setDate(currentExpiry.getDate() + days);
    tenant.trialEndsAt = currentExpiry.toISOString();
    tenant.subscriptionStatus = "trial";
    tenant.notes = `${tenant.notes || ""} [Prueba extendida +${days} días el ${new Date().toLocaleDateString()}]`;

    localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
    return tenant;
  },

  manualActivate(
    tenantId: string,
    planId: string,
    months: number,
    paymentMethod: "transfer" | "cash" | "card" | "mercadopago",
    amount: number,
    notes?: string
  ): { tenant: TenantAccount; transaction: BillingTransaction } {
    const tenants = this.getTenants();
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("Comercio no encontrado");

    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + months);

    tenant.subscriptionStatus = "active";
    tenant.planId = planId;
    tenant.mrrAmount = amount / months;
    tenant.subscriptionEndsAt = periodEnd.toISOString();
    tenant.notes = `${tenant.notes || ""} [Activado manualmente por ${months} mes(es) vía ${paymentMethod}]`;

    localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));

    // Registrar transacción
    const tx: BillingTransaction = {
      id: `tx-${Date.now()}`,
      tenantId: tenant.id,
      tradeName: tenant.tradeName,
      amount,
      currency: "ARS",
      paymentMethod,
      paymentStatus: "approved",
      planId,
      billingCycle: months >= 12 ? "annual" : "monthly",
      periodStart: now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      referenceId: `MANUAL-${Math.floor(100000 + Math.random() * 900000)}`,
      verifiedBy: "SuperAdmin",
      notes: notes || "Pago registrado desde CRM",
      createdAt: now.toISOString(),
    };

    const transactions = this.getTransactions();
    transactions.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));

    // Si había un lead asociado, pasarlo a 'won'
    const leads = this.getLeads();
    const lead = leads.find((l) => l.tenantId === tenantId);
    if (lead) {
      lead.stage = "won";
      localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(leads));
    }

    return { tenant, transaction: tx };
  },

  updateTenantStatus(tenantId: string, status: SubscriptionStatus): TenantAccount {
    const tenants = this.getTenants();
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("Comercio no encontrado");
    tenant.subscriptionStatus = status;
    localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
    return tenant;
  },

  updateLeadStage(leadId: string, stage: LeadStage): CrmLead {
    const leads = this.getLeads();
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead no encontrado");
    lead.stage = stage;
    localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(leads));
    return lead;
  },
};
