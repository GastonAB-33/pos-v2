import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  Tag,
} from "lucide-react";
import type { Purchase, Supplier } from "@/types/entities";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { computePricingForward, computePricingBackward } from "@/modules/productos/utils/product-pricing";
import type { PurchasePricingItemUpdate } from "@/modules/compras/hooks/usePurchasesModule";

interface PurchasePricingConfirmationModalProps {
  open: boolean;
  purchase: Purchase | null;
  supplier: Supplier | null;
  disabled?: boolean;
  onClose: () => void;
  onConfirmPricing: (
    purchaseId: string,
    itemsUpdates: PurchasePricingItemUpdate[]
  ) => Promise<boolean>;
}

interface EditableItemPricing {
  purchaseItemId: string;
  productId: string;
  productName: string;
  incomingQty: number;
  unitCost: number;
  currentSalePrice: number;
  vatPercent: number;
  profitPercent: number;
  newSalePrice: number;
  priceWithoutVat: number;
  isSelected: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PurchasePricingConfirmationModal = ({
  open,
  purchase,
  supplier,
  disabled,
  onClose,
  onConfirmPricing,
}: PurchasePricingConfirmationModalProps) => {
  const [items, setItems] = useState<EditableItemPricing[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para controles rápidos en bloque
  const [bulkProfitPercent, setBulkProfitPercent] = useState<string>("");
  const [bulkVatPercent, setBulkVatPercent] = useState<string>("");

  useEffect(() => {
    if (!open || !purchase) {
      setItems([]);
      setError(null);
      return;
    }

    const purchaseItems = purchase.items ?? [];
    const initialItems: EditableItemPricing[] = purchaseItems.map((item) => {
      const incomingQty = item.quantity + (item.bonified_quantity || 0);
      const unitCost = item.unit_cost;
      const currentSalePrice = item.sale_price ?? item.product?.price ?? 0;

      // Alícuota inicial: la del producto si ya existe, o 21% por defecto
      const vatPercent =
        item.product?.vat_percent != null && item.product.vat_percent >= 0
          ? item.product.vat_percent
          : 21;

      // Margen inicial: el que tenía el producto o 30% por defecto
      let profitPercent =
        item.product?.profit_percent != null && item.product.profit_percent > 0
          ? item.product.profit_percent
          : 30;

      // Si el producto ya tenía precio de venta y costo, calcular margen backward real
      if (currentSalePrice > 0 && unitCost > 0) {
        const backward = computePricingBackward({
          precioCosto: unitCost,
          precioFinal: currentSalePrice,
          porcentajeIva: vatPercent,
        });
        if (backward.porcentajeGanancia > 0) {
          profitPercent = Number(backward.porcentajeGanancia.toFixed(2));
        }
      }

      const forward = computePricingForward({
        precioCosto: unitCost,
        porcentajeGanancia: profitPercent,
        porcentajeIva: vatPercent,
      });

      return {
        purchaseItemId: item.id,
        productId: item.product_id,
        productName: item.product_name_snapshot,
        incomingQty,
        unitCost,
        currentSalePrice,
        vatPercent,
        profitPercent,
        newSalePrice: Number(forward.precioFinal.toFixed(2)),
        priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        isSelected: true,
      };
    });

    setItems(initialItems);
  }, [open, purchase]);

  if (!open || !purchase) return null;

  const handleProfitChange = (index: number, newProfitStr: string) => {
    const profitVal = parseFloat(newProfitStr);
    const safeProfit = isNaN(profitVal) ? 0 : profitVal;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: safeProfit,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          profitPercent: safeProfit,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleSalePriceChange = (index: number, newPriceStr: string) => {
    const priceVal = parseFloat(newPriceStr);
    const safePrice = isNaN(priceVal) ? 0 : priceVal;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const backward = computePricingBackward({
          precioCosto: item.unitCost,
          precioFinal: safePrice,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          newSalePrice: safePrice,
          profitPercent: Number(backward.porcentajeGanancia.toFixed(2)),
          priceWithoutVat: Number(backward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleVatChange = (index: number, newVatStr: string) => {
    const vatVal = parseFloat(newVatStr);
    const safeVat = isNaN(vatVal) ? 0 : vatVal;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: item.profitPercent,
          porcentajeIva: safeVat,
        });
        return {
          ...item,
          vatPercent: safeVat,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleToggleSelect = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleApplyBulkProfit = () => {
    const p = parseFloat(bulkProfitPercent);
    if (isNaN(p) || p < 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!item.isSelected) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: p,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          profitPercent: p,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleApplyBulkVat = () => {
    const v = parseFloat(bulkVatPercent);
    if (isNaN(v) || v < 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!item.isSelected) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: item.profitPercent,
          porcentajeIva: v,
        });
        return {
          ...item,
          vatPercent: v,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItems = items.filter((i) => i.isSelected);
    if (!selectedItems.length) {
      setError("Debes seleccionar al menos un producto para confirmar sus precios de venta.");
      return;
    }

    const payload: PurchasePricingItemUpdate[] = selectedItems.map((i) => ({
      purchaseItemId: i.purchaseItemId,
      productId: i.productId,
      vatPercent: i.vatPercent,
      profitPercent: i.profitPercent,
      newSalePrice: i.newSalePrice,
      priceWithoutVat: i.priceWithoutVat,
    }));

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onConfirmPricing(purchase.id, payload);
      if (ok) {
        onClose();
      } else {
        setError("Ocurrió un error al confirmar los precios. Verifica la conexión.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo completar la confirmación de precios.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = items.filter((i) => i.isSelected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4 backdrop-blur-[1px] animate-fadeIn">
      <div className="flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        {/* Cabecera */}
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:px-6 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                <Tag className="h-3 w-3" />
                Paso 2 de 2: Fijación de Precios de Venta
              </span>
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {purchase.purchase_number} &bull; {supplier?.name || "Sin proveedor"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Revisa y asigna la alícuota de IVA y el margen de ganancia (%) para actualizar el catálogo de venta.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} disabled={isSubmitting} />
        </header>

        {/* Acciones en Bloque */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 text-xs bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {selectedCount} de {items.length} productos seleccionados
            </span>
            <button
              type="button"
              onClick={() => {
                const allSelected = selectedCount === items.length;
                setItems((prev) => prev.map((i) => ({ ...i, isSelected: !allSelected })));
              }}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400 cursor-pointer ml-1"
            >
              {selectedCount === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
          </div>

          {/* Ajuste rápido para administradores */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Margen global:</span>
              <div className="relative w-20">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="35"
                  value={bulkProfitPercent}
                  onChange={(e) => setBulkProfitPercent(e.target.value)}
                  className="w-full h-7 rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 text-xs px-2 pr-5 text-right font-semibold"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyBulkProfit}
                disabled={!bulkProfitPercent}
                className="h-7 px-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Aplicar
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-300 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">IVA global:</span>
              <select
                value={bulkVatPercent}
                onChange={(e) => setBulkVatPercent(e.target.value)}
                className="h-7 rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 text-xs px-2 font-semibold"
              >
                <option value="">Seleccionar</option>
                <option value="21">21% General</option>
                <option value="10.5">10.5% Reducido</option>
                <option value="0">0% Exento</option>
                <option value="27">27% Especial</option>
              </select>
              <button
                type="button"
                onClick={handleApplyBulkVat}
                disabled={!bulkVatPercent}
                className="h-7 px-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de productos para fijar precio */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden" autoComplete="off">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs overflow-hidden">
              {items.map((item, index) => {
                const diffPercent =
                  item.currentSalePrice > 0
                    ? ((item.newSalePrice - item.currentSalePrice) / item.currentSalePrice) * 100
                    : null;
                const marginAmount = Math.max(0, item.priceWithoutVat - item.unitCost);

                return (
                  <div
                    key={item.purchaseItemId}
                    className={`p-3.5 transition-colors ${
                      item.isSelected
                        ? "bg-white dark:bg-slate-900/90"
                        : "bg-slate-50/50 dark:bg-slate-950/40 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Información del Producto */}
                      <div className="flex items-start gap-3 min-w-[240px] flex-1">
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => handleToggleSelect(index)}
                          className="mt-1 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                          title="Marcar para actualizar precio"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.productName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-medium">
                              Ingresaron: <strong className="text-slate-800 dark:text-slate-200">{item.incomingQty} u.</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Costo compra: <strong className="text-slate-800 dark:text-slate-200">{currency.format(item.unitCost)}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Precio actual: <strong className="text-slate-700 dark:text-slate-300">{item.currentSalePrice > 0 ? currency.format(item.currentSalePrice) : "Sin precio"}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Configuración de Precios: IVA + Margen + Precio Final */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-center shrink-0">
                        {/* Selector IVA Venta */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            IVA Venta
                          </label>
                          <select
                            value={item.vatPercent}
                            onChange={(e) => handleVatChange(index, e.target.value)}
                            disabled={!item.isSelected}
                            className="w-full h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 px-2 text-xs font-semibold cursor-pointer outline-none focus:border-brand-500"
                          >
                            <option value="21">21% General</option>
                            <option value="10.5">10.5% Alimentos</option>
                            <option value="0">0% Exento</option>
                            <option value="27">27% Especial</option>
                          </select>
                        </div>

                        {/* Input Margen de Ganancia % */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Ganancia %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.profitPercent}
                              onChange={(e) => handleProfitChange(index, e.target.value)}
                              disabled={!item.isSelected}
                              className="w-full h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 px-2 pr-5 text-xs text-right font-bold outline-none focus:border-brand-500"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                              %
                            </span>
                          </div>
                        </div>

                        {/* Input Precio Venta Final */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Precio Final Venta
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                              $
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.newSalePrice}
                              onChange={(e) => handleSalePriceChange(index, e.target.value)}
                              disabled={!item.isSelected}
                              className="w-full h-8 rounded-lg border border-emerald-400 dark:border-emerald-600/80 bg-white dark:bg-slate-900/90 text-emerald-800 dark:text-emerald-300 pl-6 pr-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tag de Variación de Precio */}
                      <div className="flex items-center justify-end gap-2 text-right min-w-[120px]">
                        {diffPercent != null && isFinite(diffPercent) && (
                          <span
                            className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              diffPercent > 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : diffPercent < 0
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {diffPercent > 0 ? `+${diffPercent.toFixed(1)}%` : `${diffPercent.toFixed(1)}%`}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 block" title="Ganancia neta sin IVA">
                          Neto: +{currency.format(marginAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer de Acciones */}
          <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 p-4 sm:px-6 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Al confirmar, los precios se actualizarán en el catálogo y la compra pasará a estar <strong>Confirmada</strong>.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || disabled || selectedCount === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-98 transition disabled:opacity-50 cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Check className="h-4 w-4" />
                <span>
                  {isSubmitting
                    ? "Confirmando precios..."
                    : `Confirmar Precios (${selectedCount})`}
                </span>
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};
