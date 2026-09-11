import { useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import { ArrowLeft, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PurchaseCart } from "@/modules/compras/components/PurchaseCart";
import { PurchaseCheckoutPanel } from "@/modules/compras/components/PurchaseCheckoutPanel";
import { PurchaseProductSelectModal } from "@/modules/compras/components/PurchaseProductSelectModal";
import { PurchasesHistoryTable } from "@/modules/compras/components/PurchasesHistoryTable";
import { PurchaseReturnModal } from "@/modules/compras/components/PurchaseReturnModal";
import { usePurchasesModule } from "@/modules/compras/hooks/usePurchasesModule";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import { SupplierForm } from "@/modules/proveedores/components/SupplierForm";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import type { Product, Purchase, Supplier } from "@/types/entities";

interface DuplicateReviewState {
  values: ProductFormModalValues;
  matches: Product[];
}

const DuplicateProductReviewModal = ({
  review,
  disabled,
  onUseExisting,
  onCreateAnyway,
  onClose,
}: {
  review: DuplicateReviewState;
  disabled?: boolean;
  onUseExisting: (product: Product) => void;
  onCreateAnyway: () => void;
  onClose: () => void;
}) => (
  <section className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
    <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Productos parecidos encontrados</h3>
          <p className="mt-1 text-sm text-slate-500">
            Antes de crear "{review.values.nombre}", revisa si ya existe para evitar duplicados.
          </p>
        </div>
        <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={disabled} />
      </div>

      <div className="mt-4 space-y-2">
        {review.matches.map((product) => (
          <article
            key={product.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">
                Código: {product.code} | Stock: {product.stock_current.toLocaleString("es-AR")}{" "}
                {product.sale_mode === "weight" ? "kg" : "u."}
              </p>
            </div>
            <button
              type="button"
              className="ui-btn-primary px-3 py-2 text-xs"
              onClick={() => onUseExisting(product)}
              disabled={disabled}
            >
              Usar existente
            </button>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-500">
          Si ninguno coincide realmente, puedes crear el nuevo producto igual.
        </p>
        <button type="button" className="ui-btn-ghost" onClick={onCreateAnyway} disabled={disabled}>
          Crear de todos modos
        </button>
      </div>
    </div>
  </section>
);

export const ComprasPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPurchases = canRead("compras");
  const canWritePurchases = canWrite("compras");

  const [viewMode, setViewMode] = useState<"history" | "create">("history");
  const [isSelectProductModalOpen, setIsSelectProductModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [preferredSupplierId, setPreferredSupplierId] = useState<string>();
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewState | null>(null);
  const [returnModalTarget, setReturnModalTarget] = useState<{
    purchase: Purchase;
    supplier: Supplier | null;
  } | null>(null);

  const {
    products,
    suppliers,
    purchases,
    suppliersById,
    cart,
    summary,
    categoryOptions,
    subcategoryOptions,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    addProductToCart,
    addProductByBarcode,
    setItemQuantity,
    setItemUnitCost,
    setItemVatPercent,
    setItemBonifiedQuantity,
    setItemUpdateSalePrice,
    removeItem,
    clearCart,
    confirmPurchase,
    createPurchaseReturn,
    findPotentialDuplicateProducts,
    createProductAndAddToCart,
    createSupplier,
  } = usePurchasesModule(tenantId, user?.id ?? null);

  const historyRows = purchases.map((purchase) => ({
    purchase,
    supplier: suppliersById.get(purchase.supplier_id) ?? null,
  }));

  const handleConfirmPurchase = async (values: PurchaseCheckoutValues): Promise<boolean> => {
    if (!canWritePurchases) return false;
    const purchase = await confirmPurchase(values);
    if (purchase) {
      setViewMode("history");
      setPreferredSupplierId(undefined);
    }
    return Boolean(purchase);
  };

  const handleCreateSupplier = async (values: SupplierFormValues) => {
    if (!canWritePurchases) return;
    const created = await createSupplier(values);
    if (created) {
      setPreferredSupplierId(created.id);
      setIsSupplierModalOpen(false);
    }
  };

  const handleNewProductSubmit = async (values: ProductFormModalValues) => {
    if (!canWritePurchases) return;

    const matches = findPotentialDuplicateProducts(values);
    if (matches.length) {
      setIsProductModalOpen(false);
      setDuplicateReview({ values, matches });
      return;
    }

    const created = await createProductAndAddToCart(values);
    if (created) {
      setIsProductModalOpen(false);
    }
  };

  const handleCreateDuplicateAnyway = async () => {
    if (!duplicateReview) return;
    const created = await createProductAndAddToCart(duplicateReview.values);
    if (created) {
      setDuplicateReview(null);
    }
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Compras a proveedores"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadPurchases) {
    return (
      <PagePlaceholder
        title="Compras a proveedores"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Compras a proveedores"
      description="Registro de compras con impacto en stock y caja diaria"
    >
      <div className="purchases-operational-page space-y-4">
        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {viewMode === "history" ? (
          /* ========================================================================= */
          /* VISTA: HISTORIAL DE COMPRAS                                              */
          /* ========================================================================= */
          <div className="space-y-4">
            <section className="workspace-toolbar workspace-toolbar--inline">
              <div className="workspace-meta">
                <span className="font-semibold text-slate-800">{purchases.length} compras registradas</span>
                <span>El historial se ordena desde la compra más reciente</span>
              </div>
              <div className="workspace-toolbar__actions">
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setViewMode("create");
                  }}
                  className="ui-btn-primary"
                  disabled={isSubmitting || !canWritePurchases}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Nueva compra
                </button>
                <IconButton
                  icon={RefreshCw}
                  label="Recargar compras"
                  onClick={() => {
                    clearFeedback();
                    void reload();
                  }}
                  loading={isLoading}
                  disabled={isSubmitting}
                />
              </div>
            </section>

            <section className="workspace-history space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Historial de compras</h2>
                <span className="ui-badge ui-badge--info">{purchases.length}</span>
              </div>
              {isLoading ? (
                <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
                  Cargando historial...
                </div>
              ) : (
                <PurchasesHistoryTable
                  rows={historyRows}
                  canWrite={canWritePurchases}
                  disabled={isSubmitting}
                  onOpenReturnModal={(purchase, supplier) =>
                    setReturnModalTarget({ purchase, supplier })
                  }
                />
              )}
            </section>
          </div>
        ) : (
          /* ========================================================================= */
          /* VISTA: REGISTRAR NUEVA COMPRA (PANEL COMPLETO EN PANTALLA)                */
          /* ========================================================================= */
          <div className="space-y-3">
            {/* 1. Panel de Registrar Nueva Compra (Barra superior compacta minimalista) */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode("history")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al historial
                </button>
                <div>
                  <h1 className="text-base font-bold text-slate-900">Registrar nueva compra</h1>
                  <p className="text-[11px] text-slate-500">
                    Carga los datos del comprobante y los productos comprados
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={isSubmitting || !canWritePurchases}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    title="Vaciar lista de productos"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Vaciar lista
                  </button>
                </div>
              )}
            </section>

            {/* 2. Panel de Datos de Compra y Factura */}
            <PurchaseCheckoutPanel
              suppliers={suppliers}
              canWrite={canWritePurchases}
              disabled={isSubmitting}
              preferredSupplierId={preferredSupplierId}
              formId="purchase-checkout-form"
              onCreateSupplier={() => setIsSupplierModalOpen(true)}
              onSubmit={handleConfirmPurchase}
            />

            {/* 3. Panel de Productos de Compra y Resumen / Confirmación */}
            <PurchaseCart
              items={cart}
              summary={summary}
              disabled={isSubmitting}
              canWrite={canWritePurchases}
              formId="purchase-checkout-form"
              onSetQuantity={setItemQuantity}
              onSetUnitCost={setItemUnitCost}
              onSetVatPercent={setItemVatPercent}
              onSetBonifiedQuantity={setItemBonifiedQuantity}
              onSetUpdateSalePrice={setItemUpdateSalePrice}
              onRemove={removeItem}
              onOpenAddProductModal={() => setIsSelectProductModalOpen(true)}
              onOpenCreateProductModal={() => setIsProductModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Modal 1: Buscar / Escanear y Agregar Producto del Catálogo */}
      <PurchaseProductSelectModal
        open={isSelectProductModalOpen}
        products={products}
        cart={cart}
        search={search}
        onSearchChange={setSearch}
        disabled={isSubmitting}
        canWrite={canWritePurchases}
        onAddProduct={(product) => {
          if (!canWritePurchases) return;
          addProductToCart(product);
        }}
        onBarcodeScan={addProductByBarcode}
        onClose={() => setIsSelectProductModalOpen(false)}
      />

      {/* Modal 2: Crear Nuevo Producto desde Cero */}
      <ProductFormModal
        open={isProductModalOpen}
        mode="create"
        disabled={isSubmitting}
        categoryOptions={categoryOptions}
        subcategoryOptions={subcategoryOptions}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleNewProductSubmit}
      />

      {/* Modal 3: Crear Nuevo Proveedor */}
      {isSupplierModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Nuevo proveedor</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Se guardará en Proveedores y quedará seleccionado en esta compra.
                </p>
              </div>
              <IconButton
                icon={X}
                label="Cerrar alta de proveedor"
                onClick={() => setIsSupplierModalOpen(false)}
                disabled={isSubmitting}
              />
            </div>
            <SupplierForm
              mode="create"
              disabled={isSubmitting}
              onCancel={() => setIsSupplierModalOpen(false)}
              onSubmit={handleCreateSupplier}
            />
          </div>
        </section>
      ) : null}

      {/* Modal 4: Revisión de duplicados */}
      {duplicateReview ? (
        <DuplicateProductReviewModal
          review={duplicateReview}
          disabled={isSubmitting}
          onUseExisting={(product) => {
            addProductToCart(product);
            setDuplicateReview(null);
          }}
          onCreateAnyway={handleCreateDuplicateAnyway}
          onClose={() => setDuplicateReview(null)}
        />
      ) : null}

      {/* Modal 5: Devolución / Nota de Crédito */}
      {returnModalTarget ? (
        <PurchaseReturnModal
          open={Boolean(returnModalTarget)}
          purchase={returnModalTarget.purchase}
          supplier={returnModalTarget.supplier}
          disabled={isSubmitting}
          onClose={() => setReturnModalTarget(null)}
          onConfirmReturn={createPurchaseReturn}
        />
      ) : null}
    </PagePlaceholder>
  );
};


