import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import type { PaymentMethodFormValues } from "@/modules/medios-pago/schemas/payment-method-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const normalizeText = (value?: string) => (value?.trim() ? value.trim() : null);
const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, "_");

export const usePaymentMethodsCrud = (tenantId: string | null, userId: string | null) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadPaymentMethods = useCallback(async () => {
    if (!tenantId) {
      setPaymentMethods([]);
      return;
    }

    setIsLoading(true);
    try {
      await paymentMethodsService.ensureDefaultMethods(tenantId);
      const list = await paymentMethodsService.getAllByTenant(tenantId);
      setPaymentMethods(list);
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los medios de pago" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPaymentMethods();
  }, [loadPaymentMethods]);

  const createPaymentMethod = async (values: PaymentMethodFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await paymentMethodsService.create(tenantId, {
        name: values.name.trim(),
        code: normalizeCode(values.code),
        type: values.type,
        is_active: true,
        affects_cash: values.affects_cash,
        surcharge_percent: Number(values.surcharge_percent),
        discount_percent: Number(values.discount_percent),
        notes: normalizeText(values.notes),
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "medios_pago",
        action: "create",
        entity_type: "payment_method",
        entity_id: created.id,
        description: `Medio de pago creado: ${created.name}`,
        metadata: {
          code: created.code,
          type: created.type,
          affects_cash: created.affects_cash,
          is_active: created.is_active,
        },
      });

      setFeedback({ type: "success", message: "Medio de pago creado" });
      await loadPaymentMethods();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear el medio de pago" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePaymentMethod = async (id: string, values: PaymentMethodFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const updated = await paymentMethodsService.update(tenantId, id, {
        name: values.name.trim(),
        code: normalizeCode(values.code),
        type: values.type,
        affects_cash: values.affects_cash,
        surcharge_percent: Number(values.surcharge_percent),
        discount_percent: Number(values.discount_percent),
        notes: normalizeText(values.notes),
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "medios_pago",
        action: "update",
        entity_type: "payment_method",
        entity_id: updated?.id ?? id,
        description: `Medio de pago actualizado: ${values.name.trim()}`,
        metadata: {
          code: normalizeCode(values.code),
          type: values.type,
          affects_cash: values.affects_cash,
        },
      });

      setFeedback({ type: "success", message: "Medio de pago actualizado" });
      await loadPaymentMethods();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar el medio de pago" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePaymentMethod = async (id: string) => {
    if (!tenantId) return;
    const target = paymentMethods.find((method) => method.id === id);

    setIsSubmitting(true);
    try {
      await paymentMethodsService.delete(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "medios_pago",
        action: "delete",
        entity_type: "payment_method",
        entity_id: id,
        description: `Medio de pago eliminado${target ? `: ${target.name}` : ""}`,
        metadata: target
          ? {
              code: target.code,
              type: target.type,
            }
          : null,
      });
      setFeedback({ type: "success", message: "Medio de pago eliminado" });
      await loadPaymentMethods();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar el medio de pago" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePaymentMethod = async (id: string) => {
    if (!tenantId) return;
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
      setFeedback({ type: "success", message: "Estado actualizado" });
      await loadPaymentMethods();
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar el estado" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPaymentMethods = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = [...paymentMethods].sort((a, b) => a.name.localeCompare(b.name));

    if (!term) return base;

    return base.filter((method) =>
      [method.name, method.code, method.type, method.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [paymentMethods, search]);

  return {
    paymentMethods: filteredPaymentMethods,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    togglePaymentMethod,
  };
};
