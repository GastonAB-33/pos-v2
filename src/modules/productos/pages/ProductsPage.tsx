import { useMemo, useState } from "react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { useToast } from "@/components/ui/useToast";
import { useProductsStore } from "@/features/products/store/products.store";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { BarcodeGeneratorModal } from "@/modules/productos/components/BarcodeGeneratorModal";
import { ProductAuditLog } from "@/modules/productos/components/ProductAuditLog";
import { ProductFilters } from "@/modules/productos/components/ProductFilters";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import { ProductImportModal } from "@/modules/productos/components/ProductImportModal";
import { ProductQuickPriceModal } from "@/modules/productos/components/ProductQuickPriceModal";
import { ProductTable } from "@/modules/productos/components/ProductTable";
import { useProducts } from "@/modules/productos/hooks/useProducts";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";

type ProductModalState = {
  mode: "create" | "edit";
  product: ProductViewModel | null;
  initialBarcode?: string | null;
  initialName?: string | null;
  fromQuickPrice?: boolean;
};

export const ProductsPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadProductos = canRead("productos");
  const canWriteProductos = canWrite("productos");
  const { syncNow, isSyncing, clearSyncError } = useOffline();
  const { success: toastSuccess, error: toastError } = useToast();

  const products = useProducts(tenantId, user?.id ?? null);

  const [formModal, setFormModal] = useState<ProductModalState | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductViewModel | null>(null);
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [quickPriceInitialQuery, setQuickPriceInitialQuery] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCatalog = async () => {
    if (isRefreshing || isSyncing) return;
    setIsRefreshing(true);
    clearSyncError();

    try {
      const results = await Promise.allSettled([
        syncNow(),
        products.reload(true),
        products.reloadAudit(),
      ]);

      const hasError = results.some((r) => r.status === "rejected");
      if (hasError) {
        toastError("No se pudieron actualizar todos los datos del catálogo.");
      } else {
        const count = useProductsStore.getState().products.length;
        toastSuccess(`Catálogo actualizado (${count} productos).`);
      }
    } catch {
      toastError("Error al sincronizar productos desde el servidor.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useBarcodeScanner({
    enabled: !formModal && !barcodeProduct && !importOpen && !quickPriceOpen,
    onScan: (scannedBarcode) => {
      const clean = scannedBarcode.trim();
      if (clean) {
        products.setFilters({
          search: clean,
          category: "",
          subcategory: "",
          supplier: "",
        });
      }
    },
  });

  const selectedCount = products.selectedIds.length;
  const filteredProductsKey = JSON.stringify(products.filters);
  const paginatedProducts = usePagination(products.filteredProducts, 10, filteredProductsKey);
  const pageProductIds = paginatedProducts.pageItems.map((product) => product.entity.id);

  const sortedAudit = useMemo(
    () => [...products.auditLog].sort((a, b) => b.date.localeCompare(a.date)),
    [products.auditLog]
  );

  if (!tenantId) {
    return <section className="ui-panel">No hay un comercio activo.</section>;
  }

  if (!canReadProductos) {
    return <section className="ui-panel">No tenés permisos para ver este módulo.</section>;
  }

  const handleSaveProduct = async (values: ProductFormModalValues) => {
    const wasFromQuickPrice = formModal?.fromQuickPrice;
    await products.saveProduct(formModal?.mode ?? "create", values, formModal?.product?.entity ?? null);
    setFormModal(null);
    if (wasFromQuickPrice) {
      setQuickPriceInitialQuery(values.codigoBarras || values.codigoProducto || values.nombre || null);
      setQuickPriceOpen(true);
    }
  };

  const handleCloseFormModal = () => {
    const wasFromQuickPrice = formModal?.fromQuickPrice;
    setFormModal(null);
    if (wasFromQuickPrice) {
      setQuickPriceOpen(true);
    }
  };

  const handleOpenCreateFromQuickPrice = (query?: string) => {
    setQuickPriceOpen(false);
    const trimmed = query?.trim() ?? "";
    const isBarcodeLike = trimmed.length >= 6 && /^\d+$/.test(trimmed);
    setFormModal({
      mode: "create",
      product: null,
      initialBarcode: isBarcodeLike ? trimmed : null,
      initialName: !isBarcodeLike && trimmed ? trimmed : null,
      fromQuickPrice: true,
    });
  };

  return (
    <section className="ui-panel operational-page product-catalog-page space-y-4 w-full min-w-0 max-w-full overflow-hidden">
      <ProductFilters
          canWrite={canWriteProductos}
          loading={products.isLoading || products.isSubmitting}
          isRefreshing={isRefreshing || isSyncing}
          selectedCount={selectedCount}
          filteredCount={products.filteredProducts.length}
          filters={products.filters}
          categories={products.categoryOptions}
          subcategories={products.subcategoryOptions}
          suppliers={products.supplierOptions}
          onFiltersChange={products.setFilters}
          onClearFilters={products.resetFilters}
          onReload={() => {
            void handleRefreshCatalog();
          }}
          onOpenCreate={() => setFormModal({ mode: "create", product: null })}
          onOpenImport={() => setImportOpen(true)}
          onExportXlsx={() => {
            const idsToExport = products.selectedIds.length > 0
              ? products.selectedIds
              : products.filteredProducts.map((item) => item.entity.id);
            void products.exportProducts({
              format: "xlsx",
              priceListId: "base",
              productIds: idsToExport,
            });
          }}
          onDeleteSelected={() => {
            if (!products.selectedIds.length) return;
            const ok = window.confirm(`¿Eliminar ${products.selectedIds.length} productos seleccionados?`);
            if (!ok) return;
            void products.deleteSelected();
          }}
          onOpenQuickPriceCheck={() => setQuickPriceOpen(true)}
          onSelectAllFiltered={() => products.toggleSelectAllVisible(true)}
          onClearSelection={() => products.setSelectedIds([])}
      />

      {products.feedback ? (
        <div className={products.feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
          {products.feedback.message}
        </div>
      ) : null}

      {products.isLoading ? (
        <div className="ui-loading">Cargando productos...</div>
      ) : (
        <ProductTable
          products={paginatedProducts.pageItems}
          selectedIds={products.selectedIds}
          canWrite={canWriteProductos}
          canDelete={canWriteProductos}
          onToggleSelect={products.toggleSelected}
          onToggleSelectAll={(selected) => {
            pageProductIds.forEach((productId) => products.toggleSelected(productId, selected));
          }}
          onToggleFavorite={(product) => {
            void products.toggleFavorite(product);
          }}
          onOpenBarcode={(product) => setBarcodeProduct(product)}
          onEdit={(product) => setFormModal({ mode: "edit", product })}
          onDelete={(product) => {
            if (!canWriteProductos) return;
            const ok = window.confirm(`¿Eliminar el producto ${product.nombre}?`);
            if (!ok) return;
            void products.deleteOne(product);
          }}
        />
      )}

      {!products.isLoading ? (
        <PaginationControls
          currentPage={paginatedProducts.currentPage}
          pageCount={paginatedProducts.pageCount}
          startItem={paginatedProducts.startItem}
          endItem={paginatedProducts.endItem}
          totalItems={paginatedProducts.totalItems}
          onPageChange={paginatedProducts.setCurrentPage}
        />
      ) : null}

      <ProductAuditLog
        loading={products.isLoadingAudit}
        entries={sortedAudit}
        onExportXlsx={() => {
          void products.exportAuditXlsx();
        }}
        exportDisabled={products.isLoadingAudit || products.isSubmitting}
      />

      <ProductFormModal
        key={`${formModal?.mode ?? "create"}-${formModal?.product?.entity.id ?? "new"}-${formModal?.initialBarcode ?? ""}`}
        open={Boolean(formModal)}
        mode={formModal?.mode ?? "create"}
        product={formModal?.product ?? null}
        initialBarcode={formModal?.initialBarcode}
        initialName={formModal?.initialName}
        categoryOptions={products.categoryOptions}
        subcategoryOptions={products.subcategoryOptions}
        disabled={products.isSubmitting || !canWriteProductos}
        onClose={handleCloseFormModal}
        onSubmit={handleSaveProduct}
      />

      <BarcodeGeneratorModal
        open={Boolean(barcodeProduct)}
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      <ProductQuickPriceModal
        open={quickPriceOpen}
        onClose={() => {
          setQuickPriceOpen(false);
          setQuickPriceInitialQuery(null);
        }}
        initialQuery={quickPriceInitialQuery}
        products={products.productsView}
        barcodesByProductId={products.barcodesByProductId}
        canWrite={canWriteProductos}
        onSavePrice={products.updateProductPricing}
        onCreateNewProduct={handleOpenCreateFromQuickPrice}
        onEditProduct={(product) => {
          setQuickPriceOpen(false);
          setQuickPriceInitialQuery(null);
          setFormModal({ mode: "edit", product });
        }}
      />

      {importOpen ? (
        <ProductImportModal
          canWrite={canWriteProductos}
          loading={products.isSubmitting}
          onClose={() => setImportOpen(false)}
          onDownloadTemplate={products.downloadImportTemplate}
          onDownloadErrors={products.downloadImportErrors}
          onParseFile={products.parseImportFile}
          onConfirmImport={products.applyImportPreview}
        />
      ) : null}
    </section>
  );
};
