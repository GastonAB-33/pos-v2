import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/types/entities";
import { useProductsCrud } from "@/modules/productos/hooks/useProductsCrud";
import { mapEntityToProductViewModel, productsModuleService } from "@/modules/productos/services/products.service";
import { downloadXlsx } from "@/utils/xlsx";
import type {
  ProductAuditEntry,
  ProductFiltersState,
  ProductFormModalValues,
  ProductViewModel,
} from "@/modules/productos/types/product.types";

const defaultFilters: ProductFiltersState = {
  search: "",
  category: "",
  subcategory: "",
  supplier: "",
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const useProducts = (tenantId: string | null, userId: string | null) => {
  const crud = useProductsCrud(tenantId, userId);
  const [filters, setFilters] = useState<ProductFiltersState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [auditLog, setAuditLog] = useState<ProductAuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const productsView = useMemo<ProductViewModel[]>(
    () =>
      crud.products.map((product) =>
        mapEntityToProductViewModel(product, crud.primaryBarcodes[product.id] ?? "")
      ),
    [crud.products, crud.primaryBarcodes]
  );

  const categoryOptions = useMemo(
    () =>
      [...new Set(productsView.map((product) => product.categoria).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [productsView]
  );

  const subcategoryOptions = useMemo(
    () =>
      [...new Set(productsView.map((product) => product.subcategoria).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [productsView]
  );

  const supplierOptions = useMemo(
    () =>
      [...new Set(productsView.map((product) => product.proveedor).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [productsView]
  );

  const filteredProducts = useMemo(() => {
    const search = normalize(filters.search);

    return productsView.filter((product) => {
      if (filters.category && product.categoria !== filters.category) return false;
      if (filters.subcategory && product.subcategoria !== filters.subcategory) return false;
      if (filters.supplier && product.proveedor !== filters.supplier) return false;

      if (!search) return true;

      const searchTarget = [
        product.nombre,
        product.codigoProducto,
        product.codigoBarras,
        product.categoria,
        product.subcategoria,
      ]
        .join(" ")
        .toLowerCase();

      return searchTarget.includes(search);
    });
  }, [filters, productsView]);

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => filteredProducts.some((product) => product.entity.id === id)),
    [filteredProducts, selectedIds]
  );

  const reloadAudit = useCallback(async () => {
    if (!tenantId) {
      setAuditLog([]);
      return;
    }

    setIsLoadingAudit(true);
    try {
      const rows = await productsModuleService.getProductAuditLog(tenantId, 30);
      setAuditLog(rows);
    } catch {
      setAuditLog([]);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void reloadAudit();
  }, [reloadAudit, productsView.length]);

  const updateFilters = (patch: Partial<ProductFiltersState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedIds([]);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setSelectedIds([]);
  };

  const toggleSelected = (productId: string, selected: boolean) => {
    setSelectedIds((current) => {
      if (selected) {
        if (current.includes(productId)) return current;
        return [...current, productId];
      }

      return current.filter((id) => id !== productId);
    });
  };

  const toggleSelectAllVisible = (selected: boolean) => {
    if (!selected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(filteredProducts.map((product) => product.entity.id));
  };

  const saveProduct = async (
    mode: "create" | "edit",
    values: ProductFormModalValues,
    targetProduct?: Product | null
  ) => {
    const payload: ProductFormModalValues = {
      ...values,
      nombre: values.nombre?.trim() ?? "",
      categoria: values.categoria?.trim() ?? "",
      subcategoria: values.subcategoria?.trim() ?? "",
      codigoProducto: values.codigoProducto?.trim() ?? "",
      codigoBarras: values.codigoBarras?.trim() ?? "",
    };

    if (mode === "create") {
      await crud.createProduct(payload, {
        isActive: payload.estadoActivo,
        isFavorite: payload.favorito,
      });
      await reloadAudit();
      return;
    }

    if (!targetProduct) return;

    await crud.updateProduct(targetProduct.id, payload, {
      isActive: payload.estadoActivo,
      isFavorite: payload.favorito,
    });
    await reloadAudit();
  };

  const deleteSelected = async () => {
    const ids = [...visibleSelectedIds];
    if (!ids.length) return;

    await crud.deleteProductsBulk(ids);
    setSelectedIds([]);
    await reloadAudit();
  };

  const deleteOne = async (product: ProductViewModel) => {
    await crud.deleteProduct(product.entity.id);
    setSelectedIds((current) => current.filter((id) => id !== product.entity.id));
    await reloadAudit();
  };

  const toggleFavorite = async (product: ProductViewModel) => {
    await crud.toggleProductFavorite(product.entity.id);
    await reloadAudit();
  };

  const toggleActive = async (product: ProductViewModel) => {
    await crud.toggleProductActive(product.entity.id);
    await reloadAudit();
  };

  const exportAuditXlsx = async () => {
    if (!auditLog.length) return false;

    return downloadXlsx(
      `historial-productos-${new Date().toISOString().slice(0, 10)}`,
      "Historial Productos",
      auditLog.map((entry) => ({
        fecha: entry.date,
        usuario: entry.user,
        accion: entry.action,
        detalle: entry.description,
      }))
    );
  };

  return {
    ...crud,
    filters,
    setFilters: updateFilters,
    resetFilters,
    selectedIds: visibleSelectedIds,
    filteredProducts,
    categoryOptions,
    subcategoryOptions,
    supplierOptions,
    auditLog,
    isLoadingAudit,
    setSelectedIds,
    toggleSelected,
    toggleSelectAllVisible,
    saveProduct,
    deleteSelected,
    deleteOne,
    toggleFavorite,
    toggleActive,
    reloadAudit,
    exportAuditXlsx,
  };
};
