import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PromotionForm } from "@/modules/promociones/components/PromotionForm";
import { PromotionBarcodeModal } from "@/modules/promociones/components/PromotionBarcodeModal";
import { PromotionsTable } from "@/modules/promociones/components/PromotionsTable";
import { PromotionsToolbar } from "@/modules/promociones/components/PromotionsToolbar";
import { usePromotionsCrud } from "@/modules/promociones/hooks/usePromotionsCrud";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import { productsService } from "@/services/products.service";
import type { Product } from "@/types/entities";
import type { PromotionWithDetails } from "@/services/promotions.service";
import type { PromotionFormValues } from "@/modules/promociones/schemas/promotion-form.schema";

export const PromocionesPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPromociones = canRead("promociones");
  const canWritePromociones = canWrite("promociones");

  const {
    promotions,
    products,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionActive,
  } = usePromotionsCrud(tenantId, user?.id ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionWithDetails | undefined>(undefined);
  const [barcodePromotion, setBarcodePromotion] = useState<PromotionWithDetails | null>(null);

  // States for on-the-fly product creation from the promotion form
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newlyCreatedProduct, setNewlyCreatedProduct] = useState<Product | null>(null);

  const productNameById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products]
  );

  const subcategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.subcategory).filter(Boolean) as string[])
      ),
    [products]
  );

  const handleCreateClick = () => {
    if (!canWritePromociones) return;
    clearFeedback();
    setFormMode("create");
    setSelectedPromotion(undefined);
    setNewlyCreatedProduct(null);
    setFormOpen(true);
  };

  const handleEditClick = (promotion: PromotionWithDetails) => {
    if (!canWritePromociones) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedPromotion(promotion);
    setNewlyCreatedProduct(null);
    setFormOpen(true);
  };

  const handleDeleteClick = async (promotion: PromotionWithDetails) => {
    if (!canWritePromociones) return;

    const confirmed = window.confirm(`¿Eliminar promoción ${promotion.name}?`);
    if (!confirmed) return;

    await deletePromotion(promotion.id);
  };

  const handleToggleClick = async (promotion: PromotionWithDetails) => {
    if (!canWritePromociones) return;
    await togglePromotionActive(promotion.id);
  };

  const handleSubmitForm = async (values: PromotionFormValues) => {
    if (formMode === "create") {
      await createPromotion(values);
    } else if (selectedPromotion) {
      await updatePromotion(selectedPromotion.id, values);
    }

    setFormOpen(false);
    setSelectedPromotion(undefined);
  };

  const handleProductModalSubmit = async (values: ProductFormModalValues): Promise<void> => {
    if (!tenantId) return;

    const created = await productsService.create(tenantId, {
      name: values.nombre.trim(),
      code: values.codigoProducto?.trim() || null,
      category: values.categoria?.trim() || "General",
      subcategory: values.subcategoria?.trim() || null,
      sale_mode: values.saleMode,
      price: Number(values.precioFinal.toFixed(2)),
      cost_price: Number(values.precioCosto.toFixed(2)),
      stock_current: Number(values.stock.toFixed(3)),
      stock_min: null,
      stock_max: null,
      currency_code: "ARS",
      price_without_vat: Number(values.precioSinIva.toFixed(2)),
      vat_percent: Number(values.porcentajeIva.toFixed(2)),
      profit_percent: Number(values.porcentajeGanancia.toFixed(2)),
      is_active: values.estadoActivo,
      is_favorite: values.favorito ?? false,
      brand: null,
      supplier: null,
      description: null,
      image_url: values.imagenUrl?.trim() || null,
    });

    if (values.codigoBarras?.trim()) {
      await productsService.setPrimaryBarcode(tenantId, created.id, values.codigoBarras.trim());
    }

    setNewlyCreatedProduct(created);
    setIsProductModalOpen(false);
    await reload();
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Promociones"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadPromociones) {
    return (
      <PagePlaceholder
        title="Promociones"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Promociones" description="Reglas y combos automáticos aplicables en POS">
      <div className="space-y-4">
        <PromotionsToolbar
          canWrite={canWritePromociones}
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
          onCreate={handleCreateClick}
          onReload={() => void reload()}
        />

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="ui-loading">Cargando promociones...</div>
        ) : (
          <PromotionsTable
            promotions={promotions}
            productNameById={productNameById}
            canWrite={canWritePromociones}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
            onBarcode={setBarcodePromotion}
          />
        )}

        {/* Modal Principal de Creación / Edición de Promociones */}
        {formOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 shrink-0 bg-slate-50/70 dark:bg-slate-900">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {formMode === "create" ? "Nueva Promoción" : "Editar Promoción"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configurá descuentos individuales, packs por volumen o combos de múltiples productos
                  </p>
                </div>
                <ModalCloseButton
                  onClick={() => {
                    setFormOpen(false);
                    setSelectedPromotion(undefined);
                  }}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <PromotionForm
                  mode={formMode}
                  promotion={selectedPromotion}
                  products={products}
                  disabled={isSubmitting}
                  onCancel={() => {
                    setFormOpen(false);
                    setSelectedPromotion(undefined);
                  }}
                  onSubmit={handleSubmitForm}
                  onRequestCreateProduct={() => setIsProductModalOpen(true)}
                  newlyCreatedProduct={newlyCreatedProduct}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal para Crear Producto sobre la marcha */}
        <ProductFormModal
          open={isProductModalOpen}
          mode="create"
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
          onClose={() => setIsProductModalOpen(false)}
          onSubmit={handleProductModalSubmit}
        />

        {/* Modal de Código de Barras */}
        <PromotionBarcodeModal
          promotion={barcodePromotion}
          onClose={() => setBarcodePromotion(null)}
        />
      </div>
    </PagePlaceholder>
  );
};
