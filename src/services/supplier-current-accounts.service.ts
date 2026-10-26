import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import { suppliersService } from "@/services/suppliers.service";
import type { SupplierCurrentAccountMovement } from "@/types/entities";

const movementsCrud = new TenantCrudService<SupplierCurrentAccountMovement>(
  dbTables.supplier_current_account_movements
);

export type CreateSupplierCurrentAccountMovementInput = Omit<
  CreateEntityInput<SupplierCurrentAccountMovement>,
  "balance_after" | "purchase_id" | "notes" | "payment_method_id" | "payment_method_code" | "created_by"
> & {
  purchase_id?: string | null;
  notes?: string | null;
  payment_method_id?: string | null;
  payment_method_code?: string | null;
  created_by?: string | null;
};

const normalizeAmountByType = (
  type: SupplierCurrentAccountMovement["type"],
  amount: number
): number => {
  const absAmount = Math.abs(amount);
  if (type === "debt") return absAmount;
  if (type === "payment") return -absAmount;
  return amount;
};

export const supplierCurrentAccountsService = {
  getAllByTenant: (tenantId: string) => movementsCrud.getAllByTenant(tenantId),

  getBySupplier: async (
    tenantId: string,
    supplierId: string
  ): Promise<SupplierCurrentAccountMovement[]> => {
    const all = await movementsCrud.getAllByTenant(tenantId);
    return all
      .filter((m) => m.supplier_id === supplierId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  getSupplierBalance: async (tenantId: string, supplierId: string): Promise<number> => {
    const supplier = await suppliersService.getById(tenantId, supplierId);
    return supplier?.current_balance ?? 0;
  },

  createMovement: async (
    tenantId: string,
    payload: CreateSupplierCurrentAccountMovementInput
  ): Promise<SupplierCurrentAccountMovement> => {
    const supplier = await suppliersService.getById(tenantId, payload.supplier_id);
    if (!supplier) {
      throw new Error("Proveedor no encontrado para registrar movimiento");
    }

    const currentBal = supplier.current_balance ?? 0;
    const signedDelta = normalizeAmountByType(payload.type, payload.amount);
    const nextBalance = Number((currentBal + signedDelta).toFixed(2));

    const movement = await movementsCrud.create(tenantId, {
      supplier_id: payload.supplier_id,
      purchase_id: payload.purchase_id ?? null,
      type: payload.type,
      amount: Math.abs(payload.amount),
      balance_after: nextBalance,
      notes: payload.notes ?? null,
      payment_method_id: payload.payment_method_id ?? null,
      payment_method_code: payload.payment_method_code ?? null,
      created_by: payload.created_by ?? null,
    });

    await suppliersService.update(tenantId, payload.supplier_id, {
      current_balance: nextBalance,
    });

    return movement;
  },

  registerDebt: async (
    tenantId: string,
    params: {
      supplierId: string;
      purchaseId?: string;
      amount: number;
      notes?: string;
      createdBy?: string;
    }
  ) => {
    return supplierCurrentAccountsService.createMovement(tenantId, {
      supplier_id: params.supplierId,
      purchase_id: params.purchaseId ?? null,
      type: "debt",
      amount: params.amount,
      notes: params.notes ?? "Compra a crédito",
      created_by: params.createdBy ?? null,
    });
  },

  registerPayment: async (
    tenantId: string,
    params: {
      supplierId: string;
      amount: number;
      paymentMethodId?: string;
      notes?: string;
      createdBy?: string;
    }
  ) => {
    return supplierCurrentAccountsService.createMovement(tenantId, {
      supplier_id: params.supplierId,
      type: "payment",
      amount: params.amount,
      payment_method_id: params.paymentMethodId ?? null,
      notes: params.notes ?? "Pago a cuenta corriente",
      created_by: params.createdBy ?? null,
    });
  },
};
