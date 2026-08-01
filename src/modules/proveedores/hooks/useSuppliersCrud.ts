import { useCallback, useEffect, useMemo, useState } from "react";
import { suppliersService } from "@/services/suppliers.service";
import type { Supplier } from "@/types/entities";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import { toSupplierServiceInput } from "@/modules/proveedores/utils/supplier-input";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

export const useSuppliersCrud = (tenantId: string | null) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadSuppliers = useCallback(async () => {
    if (!tenantId) {
      setSuppliers([]);
      return;
    }

    setIsLoading(true);
    try {
      const list = await suppliersService.getAllByTenant(tenantId);
      setSuppliers(list);
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los proveedores" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const createSupplier = async (values: SupplierFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      await suppliersService.create(tenantId, toSupplierServiceInput(values));
      setFeedback({ type: "success", message: "Proveedor creado" });
      await loadSuppliers();
    } catch {
      setFeedback({ type: "error", message: "Error al crear proveedor" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSupplier = async (supplierId: string, values: SupplierFormValues) => {
    if (!tenantId) return;

    const existing = suppliers.find((supplier) => supplier.id === supplierId);
    if (!existing) return;

    setIsSubmitting(true);
    try {
      await suppliersService.update(
        tenantId,
        supplierId,
        toSupplierServiceInput(values, {
          existingCode: existing.code,
          isActive: existing.is_active,
        })
      );
      setFeedback({ type: "success", message: "Proveedor actualizado" });
      await loadSuppliers();
    } catch {
      setFeedback({ type: "error", message: "Error al actualizar proveedor" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      await suppliersService.delete(tenantId, supplierId);
      setFeedback({ type: "success", message: "Proveedor eliminado" });
      await loadSuppliers();
    } catch {
      setFeedback({ type: "error", message: "Error al eliminar proveedor" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSupplierActive = async (supplierId: string) => {
    if (!tenantId) return;

    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return;

    setIsSubmitting(true);
    try {
      await suppliersService.update(tenantId, supplierId, { is_active: !supplier.is_active });
      setFeedback({
        type: "success",
        message: supplier.is_active ? "Proveedor desactivado" : "Proveedor activado",
      });
      await loadSuppliers();
    } catch {
      setFeedback({ type: "error", message: "Error al cambiar estado del proveedor" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const base = [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return base;

    return base.filter((supplier) =>
      [supplier.name, supplier.phone ?? "", supplier.email ?? "", supplier.address ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [suppliers, search]);

  return {
    suppliers: filteredSuppliers,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    toggleSupplierActive,
  };
};

