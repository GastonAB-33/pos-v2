export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  isActive: boolean;
}

export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export interface Tenant {
  id: string;
  legalName: string;
  tradeName: string;
  slug?: string | null;
  cuit: string;
  isActive: boolean;
  createdAt: string;
  defaultBranchId?: string | null;
  branches?: Branch[];
  // Campos SaaS de licenciamiento y prueba
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  planId?: string | null;
}
