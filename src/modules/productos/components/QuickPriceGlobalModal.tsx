import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useProducts } from "@/modules/productos/hooks/useProducts";
import { ProductQuickPriceModal } from "@/modules/productos/components/ProductQuickPriceModal";
import { ProductFormModal } from "@/modules/productos/components/ProductFormModal";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";
import { useToast } from "@/components/ui/useToast";

interface QuickPriceGlobalModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormModalState {
  mode: "create" | "edit";
  product: ProductViewModel | null;
  initialBarcode?: string | null;
  initialName?: string | null;
}

export const QuickPriceGlobalModal = ({
  open,
  onClose,
}: QuickPriceGlobalModalProps) => {
  const { tenantId } = useTenant();
  const { canWrite } = usePermissions();
  const { user } = useAuthStore();
  const toast = useToast();
  const canWriteProductos = canWrite("productos");

  const products = useProducts(tenantId, user?.id ?? null);
  const [backgroundSavingText, setBackgroundSavingText] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<FormModalState | null>(null);

  if (!open) return null;

  const handleSavePrice = async (
    productId: string,
    pricing: {
      costPrice: number;
      profitPercent: number;
      vatPercent: number;
      priceWithoutVat: number;
      finalPrice: number;
      addedStock?: number;
    }
  ) => {
    try {
      setBackgroundSavingText("Guardando cambios...");
      await products.updateProductPricing(productId, pricing);
      setBackgroundSavingText(null);
      toast.success("Precio actualizado correctamente");
    } catch (err) {
      setBackgroundSavingText(null);
      toast.error(err instanceof Error ? err.message : "Error al actualizar precio");
      throw err;
    }
  };

  const handleOpenCreate = (query?: string) => {
    const trimmed = query?.trim() ?? "";
    const isBarcodeLike = trimmed.length >= 6 && /^\d+$/.test(trimmed);
    setFormModal({
      mode: "create",
      product: null,
      initialBarcode: isBarcodeLike ? trimmed : null,
      initialName: !isBarcodeLike && trimmed ? trimmed : null,
    });
  };

  const handleOpenEdit = (product: ProductViewModel) => {
    setFormModal({
      mode: "edit",
      product,
    });
  };

  const handleSaveProductForm = async (values: ProductFormModalValues): Promise<void> => {
    const mode = formModal?.mode ?? "create";
    const targetEntity = formModal?.product?.entity ?? null;
    const productName = values.nombre?.trim() || "Producto";

    // Cerrar el formulario y regresar de inmediato a Consulta Rápida mientras se guarda en segundo plano
    setFormModal(null);
    setBackgroundSavingText(`Guardando "${productName}"...`);

    void products
      .saveProduct(mode, values, targetEntity)
      .then(() => {
        setBackgroundSavingText(null);
        toast.success(
          mode === "create"
            ? `Producto "${productName}" creado correctamente`
            : `Producto "${productName}" actualizado correctamente`
        );
      })
      .catch((err) => {
        setBackgroundSavingText(null);
        toast.error(err instanceof Error ? err.message : "Error al guardar el producto");
      });
  };

  return (
    <>
      <ProductQuickPriceModal
        open={open && !formModal}
        onClose={onClose}
        products={products.productsView}
        barcodesByProductId={products.barcodesByProductId}
        canWrite={canWriteProductos}
        backgroundSavingText={backgroundSavingText}
        onSavePrice={handleSavePrice}
        onCreateNewProduct={handleOpenCreate}
        onEditProduct={handleOpenEdit}
      />

      <ProductFormModal
        open={Boolean(formModal)}
        mode={formModal?.mode ?? "create"}
        product={formModal?.product ?? null}
        initialBarcode={formModal?.initialBarcode}
        initialName={formModal?.initialName}
        categoryOptions={products.categoryOptions}
        subcategoryOptions={products.subcategoryOptions}
        disabled={!canWriteProductos}
        onClose={() => setFormModal(null)}
        onSubmit={handleSaveProductForm}
      />
    </>
  );
};
