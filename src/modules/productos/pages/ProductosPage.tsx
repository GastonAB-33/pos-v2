import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { ProductCreateModeModal } from "@/modules/productos/components/ProductCreateModeModal";
import { ProductForm } from "@/modules/productos/components/ProductForm";
import { ProductImportModal } from "@/modules/productos/components/ProductImportModal";
import { ProductPhotoAssistPanel } from "@/modules/productos/components/ProductPhotoAssistPanel";
import { ProductVoiceAssistPanel } from "@/modules/productos/components/ProductVoiceAssistPanel";
import { ProductsTable } from "@/modules/productos/components/ProductsTable";
import { ProductsToolbar, type ProductFilters } from "@/modules/productos/components/ProductsToolbar";
import { useProductsCrud } from "@/modules/productos/hooks/useProductsCrud";
import type { Product } from "@/types/entities";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

type FormMode = "create" | "edit";

const defaultFilters: ProductFilters = {
  search: "",
  category: "",
  subcategory: "",
  supplier: "",
  status: "all",
};

export const ProductosPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadProductos = canRead("productos");
  const canWriteProductos = canWrite("productos");

  const {
    products,
    primaryBarcodes,
    priceLists,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createProduct,
    updateProduct,
    deleteProduct,
    deleteProductsBulk,
    toggleProductActive,
    toggleProductFavorite,
    downloadImportTemplate,
    parseImportFile,
    applyImportPreview,
    exportProducts,
  } = useProductsCrud(tenantId, user?.id ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [createModeOpen, setCreateModeOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [photoAssistOpen, setPhotoAssistOpen] = useState(false);
  const [voiceAssistOpen, setVoiceAssistOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [aiPrefillValues, setAiPrefillValues] = useState<Partial<ProductFormValues> | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [exportPriceListId, setExportPriceListId] = useState<string>("base");

  const categoryOptions = useMemo(
    () =>
      [...new Set(products.map((product) => product.category.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );

  const subcategoryOptions = useMemo(
    () =>
      [...new Set(products.map((product) => (product.subcategory ?? "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );

  const supplierOptions = useMemo(
    () =>
      [...new Set(products.map((product) => (product.supplier ?? "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );

  const exportPriceListOptions = useMemo(
    () => [
      { id: "base", label: "Precio base" },
      ...priceLists.map((priceList) => ({
        id: priceList.id,
        label: `Lista: ${priceList.name}${priceList.is_active ? "" : " (inactiva)"}`,
      })),
    ],
    [priceLists]
  );

  const filteredProducts = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return products.filter((product) => {
      if (filters.category && product.category !== filters.category) return false;
      if (filters.subcategory && (product.subcategory ?? "") !== filters.subcategory) return false;
      if (filters.supplier && (product.supplier ?? "") !== filters.supplier) return false;
      if (filters.status === "active" && !product.is_active) return false;
      if (filters.status === "inactive" && product.is_active) return false;

      if (!search) return true;

      const barcode = (primaryBarcodes[product.id] ?? "").toLowerCase();
      const searchable = [
        product.name,
        product.code,
        product.brand ?? "",
        product.supplier ?? "",
        product.category,
        product.subcategory ?? "",
        barcode,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });
  }, [filters, primaryBarcodes, products]);

  const visibleSelectedIds = useMemo(
    () => selectedProductIds.filter((productId) => filteredProducts.some((product) => product.id === productId)),
    [filteredProducts, selectedProductIds]
  );

  const handleCreateClick = () => {
    if (!canWriteProductos) return;
    clearFeedback();
    setCreateModeOpen(true);
  };

  const openManualCreate = () => {
    setCreateModeOpen(false);
    setFormMode("create");
    setAiPrefillValues(null);
    setSelectedProduct(undefined);
    setPhotoAssistOpen(false);
    setVoiceAssistOpen(false);
    setFormOpen(true);
  };

  const openCreateByPhoto = () => {
    setCreateModeOpen(false);
    setFormOpen(false);
    setSelectedProduct(undefined);
    setPhotoAssistOpen(true);
    setVoiceAssistOpen(false);
  };

  const openCreateByVoice = () => {
    setCreateModeOpen(false);
    setFormOpen(false);
    setSelectedProduct(undefined);
    setVoiceAssistOpen(true);
    setPhotoAssistOpen(false);
  };

  const handleEditClick = (product: Product) => {
    if (!canWriteProductos) return;
    clearFeedback();
    setFormMode("edit");
    setAiPrefillValues(null);
    setSelectedProduct(product);
    setPhotoAssistOpen(false);
    setVoiceAssistOpen(false);
    setCreateModeOpen(false);
    setFormOpen(true);
  };

  const handleDeleteClick = async (product: Product) => {
    if (!canWriteProductos) return;

    const confirmed = window.confirm(`Eliminar producto ${product.name}?`);
    if (!confirmed) return;

    await deleteProduct(product.id);
    setSelectedProductIds((current) => current.filter((id) => id !== product.id));
  };

  const handleToggleClick = async (product: Product) => {
    if (!canWriteProductos) return;
    await toggleProductActive(product.id);
  };

  const handleSubmitForm = async (values: ProductFormValues) => {
    if (formMode === "create") {
      await createProduct(values);
    } else if (selectedProduct) {
      await updateProduct(selectedProduct.id, values);
    }

    setFormOpen(false);
    setAiPrefillValues(null);
    setSelectedProduct(undefined);
  };

  if (!tenantId) {
    return <PagePlaceholder title="Productos" description="No hay tenant activo para operar el modulo" />;
  }

  if (!canReadProductos) {
    return <PagePlaceholder title="Productos" description="No tenes permisos de lectura para este modulo" />;
  }

  return (
    <PagePlaceholder title="Productos" description="CRUD funcional de productos por tenant">
      <div className="space-y-4">
        <ProductsToolbar
          canWrite={canWriteProductos}
          loading={isLoading || isSubmitting}
          hasRows={filteredProducts.length > 0}
          selectedCount={visibleSelectedIds.length}
          filters={filters}
          categories={categoryOptions}
          subcategories={subcategoryOptions}
          suppliers={supplierOptions}
          exportPriceListId={exportPriceListId}
          exportPriceListOptions={exportPriceListOptions}
          onFiltersChange={(patch) => {
            setFilters((current) => ({ ...current, ...patch }));
            setSelectedProductIds([]);
          }}
          onReload={() => {
            setSelectedProductIds([]);
            void reload();
          }}
          onOpenCreateFlow={handleCreateClick}
          onOpenImport={() => setImportModalOpen(true)}
          onDownloadTemplate={() => {
            void downloadImportTemplate().then((ok) => {
              if (!ok) {
                window.alert("No se pudo descargar la plantilla XLSX");
              }
            });
          }}
          onExportPriceListChange={setExportPriceListId}
          onExportXlsx={() => {
            void exportProducts({
              format: "xlsx",
              priceListId: exportPriceListId === "base" ? "base" : exportPriceListId,
              productIds: filteredProducts.map((product) => product.id),
            });
          }}
          onExportCsv={() => {
            void exportProducts({
              format: "csv",
              priceListId: exportPriceListId === "base" ? "base" : exportPriceListId,
              productIds: filteredProducts.map((product) => product.id),
            });
          }}
          onDeleteSelected={() => {
            if (!visibleSelectedIds.length) return;

            const confirmed = window.confirm(`Eliminar ${visibleSelectedIds.length} productos seleccionados?`);
            if (!confirmed) return;

            void deleteProductsBulk(visibleSelectedIds).then(() => {
              setSelectedProductIds([]);
            });
          }}
        />

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div>
        ) : null}

        {isLoading ? (
          <div className="ui-loading">Cargando productos...</div>
        ) : (
          <ProductsTable
            products={filteredProducts}
            primaryBarcodes={primaryBarcodes}
            selectedIds={visibleSelectedIds}
            canWrite={canWriteProductos}
            onToggleSelect={(productId, selected) => {
              setSelectedProductIds((current) => {
                if (selected) {
                  if (current.includes(productId)) return current;
                  return [...current, productId];
                }

                return current.filter((id) => id !== productId);
              });
            }}
            onToggleSelectAll={(selected) => {
              if (!selected) {
                setSelectedProductIds([]);
                return;
              }
              setSelectedProductIds(filteredProducts.map((product) => product.id));
            }}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
            onToggleFavorite={(product) => {
              if (!canWriteProductos) return;
              void toggleProductFavorite(product.id);
            }}
          />
        )}

        {formOpen ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              {formMode === "create" ? "Crear producto" : "Editar producto"}
            </h3>
            <ProductForm
              mode={formMode}
              product={selectedProduct}
              primaryBarcode={selectedProduct ? primaryBarcodes[selectedProduct.id] : ""}
              prefillValues={formMode === "create" ? aiPrefillValues : null}
              disabled={isSubmitting}
              onCancel={() => {
                setFormOpen(false);
                setAiPrefillValues(null);
                setSelectedProduct(undefined);
              }}
              onSubmit={handleSubmitForm}
            />
          </section>
        ) : null}

        {photoAssistOpen ? (
          <ProductPhotoAssistPanel
            canWrite={canWriteProductos}
            disabled={isSubmitting}
            onClose={() => setPhotoAssistOpen(false)}
            onApplySuggestions={(values) => {
              setAiPrefillValues(values);
              setSelectedProduct(undefined);
              setFormMode("create");
              setFormOpen(true);
              setPhotoAssistOpen(false);
              setVoiceAssistOpen(false);
            }}
          />
        ) : null}

        {voiceAssistOpen ? (
          <ProductVoiceAssistPanel
            canWrite={canWriteProductos}
            disabled={isSubmitting}
            onClose={() => setVoiceAssistOpen(false)}
            onApplySuggestions={(values) => {
              setAiPrefillValues(values);
              setSelectedProduct(undefined);
              setFormMode("create");
              setFormOpen(true);
              setPhotoAssistOpen(false);
              setVoiceAssistOpen(false);
            }}
          />
        ) : null}

        {createModeOpen ? (
          <ProductCreateModeModal
            canWrite={canWriteProductos}
            loading={isSubmitting}
            onClose={() => setCreateModeOpen(false)}
            onSelectManual={openManualCreate}
            onSelectPhoto={openCreateByPhoto}
            onSelectVoice={openCreateByVoice}
          />
        ) : null}

        {importModalOpen ? (
          <ProductImportModal
            canWrite={canWriteProductos}
            loading={isSubmitting}
            onClose={() => setImportModalOpen(false)}
            onParseFile={parseImportFile}
            onConfirmImport={applyImportPreview}
          />
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
