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
import { PurchasePaymentModal } from "@/modules/compras/components/PurchasePaymentModal";
import { usePurchasesModule } from "@/modules/compras/hooks/usePurchasesModule";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import { SupplierForm } from "@/modules/proveedores/components/SupplierForm";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type {
  PurchaseHeaderValues,
  PurchasePaymentValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";
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
  onEditProduct,
  onClose,
}: {
  review: DuplicateReviewState;
  disabled?: boolean;
  onUseExisting: (product: Product) => void;
  onCreateAnyway: () => void;
  onEditProduct: () => void;
  onClose: () => void;
}) => {
  const enteredCode = review.values.codigoProducto?.trim().toUpperCase();

  const exactCodeMatch = enteredCode
    ? review.matches.find((p) => p.code && p.code.trim().toUpperCase() === enteredCode)
    : null;

  const isStrictDuplicate = Boolean(exactCodeMatch);

  return (
    <section className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isStrictDuplicate ? "Código de producto ya registrado" : "Productos parecidos encontrados"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isStrictDuplicate
                ? `Ya existe un producto con el código "${review.values.codigoProducto}". No se permite duplicar códigos de producto en el sistema.`
                : `Antes de crear "${review.values.nombre}", revisa si ya existe para evitar duplicados.`}
            </p>
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={disabled} />
        </div>

        {isStrictDuplicate && exactCodeMatch ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-300">
            El código <span className="font-semibold">{review.values.codigoProducto}</span> ya pertenece a{" "}
            <span className="font-semibold">"{exactCodeMatch.name}"</span>. Para mantener la integridad de tu inventario no podés tener 2 productos con el mismo código. Podés usar este producto existente o modificar el código del nuevo producto.
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {review.matches.map((product) => (
            <article
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{product.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {product.code ? `Código: ${product.code} | ` : ""}Stock: {product.stock_current.toLocaleString("es-AR")}{" "}
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isStrictDuplicate
              ? "Para no duplicar el código, modifica los datos o usa el producto existente."
              : "Si ninguno coincide realmente, puedes crear el nuevo producto igual."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-btn-ghost text-xs border border-slate-300 dark:border-slate-700 dark:text-slate-200"
              onClick={onEditProduct}
              disabled={disabled}
            >
              Modificar datos
            </button>
            {!isStrictDuplicate ? (
              <button
                type="button"
                className="ui-btn-ghost text-xs border border-slate-300 dark:border-slate-700 dark:text-slate-200"
                onClick={onCreateAnyway}
                disabled={disabled}
              >
                Crear de todos modos
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

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
  const [newSupplierInitialName, setNewSupplierInitialName] = useState<string>("");
  const [newProductPrefill, setNewProductPrefill] = useState<{
    initialBarcode?: string | null;
    initialName?: string | null;
    initialValues?: Partial<ProductFormModalValues> | null;
  }>({});
  const [preferredSupplierId, setPreferredSupplierId] = useState<string>();
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewState | null>(null);
  const [returnToProductSelectAfterCreate, setReturnToProductSelectAfterCreate] = useState(false);
  const [returnModalTarget, setReturnModalTarget] = useState<{
    purchase: Purchase;
    supplier: Supplier | null;
  } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingHeaderValues, setPendingHeaderValues] = useState<PurchaseHeaderValues | null>(null);
  const [checkoutResetSignal, setCheckoutResetSignal] = useState(0);

  const {
    allProducts,
    barcodesByProductId,
    suppliers,
    purchases,
    bankAccounts,
    openCashSession,
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
    setItemDiscountPercent,
    setItemProfitPercent,
    setItemSalePrice,
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
    purchaseVatPercent,
    setPurchaseVatPercent,
    purchaseIibbPercent,
    setPurchaseIibbPercent,
    purchaseIibbAmount,
    setPurchaseIibbAmount,
  } = usePurchasesModule(tenantId, user?.id ?? null);

  const historyRows = purchases.map((purchase) => ({
    purchase,
    supplier: suppliersById.get(purchase.supplier_id) ?? null,
  }));

  const handleProceedToPayment = (headerValues: PurchaseHeaderValues) => {
    if (!canWritePurchases) return;
    if (!cart.length) {
      alert("Debés agregar al menos un producto al carrito de compras antes de continuar al pago.");
      return;
    }
    const supplier = suppliersById.get(headerValues.supplierId);
    if (!supplier) {
      alert("Debes seleccionar un proveedor válido de la lista o crearlo antes de continuar al pago.");
      return;
    }
    setPendingHeaderValues(headerValues);
    setIsPaymentModalOpen(true);
  };

  const handleFinalPaymentConfirm = async (paymentValues: PurchasePaymentValues): Promise<void> => {
    if (!canWritePurchases || !pendingHeaderValues) return;
    clearFeedback();
    const purchase = await confirmPurchase(pendingHeaderValues, paymentValues);
    if (purchase) {
      setIsPaymentModalOpen(false);
      setPendingHeaderValues(null);
      setCheckoutResetSignal((prev) => prev + 1);
      setViewMode("history");
      setPreferredSupplierId(undefined);
    }
  };

  const handleCreateSupplier = async (values: SupplierFormValues) => {
    if (!canWritePurchases) return;
    const created = await createSupplier(values);
    if (created) {
      setPreferredSupplierId(created.id);
      setIsSupplierModalOpen(false);
      setNewSupplierInitialName("");
    }
  };

  const handleOpenCreateProduct = (query?: string, returnToSelect: boolean = true) => {
    const trimmed = query?.trim() ?? "";
    const isBarcodeLike = trimmed.length >= 6 && /^\d+$/.test(trimmed);
    setNewProductPrefill({
      initialBarcode: isBarcodeLike ? trimmed : null,
      initialName: !isBarcodeLike && trimmed ? trimmed : null,
    });
    setReturnToProductSelectAfterCreate(returnToSelect);
    setIsSelectProductModalOpen(false);
    setIsProductModalOpen(true);
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
      setNewProductPrefill({});
      if (returnToProductSelectAfterCreate) {
        setSearch("");
        setIsSelectProductModalOpen(true);
      }
    }
  };

  const handleCreateDuplicateAnyway = async () => {
    if (!duplicateReview) return;
    const created = await createProductAndAddToCart(duplicateReview.values);
    if (created) {
      setDuplicateReview(null);
      setNewProductPrefill({});
      if (returnToProductSelectAfterCreate) {
        setSearch("");
        setIsSelectProductModalOpen(true);
      }
    }
  };

  const handleEditDuplicateReview = () => {
    if (!duplicateReview) return;
    setNewProductPrefill({
      initialBarcode: duplicateReview.values.codigoBarras || null,
      initialName: duplicateReview.values.nombre || null,
      initialValues: duplicateReview.values,
    });
    setDuplicateReview(null);
    setIsProductModalOpen(true);
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
                <span className="font-semibold text-slate-800 dark:text-slate-200">{purchases.length} compras registradas</span>
                <span className="text-slate-500 dark:text-slate-400">El historial se ordena desde la compra más reciente</span>
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
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Historial de compras</h2>
                <span className="ui-badge ui-badge--info">{purchases.length}</span>
              </div>
              {isLoading ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
                  Cargando historial...
                </div>
              ) : (
                <PurchasesHistoryTable
                  rows={historyRows}
                  products={allProducts}
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
            {/* 1. Barra superior: Nueva Compra (minimalista) */}
            <section className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewMode("history")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Volver al historial de compras"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver</span>
                </button>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Nueva compra
                </h1>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={isSubmitting || !canWritePurchases}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition active:scale-95 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60"
                  title="Vaciar lista de productos"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Vaciar lista</span>
                </button>
              )}
            </section>

            {/* 2. Panel de Datos de Compra y Factura */}
            <PurchaseCheckoutPanel
              suppliers={suppliers}
              canWrite={canWritePurchases}
              disabled={isSubmitting}
              preferredSupplierId={preferredSupplierId}
              formId="purchase-checkout-form"
              resetSignal={checkoutResetSignal}
              vatPercent={purchaseVatPercent}
              onVatPercentChange={setPurchaseVatPercent}
              iibbPercent={purchaseIibbPercent}
              iibbAmount={purchaseIibbAmount}
              onCreateSupplier={(initialName) => {
                setNewSupplierInitialName(initialName?.trim() || "");
                setIsSupplierModalOpen(true);
              }}
              onSubmit={handleProceedToPayment}
            />

            {/* 3. Panel de Productos de Compra y Resumen / Confirmación (con impuestos al final) */}
            <PurchaseCart
              items={cart}
              summary={summary}
              disabled={isSubmitting}
              canWrite={canWritePurchases}
              formId="purchase-checkout-form"
              vatPercent={purchaseVatPercent}
              onVatPercentChange={setPurchaseVatPercent}
              iibbPercent={purchaseIibbPercent}
              onIibbPercentChange={setPurchaseIibbPercent}
              iibbAmount={purchaseIibbAmount}
              onIibbAmountChange={setPurchaseIibbAmount}
              onSetQuantity={setItemQuantity}
              onSetUnitCost={setItemUnitCost}
              onSetDiscountPercent={setItemDiscountPercent}
              onSetProfitPercent={setItemProfitPercent}
              onSetSalePrice={setItemSalePrice}
              onSetVatPercent={setItemVatPercent}
              onSetBonifiedQuantity={setItemBonifiedQuantity}
              onSetUpdateSalePrice={setItemUpdateSalePrice}
              onRemove={removeItem}
              onOpenAddProductModal={() => {
                setSearch("");
                setIsSelectProductModalOpen(true);
              }}
              onOpenCreateProductModal={() => handleOpenCreateProduct("")}
            />
          </div>
        )}
      </div>

      {/* Modal 1: Buscar / Escanear y Agregar Producto del Catálogo */}
      <PurchaseProductSelectModal
        open={isSelectProductModalOpen}
        products={allProducts}
        barcodesByProductId={barcodesByProductId}
        cart={cart}
        search={search}
        onSearchChange={setSearch}
        disabled={isSubmitting}
        canWrite={canWritePurchases}
        onAddProduct={(product, quantity, unitCost, vatPercent, bonifiedQty, discountPercent) => {
          if (!canWritePurchases) return;
          addProductToCart(product, quantity, unitCost, vatPercent, bonifiedQty, discountPercent);
        }}
        onBarcodeScan={addProductByBarcode}
        onCreateNewProduct={handleOpenCreateProduct}
        onClose={() => {
          setSearch("");
          setIsSelectProductModalOpen(false);
        }}
      />

      {/* Modal 2: Crear Nuevo Producto desde Cero */}
      <ProductFormModal
        open={isProductModalOpen}
        mode="create"
        disabled={isSubmitting}
        categoryOptions={categoryOptions}
        subcategoryOptions={subcategoryOptions}
        initialBarcode={newProductPrefill.initialBarcode}
        initialName={newProductPrefill.initialName}
        initialValues={newProductPrefill.initialValues}
        onClose={() => {
          setIsProductModalOpen(false);
          setNewProductPrefill({});
          if (returnToProductSelectAfterCreate) {
            setIsSelectProductModalOpen(true);
          }
        }}
        onSubmit={handleNewProductSubmit}
      />

      {/* Modal 3: Crear Nuevo Proveedor */}
      {isSupplierModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Nuevo proveedor</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Se guardará en Proveedores y quedará seleccionado en esta compra.
                </p>
              </div>
              <IconButton
                icon={X}
                label="Cerrar alta de proveedor"
                onClick={() => {
                  setIsSupplierModalOpen(false);
                  setNewSupplierInitialName("");
                }}
                disabled={isSubmitting}
              />
            </div>
            <SupplierForm
              mode="create"
              initialName={newSupplierInitialName}
              disabled={isSubmitting}
              onCancel={() => {
                setIsSupplierModalOpen(false);
                setNewSupplierInitialName("");
              }}
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
            if (returnToProductSelectAfterCreate) {
              setSearch("");
              setIsSelectProductModalOpen(true);
            }
          }}
          onCreateAnyway={handleCreateDuplicateAnyway}
          onEditProduct={handleEditDuplicateReview}
          onClose={() => {
            setDuplicateReview(null);
            if (returnToProductSelectAfterCreate) {
              setIsSelectProductModalOpen(true);
            }
          }}
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

      {/* Modal 6: Pago de la compra */}
      <PurchasePaymentModal
        open={isPaymentModalOpen && Boolean(pendingHeaderValues)}
        total={summary.total}
        supplier={
          pendingHeaderValues ? suppliersById.get(pendingHeaderValues.supplierId) ?? null : null
        }
        documentType={pendingHeaderValues?.documentType || "FACTURA_A"}
        documentNumber={pendingHeaderValues?.documentNumber || ""}
        bankAccounts={bankAccounts}
        openCashSession={openCashSession}
        isSubmitting={isSubmitting}
        errorMessage={feedback?.type === "error" ? feedback.message : null}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleFinalPaymentConfirm}
      />
    </PagePlaceholder>
  );
};


