import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { BarcodeGeneratorModal } from "@/modules/productos/components/BarcodeGeneratorModal";
import { ProductAuditLog } from "@/modules/productos/components/ProductAuditLog";
import { ProductFilters } from "@/modules/productos/components/ProductFilters";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import { ProductImportModal } from "@/modules/productos/components/ProductImportModal";
import { ProductTable } from "@/modules/productos/components/ProductTable";
import { useProducts } from "@/modules/productos/hooks/useProducts";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";

type ProductModalState = {
  mode: "create" | "edit";
  product: ProductViewModel | null;
};

export const ProductsPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadProductos = canRead("productos");
  const canWriteProductos = canWrite("productos");

  const products = useProducts(tenantId, user?.id ?? null);

  const [formModal, setFormModal] = useState<ProductModalState | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductViewModel | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const selectedCount = products.selectedIds.length;

  const sortedAudit = useMemo(
    () => [...products.auditLog].sort((a, b) => b.date.localeCompare(a.date)),
    [products.auditLog]
  );

  if (!tenantId) {
    return <PagePlaceholder title="Productos" description="No hay tenant activo para operar el módulo." />;
  }

  if (!canReadProductos) {
    return <PagePlaceholder title="Productos" description="No tenés permisos para ver este módulo." />;
  }

  const handleSaveProduct = async (values: ProductFormModalValues) => {
    await products.saveProduct(formModal?.mode ?? "create", values, formModal?.product?.entity ?? null);
    setFormModal(null);
  };

  return (
    <section className="ui-panel space-y-4">
      <ProductFilters
          canWrite={canWriteProductos}
          loading={products.isLoading || products.isSubmitting}
          selectedCount={selectedCount}
          filters={products.filters}
          categories={products.categoryOptions}
          subcategories={products.subcategoryOptions}
          suppliers={products.supplierOptions}
          onFiltersChange={products.setFilters}
          onClearFilters={products.resetFilters}
          onReload={() => {
            void products.reload();
            void products.reloadAudit();
          }}
          onOpenCreate={() => setFormModal({ mode: "create", product: null })}
          onOpenImport={() => setImportOpen(true)}
          onExportXlsx={() => {
            void products.exportProducts({
              format: "xlsx",
              priceListId: "base",
              productIds: products.filteredProducts.map((item) => item.entity.id),
            });
          }}
          onDeleteSelected={() => {
            if (!products.selectedIds.length) return;
            const ok = window.confirm(`¿Eliminar ${products.selectedIds.length} productos seleccionados?`);
            if (!ok) return;
            void products.deleteSelected();
          }}
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
          products={products.filteredProducts}
          selectedIds={products.selectedIds}
          canWrite={canWriteProductos}
          canDelete={canWriteProductos}
          onToggleSelect={products.toggleSelected}
          onToggleSelectAll={products.toggleSelectAllVisible}
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

      <ProductAuditLog loading={products.isLoadingAudit} entries={sortedAudit} />

      <ProductFormModal
        open={Boolean(formModal)}
        mode={formModal?.mode ?? "create"}
        product={formModal?.product ?? null}
        disabled={products.isSubmitting || !canWriteProductos}
        onClose={() => setFormModal(null)}
        onSubmit={handleSaveProduct}
      />

      <BarcodeGeneratorModal
        open={Boolean(barcodeProduct)}
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      {importOpen ? (
        <ProductImportModal
          canWrite={canWriteProductos}
          loading={products.isSubmitting}
          onClose={() => setImportOpen(false)}
          onParseFile={products.parseImportFile}
          onConfirmImport={products.applyImportPreview}
        />
      ) : null}
    </section>
  );
};
