export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export type LeadStage = "lead" | "trial" | "contacted" | "won" | "lost";

export interface TenantAccount {
  id: string;
  legalName: string;
  tradeName: string;
  slug: string;
  cuit: string;
  phone: string;
  email: string;
  category: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  planId: string;
  mrrAmount: number;
  productsCount: number;
  salesCount: number;
  notes?: string;
  createdAt: string;
}

export interface CrmLead {
  id: string;
  tenantId?: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  stage: LeadStage;
  selectedPlan: string;
  estimatedMrr: number;
  source: string;
  notes?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  createdAt: string;
}

export interface BillingTransaction {
  id: string;
  tenantId: string;
  tradeName: string;
  amount: number;
  currency: string;
  paymentMethod: "mercadopago" | "transfer" | "cash" | "card";
  paymentStatus: "approved" | "pending" | "rejected";
  planId: string;
  billingCycle: "monthly" | "annual";
  periodStart: string;
  periodEnd: string;
  referenceId?: string;
  verifiedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface CrmStats {
  totalTenants: number;
  activeTenants: number;
  activeTrials: number;
  expiringIn48h: number;
  totalMrr: number;
}
