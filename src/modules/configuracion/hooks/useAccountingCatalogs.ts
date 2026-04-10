import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { installmentPlansService } from "@/services/installment-plans.service";
import { originBanksService } from "@/services/origin-banks.service";
import type { BankAccount, InstallmentPlan, OriginBank } from "@/types/entities";

interface AccountingFeedback {
  type: "success" | "error";
  message: string;
}

interface UpsertBankAccountInput {
  bank_name: string;
  account_type: BankAccount["account_type"];
  holder_name: string;
  cbu: string | null;
  alias: string | null;
  currency_code: string;
  notes: string | null;
  is_active: boolean;
}

interface UpsertOriginBankInput {
  code: string;
  name: string;
  is_active: boolean;
}

interface UpsertInstallmentPlanInput {
  code: string;
  name: string;
  installments: number;
  interest_percent: number;
  card_brand: string | null;
  notes: string | null;
  is_active: boolean;
}

export const useAccountingCatalogs = (
  tenantId: string | null,
  userId: string | null,
  enabled: boolean
) => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [originBanks, setOriginBanks] = useState<OriginBank[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<AccountingFeedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const load = useCallback(async () => {
    if (!tenantId || !enabled) {
      setBankAccounts([]);
      setOriginBanks([]);
      setInstallmentPlans([]);
      return;
    }

    setIsLoading(true);
    try {
      await Promise.allSettled([
        originBanksService.ensureDefaults(tenantId),
        installmentPlansService.ensureDefaults(tenantId),
      ]);

      const [accountsRows, originRows, plansRows] = await Promise.all([
        bankAccountsService.getAllByTenant(tenantId),
        originBanksService.getAllByTenant(tenantId),
        installmentPlansService.getAllByTenant(tenantId),
      ]);

      setBankAccounts(
        [...accountsRows].sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.bank_name.localeCompare(b.bank_name, "es");
        })
      );

      setOriginBanks(
        [...originRows].sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.name.localeCompare(b.name, "es");
        })
      );

      setInstallmentPlans(
        [...plansRows].sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          if (a.installments !== b.installments) return a.installments - b.installments;
          return a.name.localeCompare(b.name, "es");
        })
      );
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo cargar la configuracion contable.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [enabled, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const logAudit = useCallback(
    async (
      action: string,
      entityType: string,
      entityId: string | null,
      description: string,
      metadata: Record<string, unknown>
    ) => {
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "configuracion",
        action,
        entity_type: entityType,
        entity_id: entityId,
        description,
        metadata,
      });
    },
    [tenantId, userId]
  );

  const upsertBankAccount = useCallback(
    async (input: UpsertBankAccountInput, id?: string) => {
      if (!tenantId) return null;

      const payload = {
        bank_name: input.bank_name.trim(),
        account_type: input.account_type,
        holder_name: input.holder_name.trim(),
        cbu: input.cbu?.trim() || null,
        alias: input.alias?.trim() || null,
        currency_code: input.currency_code.trim().toUpperCase() || "ARS",
        notes: input.notes?.trim() || null,
        is_active: input.is_active,
      } satisfies UpsertBankAccountInput;

      if (!payload.bank_name || !payload.holder_name) {
        setFeedback({
          type: "error",
          message: "Banco y titular son obligatorios en cuenta bancaria.",
        });
        return null;
      }

      try {
        const row = id
          ? await bankAccountsService.update(tenantId, id, payload)
          : await bankAccountsService.create(tenantId, payload);

        if (!row) {
          setFeedback({
            type: "error",
            message: "No se pudo guardar la cuenta bancaria.",
          });
          return null;
        }

        await logAudit(
          id ? "update_bank_account" : "create_bank_account",
          "bank_account",
          row.id,
          `${id ? "Cuenta bancaria editada" : "Cuenta bancaria creada"}: ${row.bank_name}`,
          {
            bank_name: row.bank_name,
            account_type: row.account_type,
            currency_code: row.currency_code,
            is_active: row.is_active,
          }
        );

        await load();
        setFeedback({
          type: "success",
          message: "Cuenta bancaria guardada.",
        });
        return row;
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo guardar la cuenta bancaria.",
        });
        return null;
      }
    },
    [load, logAudit, tenantId]
  );

  const toggleBankAccount = useCallback(
    async (id: string) => {
      if (!tenantId) return;
      try {
        const updated = await bankAccountsService.toggleActive(tenantId, id);
        if (!updated) return;

        await logAudit(
          "toggle_bank_account",
          "bank_account",
          updated.id,
          `Cuenta bancaria ${updated.is_active ? "activada" : "desactivada"}: ${updated.bank_name}`,
          { is_active: updated.is_active }
        );
        await load();
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo actualizar estado de cuenta bancaria.",
        });
      }
    },
    [load, logAudit, tenantId]
  );

  const upsertOriginBank = useCallback(
    async (input: UpsertOriginBankInput, id?: string) => {
      if (!tenantId) return null;
      const normalizedCode = input.code.trim().toLowerCase() || input.name.trim().toLowerCase();
      const payload = {
        code: normalizedCode.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "banco",
        name: input.name.trim(),
        is_active: input.is_active,
      } satisfies UpsertOriginBankInput;

      if (!payload.name) {
        setFeedback({
          type: "error",
          message: "El nombre del banco de origen es obligatorio.",
        });
        return null;
      }

      try {
        const row = id
          ? await originBanksService.update(tenantId, id, payload)
          : await originBanksService.createOrFindByName(tenantId, payload.name);

        if (!row) {
          setFeedback({
            type: "error",
            message: "No se pudo guardar el banco de origen.",
          });
          return null;
        }

        await logAudit(
          id ? "update_origin_bank" : "create_origin_bank",
          "origin_bank",
          row.id,
          `${id ? "Banco de origen editado" : "Banco de origen creado"}: ${row.name}`,
          { code: row.code, is_active: row.is_active }
        );
        await load();
        setFeedback({
          type: "success",
          message: "Banco de origen guardado.",
        });
        return row;
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo guardar el banco de origen.",
        });
        return null;
      }
    },
    [load, logAudit, tenantId]
  );

  const toggleOriginBank = useCallback(
    async (id: string) => {
      if (!tenantId) return;
      try {
        const updated = await originBanksService.toggleActive(tenantId, id);
        if (!updated) return;

        await logAudit(
          "toggle_origin_bank",
          "origin_bank",
          updated.id,
          `Banco de origen ${updated.is_active ? "activado" : "desactivado"}: ${updated.name}`,
          { is_active: updated.is_active }
        );
        await load();
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo actualizar estado del banco de origen.",
        });
      }
    },
    [load, logAudit, tenantId]
  );

  const upsertInstallmentPlan = useCallback(
    async (input: UpsertInstallmentPlanInput, id?: string) => {
      if (!tenantId) return null;
      const payload = {
        code: input.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        name: input.name.trim(),
        installments: Math.max(1, Math.floor(input.installments)),
        interest_percent: Number(Math.max(0, input.interest_percent).toFixed(2)),
        card_brand: input.card_brand?.trim() || null,
        notes: input.notes?.trim() || null,
        is_active: input.is_active,
      } satisfies UpsertInstallmentPlanInput;

      if (!payload.name) {
        setFeedback({
          type: "error",
          message: "El nombre del plan es obligatorio.",
        });
        return null;
      }

      if (!payload.code) {
        payload.code = `plan_${payload.installments}_${Date.now().toString().slice(-4)}`;
      }

      try {
        const row = id
          ? await installmentPlansService.update(tenantId, id, payload)
          : await installmentPlansService.create(tenantId, payload);

        if (!row) {
          setFeedback({
            type: "error",
            message: "No se pudo guardar el plan de cuotas.",
          });
          return null;
        }

        await logAudit(
          id ? "update_installment_plan" : "create_installment_plan",
          "installment_plan",
          row.id,
          `${id ? "Plan de cuotas editado" : "Plan de cuotas creado"}: ${row.name}`,
          {
            installments: row.installments,
            interest_percent: row.interest_percent,
            card_brand: row.card_brand,
            is_active: row.is_active,
          }
        );
        await load();
        setFeedback({
          type: "success",
          message: "Plan de cuotas guardado.",
        });
        return row;
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo guardar el plan de cuotas.",
        });
        return null;
      }
    },
    [load, logAudit, tenantId]
  );

  const toggleInstallmentPlan = useCallback(
    async (id: string) => {
      if (!tenantId) return;
      try {
        const updated = await installmentPlansService.toggleActive(tenantId, id);
        if (!updated) return;

        await logAudit(
          "toggle_installment_plan",
          "installment_plan",
          updated.id,
          `Plan de cuotas ${updated.is_active ? "activado" : "desactivado"}: ${updated.name}`,
          { is_active: updated.is_active }
        );
        await load();
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo actualizar estado del plan de cuotas.",
        });
      }
    },
    [load, logAudit, tenantId]
  );

  return {
    bankAccounts,
    originBanks,
    installmentPlans,
    isLoading,
    feedback,
    clearFeedback,
    reload: load,
    upsertBankAccount,
    toggleBankAccount,
    upsertOriginBank,
    toggleOriginBank,
    upsertInstallmentPlan,
    toggleInstallmentPlan,
  };
};

export type {
  UpsertBankAccountInput,
  UpsertOriginBankInput,
  UpsertInstallmentPlanInput,
};

