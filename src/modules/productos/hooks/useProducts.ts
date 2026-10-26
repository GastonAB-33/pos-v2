import { ensureTenantReturnablePackage } from "@/utils/returnable-packages";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/types/entities";
import { useProductsCrud } from "@/modules/productos/hooks/useProductsCrud";
import { mapEntityToProductViewModel, productsModuleService } from "@/modules/productos/services/products.service";
import { downloadXlsx } from "@/utils/xlsx";
import { matchesProductSearch } from "@/utils/search";
import type {
  ProductAuditEntry,
  ProductFiltersState,
  ProductFormModalValues,
  ProductSortField,
  ProductSortState,
  ProductViewModel,
} from "@/modules/productos/types/product.types";

const defaultFilters: ProductFiltersState = {
  search: "",
  searchScope: "all",
  category: "",
  subcategory: "",
  supplier: "",
  saleMode: "all",
};

export const useProducts = (tenantId: string | null, userId: string | null) => {
  const crud = useProductsCrud(tenantId, userId);
  const [filters, setFilters] = useState<ProductFiltersState>(defaultFilters);
  const [sort, setSort] = useState<ProductSortState>({ field: "nombre", direction: "asc" });
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

  const barcodesByProductId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [productId, barcode] of Object.entries(crud.primaryBarcodes)) {
      if (barcode && barcode.trim()) {
        map.set(productId, [barcode.trim()]);
      }
    }
    return map;
  }, [crud.primaryBarcodes]);

  const filteredProducts = useMemo(() => {
    const rawSearch = filters.search.trim();
    const scope = filters.searchScope || "all";

    return productsView.filter((product) => {
      const barcode = crud.primaryBarcodes[product.entity.id] ?? product.codigoBarras;

      const matches = !rawSearch || matchesProductSearch(
        {
          name: product.nombre,
          code: product.codigoProducto,
          barcode,
          category: product.categoria,
          subcategory: product.subcategoria,
          supplier: product.proveedor,
        },
        rawSearch,
        scope
      );

      if (!matches) return false;

      // Si no hay búsqueda o la búsqueda es solo por nombre, aplicar filtros de categoría estrictos.
      // Si se busca por código o código de barras y coincide, se permite encontrar el producto.
      const isCodeOrBarcodeSearch = scope === "code" || scope === "barcode";
      if (!isCodeOrBarcodeSearch) {
        if (filters.category && product.categoria !== filters.category) return false;
        if (filters.subcategory && product.subcategoria !== filters.subcategory) return false;
        if (filters.supplier && product.proveedor !== filters.supplier) return false;
      }

      // Filtro por modalidad de venta (por unidad o pesables)
      if (filters.saleMode && filters.saleMode !== "all") {
        if (product.saleMode !== filters.saleMode) return false;
      }

      return true;
    });
  }, [barcodesByProductId, filters, productsView]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (!sort) return list;

    return list.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case "nombre":
          comparison = (a.nombre || "").localeCompare(b.nombre || "", "es-AR", {
            numeric: true,
            sensitivity: "base",
          });
          break;
        case "categoria":
          comparison = (a.categoria || "").localeCompare(b.categoria || "", "es-AR", {
            numeric: true,
            sensitivity: "base",
          });
          break;
        case "subcategoria":
          comparison = (a.subcategoria || "").localeCompare(b.subcategoria || "", "es-AR", {
            numeric: true,
            sensitivity: "base",
          });
          break;
        case "precioFinal":
          comparison = (a.precioFinal ?? 0) - (b.precioFinal ?? 0);
          break;
        case "stock":
          comparison = (a.stock ?? 0) - (b.stock ?? 0);
          break;
        case "trackStock":
          comparison =
            (Number(a.trackStock) - Number(b.trackStock)) ||
            (Number(a.activo) - Number(b.activo));
          break;
      }
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredProducts, sort]);

  const toggleSort = (field: ProductSortField) => {
    setSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        field,
        direction: "asc",
      };
    });
  };

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
      imagenUrl: values.imagenUrl?.trim() ?? "",
    };

    if (tenantId && payload.isReturnable && payload.returnablePackageName?.trim()) {
      void ensureTenantReturnablePackage(tenantId, payload.returnablePackageName.trim(), payload.returnablePackagePrice);
    }

    if (mode === "create") {
      await crud.createProduct(payload, {
        isActive: payload.estadoActivo,
        isFavorite: payload.favorito,
      });
      void reloadAudit();
      return;
    }

    if (!targetProduct) return;

    await crud.updateProduct(targetProduct.id, payload, {
      isActive: payload.estadoActivo,
      isFavorite: payload.favorito,
    });
    void reloadAudit();
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

  const toggleStockTracking = async (product: ProductViewModel) => {
    await crud.toggleProductStockTracking(product.entity.id);
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

  const reload = useCallback(
    async (force = true) => {
      await crud.reload(force);
    },
    [crud]
  );

  return {
    ...crud,
    reload,
    filters,
    setFilters: updateFilters,
    resetFilters,
    selectedIds: visibleSelectedIds,
    filteredProducts,
    sortedProducts,
    sort,
    setSort,
    toggleSort,
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
    toggleStockTracking,
    toggleActive,
    productsView,
    barcodesByProductId,
    reloadAudit,
    exportAuditXlsx,
  };
};
