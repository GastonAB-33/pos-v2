import { useEffect, useState } from "react";
import { Barcode, ShoppingCart, Trash2 } from "lucide-react";

interface PosCartItemView {
  product_id: string;
  name: string;
  category: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  promotion_discount_total: number;
  line_total: number;
  applied_promotion_name: string | null;
  is_scale_item: boolean;
  scale_weight: number | null;
  scale_total_price: number | null;
  scale_barcode: string | null;
}

interface PosCartProps {
  id?: string;
  items: PosCartItemView[];
  barcodeValue: string;
  subtotalBeforePromotions: number;
  promotionDiscountTotal: number;
  cartPromotionDiscountTotal: number;
  subtotal: number;
  surchargeTotal: number;
  paymentDiscountTotal: number;
  total: number;
  canWrite: boolean;
  disabled?: boolean;
  onBarcodeChange: (value: string) => void;
  onBarcodeSubmit: () => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onEdit: (item: PosCartItemView) => void;
  onRemove: (productId: string) => void;
  onClearCart?: () => void;
  onOpenQuickProduct?: () => void;
  onCheckout: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const kgToGrams = (quantityKg: number): number => Number((quantityKg * 1000).toFixed(3));
const gramsToKg = (quantityGrams: number): number => Number((quantityGrams / 1000).toFixed(3));

const quantityToInputValue = (item: PosCartItemView): string => {
  const quantity = item.sale_mode === "weight" ? kgToGrams(item.quantity) : item.quantity;
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
};

const productUnitLabel = (item: PosCartItemView): string =>
  item.sale_mode === "weight" ? "kg" : "u.";

export const PosCart = ({
  id,
  items,
  barcodeValue,
  subtotalBeforePromotions,
  promotionDiscountTotal,
  cartPromotionDiscountTotal,
  subtotal,
  surchargeTotal,
  paymentDiscountTotal,
  total,
  canWrite,
  disabled,
  onBarcodeChange,
  onBarcodeSubmit,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onEdit,
  onRemove,
  onClearCart,
  onCheckout,
}: PosCartProps) => {
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const hasProductPromotions = promotionDiscountTotal > 0;
  const hasCartPromotions = cartPromotionDiscountTotal > 0;
  const hasAnyPromotion = hasProductPromotions || hasCartPromotions;
  const hasSurcharge = surchargeTotal > 0;
  const hasPaymentDiscount = paymentDiscountTotal > 0;
  const showDetailedSubtotal = hasAnyPromotion || hasSurcharge || hasPaymentDiscount;

  useEffect(() => {
    setQuantityDrafts((current) => {
      const itemIds = new Set(items.map((item) => item.product_id));
      const next = Object.fromEntries(
        Object.entries(current).filter(([productId]) => itemIds.has(productId))
      );

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [items]);

  const commitQuantityDraft = (item: PosCartItemView) => {
    const rawValue = quantityDrafts[item.product_id];
    if (rawValue == null) return;

    const parsedInput = Number(rawValue);
    if (Number.isFinite(parsedInput) && parsedInput > 0) {
      onSetQuantity(
        item.product_id,
        item.sale_mode === "weight" ? gramsToKg(parsedInput) : parsedInput
      );
    }

    setQuantityDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  return (
    <section id={id} className="pos-surface flex flex-col space-y-2">
      {/* Encabezado del Carrito */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShoppingCart size={17} className="text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
          </h2>
        </div>
        {items.length > 0 && onClearCart ? (
          <button
            type="button"
            className="ui-btn-ghost px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
            onClick={() => {
              const ok = window.confirm("¿Vaciar todo el carrito?");
              if (ok) onClearCart();
            }}
            disabled={disabled || !canWrite}
            title="Vaciar todos los productos del carrito"
          >
            Vaciar
          </button>
        ) : null}
      </div>

      {/* Input de Código de Barras compacto */}
      <form
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60"
        onSubmit={(event) => {
          event.preventDefault();
          onBarcodeSubmit();
        }}
      >
        <div className="relative flex-1 min-w-0">
          <Barcode size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="pos-visible-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={barcodeValue}
            onChange={(event) => onBarcodeChange(event.target.value)}
            placeholder="Escanear o código..."
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            disabled={disabled || !canWrite}
          />
        </div>
        <button
          type="submit"
          className="ui-btn-primary px-3 py-1.5 text-xs font-semibold shrink-0 disabled:opacity-50"
          disabled={disabled || !canWrite || !barcodeValue.trim()}
        >
          Leer
        </button>
      </form>

      {/* Lista de Productos en el Carrito */}
      {!items.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
          <ShoppingCart size={28} className="mb-1.5 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-slate-700 dark:text-slate-300">El carrito está vacío</p>
          <p className="text-xs text-slate-400 mt-0.5">Escaneá o seleccioná productos del catálogo</p>
        </div>
      ) : (
        <div className="flex-1 min-h-[140px] max-h-[calc(100dvh-18rem)] space-y-1.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const qtyStep = item.sale_mode === "weight" ? 50 : 1;

            return (
              <article
                key={item.product_id}
                className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Fila 1: Título completo y Precio Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-bold leading-tight text-slate-900 line-clamp-2 dark:text-slate-100"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>{currency.format(item.unit_price)} / {productUnitLabel(item)}</span>
                      {item.sale_mode === "weight" ? (
                        <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          Balanza
                        </span>
                      ) : null}
                      {item.applied_promotion_name ? (
                        <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          {item.applied_promotion_name}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                      {currency.format(item.line_total)}
                    </p>
                    {item.promotion_discount_total > 0 ? (
                      <p className="text-[10px] font-semibold text-emerald-600">
                        -{currency.format(item.promotion_discount_total)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Fila 2: Stepper de cantidad a la izquierda, botones Editar y Borrar a la derecha */}
                <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDecrease(item.product_id)}
                      disabled={disabled || !canWrite}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step={qtyStep}
                      min={0}
                      title={
                        item.sale_mode === "weight"
                          ? "Cantidad en gramos. Ej: 300 = 300 g"
                          : "Cantidad en unidades"
                      }
                      value={quantityDrafts[item.product_id] ?? quantityToInputValue(item)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuantityDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));

                        const parsedInput = Number(nextValue);
                        if (nextValue.trim() && Number.isFinite(parsedInput) && parsedInput > 0) {
                          onSetQuantity(
                            item.product_id,
                            item.sale_mode === "weight" ? gramsToKg(parsedInput) : parsedInput
                          );
                        }
                      }}
                      onBlur={() => commitQuantityDraft(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-6 w-14 rounded-lg border border-slate-300 bg-white text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      disabled={disabled || !canWrite}
                    />
                    <button
                      type="button"
                      onClick={() => onIncrease(item.product_id)}
                      disabled={disabled || !canWrite}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      +
                    </button>
                    {item.sale_mode === "weight" ? (
                      <span className="text-[10px] font-medium text-slate-400">g</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      disabled={disabled || !canWrite}
                      aria-label={`Editar ${item.name}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      title="Editar precio o detalle"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.product_id)}
                      disabled={disabled || !canWrite}
                      aria-label={`Eliminar ${item.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                      title="Eliminar producto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resumen del Carrito y Botón de Cobro */}
      <div className="mt-auto space-y-2 pt-1">
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/80">
          {showDetailedSubtotal ? (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Subtotal base</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currency.format(subtotalBeforePromotions)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currency.format(subtotal)}
              </span>
            </div>
          )}

          {hasProductPromotions ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
              <span>Desc. promociones</span>
              <span className="font-semibold">-{currency.format(promotionDiscountTotal)}</span>
            </div>
          ) : null}

          {hasCartPromotions ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
              <span>Desc. promo carrito</span>
              <span className="font-semibold">-{currency.format(cartPromotionDiscountTotal)}</span>
            </div>
          ) : null}

          {hasSurcharge ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Recargo</span>
              <span className="font-semibold text-slate-800">{currency.format(surchargeTotal)}</span>
            </div>
          ) : null}

          {hasPaymentDiscount ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
              <span>Desc. medio pago</span>
              <span className="font-semibold">-{currency.format(paymentDiscountTotal)}</span>
            </div>
          ) : null}

          <div className="mt-1.5 flex items-baseline justify-between border-t border-slate-200/80 pt-1.5 dark:border-slate-700/80">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Total final</span>
            <span className="font-kpi text-xl font-black text-blue-700 dark:text-blue-400">
              {currency.format(total)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="ui-btn-primary w-full py-2.5 text-sm font-bold shadow-sm disabled:opacity-50"
          disabled={disabled || !canWrite || !items.length}
          onClick={onCheckout}
        >
          Confirmar venta ({currency.format(total)})
        </button>
      </div>
    </section>
  );
};
