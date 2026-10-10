import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useProducts } from "@/modules/productos/hooks/useProducts";
import { ProductQuickPriceModal } from "@/modules/productos/components/ProductQuickPriceModal";
import { routePaths } from "@/config/routes";
import { useToast } from "@/components/ui/useToast";

interface QuickPriceGlobalModalProps {
  open: boolean;
  onClose: () => void;
}

export const QuickPriceGlobalModal = ({
  open,
  onClose,
}: QuickPriceGlobalModalProps) => {
  const { tenantId } = useTenant();
  const { canWrite } = usePermissions();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const canWriteProductos = canWrite("productos");

  const products = useProducts(tenantId, user?.id ?? null);
  const [backgroundSavingText, setBackgroundSavingText] = useState<string | null>(null);

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

  return (
    <ProductQuickPriceModal
      open={open}
      onClose={onClose}
      products={products.productsView}
      barcodesByProductId={products.barcodesByProductId}
      canWrite={canWriteProductos}
      backgroundSavingText={backgroundSavingText}
      onSavePrice={handleSavePrice}
      onCreateNewProduct={() => {
        onClose();
        navigate(routePaths.productos);
      }}
      onEditProduct={() => {
        onClose();
        navigate(routePaths.productos);
      }}
    />
  );
};
