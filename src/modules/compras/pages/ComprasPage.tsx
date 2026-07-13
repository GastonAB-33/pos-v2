import { useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PurchaseCart } from "@/modules/compras/components/PurchaseCart";
import { PurchaseCheckoutPanel } from "@/modules/compras/components/PurchaseCheckoutPanel";
import { PurchaseProductList } from "@/modules/compras/components/PurchaseProductList";
import { PurchasesHistoryTable } from "@/modules/compras/components/PurchasesHistoryTable";
import { usePurchasesModule } from "@/modules/compras/hooks/usePurchasesModule";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";
import type { Product } from "@/types/entities";

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
        <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
          Cerrar
        </button>
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
                Codigo: {product.code} | Stock: {product.stock_current.toLocaleString("es-AR")}{" "}
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
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewState | null>(null);

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
    setItemQuantity,
    setItemUnitCost,
    removeItem,
    clearCart,
    confirmPurchase,
    findPotentialDuplicateProducts,
    createProductAndAddToCart,
  } = usePurchasesModule(tenantId, user?.id ?? null);

  const historyRows = purchases.map((purchase) => ({
    purchase,
    supplier: suppliersById.get(purchase.supplier_id) ?? null,
  }));

  const handleConfirmPurchase = async (values: PurchaseCheckoutValues): Promise<boolean> => {
    if (!canWritePurchases) return false;
    const purchase = await confirmPurchase(values);
    return Boolean(purchase);
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
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadPurchases) {
    return (
      <PagePlaceholder
        title="Compras a proveedores"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Compras a proveedores" description="Registro de compras con impacto en stock y caja">
      <div className="space-y-4">
        <section className="workspace-toolbar workspace-toolbar--inline">
          <div className="workspace-meta">
            <span>{purchases.length} compras registradas</span>
            <span>{cart.length} items en la compra actual</span>
          </div>
          <div className="workspace-toolbar__actions">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="ui-btn-primary"
              disabled={isSubmitting || !canWritePurchases}
            >
              Agregar producto nuevo
            </button>
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              className="ui-btn-ghost"
              disabled={isLoading || isSubmitting}
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="ui-btn-ghost"
              disabled={isSubmitting || !canWritePurchases}
            >
              Limpiar carrito
            </button>
          </div>
        </section>

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-600">
            Cargando compras...
          </div>
        ) : (
          <div className="workspace-layout">
            <PurchaseProductList
              products={products}
              search={search}
              onSearchChange={setSearch}
              disabled={isSubmitting}
              canWrite={canWritePurchases}
              onAddProduct={(product) => {
                if (!canWritePurchases) return;
                addProductToCart(product);
              }}
            />

            <div className="workspace-aside">
              <PurchaseCart
                items={cart}
                total={summary.total}
                disabled={isSubmitting}
                canWrite={canWritePurchases}
                onSetQuantity={setItemQuantity}
                onSetUnitCost={setItemUnitCost}
                onRemove={removeItem}
              />

              <PurchaseCheckoutPanel
                suppliers={suppliers}
                canWrite={canWritePurchases}
                disabled={isSubmitting}
                onSubmit={handleConfirmPurchase}
              />
            </div>
          </div>
        )}

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
            <PurchasesHistoryTable rows={historyRows} />
          )}
        </section>
      </div>

      <ProductFormModal
        open={isProductModalOpen}
        mode="create"
        disabled={isSubmitting}
        categoryOptions={categoryOptions}
        subcategoryOptions={subcategoryOptions}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleNewProductSubmit}
      />

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
    </PagePlaceholder>
  );
};
