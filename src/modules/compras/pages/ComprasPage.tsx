import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PurchaseCart } from "@/modules/compras/components/PurchaseCart";
import { PurchaseCheckoutPanel } from "@/modules/compras/components/PurchaseCheckoutPanel";
import { PurchaseProductList } from "@/modules/compras/components/PurchaseProductList";
import { PurchasesHistoryTable } from "@/modules/compras/components/PurchasesHistoryTable";
import { usePurchasesModule } from "@/modules/compras/hooks/usePurchasesModule";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";

export const ComprasPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPurchases = canRead("compras");
  const canWritePurchases = canWrite("compras");

  const {
    products,
    suppliers,
    purchases,
    suppliersById,
    cart,
    summary,
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
  } = usePurchasesModule(tenantId, user?.id ?? null);

  const historyRows = purchases.map((purchase) => ({
    purchase,
    supplier: suppliersById.get(purchase.supplier_id) ?? null,
  }));

  const handleConfirmPurchase = async (values: PurchaseCheckoutValues) => {
    if (!canWritePurchases) return;
    await confirmPurchase(values);
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Compras"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadPurchases) {
    return (
      <PagePlaceholder
        title="Compras"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Compras" description="Registro de compras con impacto en stock">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Compras registradas: {purchases.length} | Items en carrito: {cart.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={isLoading || isSubmitting}
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={isSubmitting || !canWritePurchases}
            >
              Limpiar carrito
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            className={[
              "rounded-lg border px-3 py-2 text-sm",
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-600">
            Cargando compras...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
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

            <div className="space-y-4">
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

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-slate-900">Historial simple de compras</h2>
          {isLoading ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
              Cargando historial...
            </div>
          ) : (
            <PurchasesHistoryTable rows={historyRows} />
          )}
        </section>
      </div>
    </PagePlaceholder>
  );
};