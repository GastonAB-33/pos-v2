export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  isActive: boolean;
}

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
}
