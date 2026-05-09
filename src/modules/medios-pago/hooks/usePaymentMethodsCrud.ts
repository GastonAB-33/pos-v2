import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import {
  composePaymentMethodNotes,
  isSystemPaymentMethodCode,
  normalizePaymentMethodCode,
  paymentMethodsService,
} from "@/services/payment-methods.service";
import type { BankAccount, PaymentMethod } from "@/types/entities";
import type { PaymentMethodFormValues } from "@/modules/medios-pago/schemas/payment-method-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

export const usePaymentMethodsCrud = (tenantId: string | null, userId: string | null) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadPaymentMethods = useCallback(async () => {
    if (!tenantId) {
      setPaymentMethods([]);
      setBankAccounts([]);
      return;
    }

    setIsLoading(true);
    try {
      const [methods, accounts] = await Promise.all([
        paymentMethodsService.getAllByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
      ]);

      setPaymentMethods(methods);
      setBankAccounts(accounts.sort((a, b) => a.bank_name.localeCompare(b.bank_name)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los medios de pago" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPaymentMethods();
  }, [loadPaymentMethods]);

  const updatePaymentMethod = async (id: string, values: PaymentMethodFormValues) => {
    if (!tenantId) return false;

    const existing = paymentMethods.find((method) => method.id === id);
    if (!existing) {
      setFeedback({ type: "error", message: "No se encontro el medio de pago a editar" });
      return false;
    }

    const normalizedCode = normalizePaymentMethodCode(existing.code);
    if (!isSystemPaymentMethodCode(normalizedCode)) {
      setFeedback({ type: "error", message: "Solo se pueden editar medios del catalogo fijo" });
      return false;
    }

    setIsSubmitting(true);
    try {
      const updated = await paymentMethodsService.update(tenantId, id, {
        surcharge_percent: Number(values.surcharge_percent),
        discount_percent: Number(values.discount_percent),
        notes: composePaymentMethodNotes(normalizedCode, values.notes, values.config),
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "medios_pago",
        action: "update",
        entity_type: "payment_method",
        entity_id: updated?.id ?? id,
        description: `Configuracion de medio de pago actualizada: ${existing.name}`,
        metadata: {
          code: existing.code,
          surcharge_percent: values.surcharge_percent,
          discount_percent: values.discount_percent,
          config: values.config,
        },
      });

      setFeedback({ type: "success", message: "Configuracion de medio de pago actualizada" });
      await loadPaymentMethods();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar el medio de pago" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePaymentMethod = async (id: string) => {
    if (!tenantId) return false;
    const target = paymentMethods.find((method) => method.id === id);

    setIsSubmitting(true);
    try {
      const updated = await paymentMethodsService.toggleActive(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "medios_pago",
        action: "toggle_active",
        entity_type: "payment_method",
        entity_id: updated?.id ?? id,
        description: `Medio de pago ${updated?.is_active ? "activado" : "desactivado"}${updated ? `: ${updated.name}` : ""}`,
        metadata: {
          previous_is_active: target?.is_active ?? null,
          next_is_active: updated?.is_active ?? null,
        },
      });
      setFeedback({ type: "success", message: "Estado de medio de pago actualizado" });
      await loadPaymentMethods();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar el estado" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPaymentMethods = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = [...paymentMethods];

    if (!term) return base;

    return base.filter((method) =>
      [method.name, method.code, method.type]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [paymentMethods, search]);

  return {
    paymentMethods: filteredPaymentMethods,
    bankAccounts,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadPaymentMethods,
    updatePaymentMethod,
    togglePaymentMethod,
  };
};
