import { useEffect, useState } from "react";

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
  paymentAdjustment: number;
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
  paymentAdjustment,
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
  onCheckout,
}: PosCartProps) => {
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const hasProductPromotions = promotionDiscountTotal > 0;
  const hasCartPromotions = cartPromotionDiscountTotal > 0;
  const hasAnyPromotion = hasProductPromotions || hasCartPromotions;
  const hasSurcharge = surchargeTotal > 0;
  const hasPaymentDiscount = paymentDiscountTotal > 0;
  const hasPaymentAdjustment = paymentAdjustment !== 0;
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
    <section id={id} className="pos-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Cart ({items.length} items)</h2>
        <span className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Venta activa
        </span>
      </div>

      <form
        className="rounded-xl border border-slate-200 bg-slate-50 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          onBarcodeSubmit();
        }}
      >
        <label htmlFor="pos-visible-barcode" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Codigo de barras
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="pos-visible-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={barcodeValue}
            onChange={(event) => onBarcodeChange(event.target.value)}
            placeholder="Escanear o escribir codigo"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={disabled || !canWrite}
          />
          <button
            type="submit"
            className="ui-btn-primary px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled || !canWrite || !barcodeValue.trim()}
          >
            Leer
          </button>
        </div>
      </form>

      {!items.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Todavia no agregaste productos.
        </div>
      ) : (
        <div className="max-h-[320px] space-y-1.5 overflow-auto pr-1">
          {items.map((item) => {
            const qtyStep = item.sale_mode === "weight" ? 1 : 1;

            return (
              <article key={item.product_id} className="pos-cart-item pos-cart-item--compact">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.name}>{item.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.category}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {currency.format(item.unit_price)} / {productUnitLabel(item)}
                  </p>
                  {item.applied_promotion_name ? (
                    <p className="text-[11px] text-emerald-700">Promo: {item.applied_promotion_name}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  {item.sale_mode === "weight" ? <span className="ui-badge ui-badge--info">g</span> : null}
                  {item.is_scale_item ? <span className="ui-badge ui-badge--info">balanza</span> : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDecrease(item.product_id)}
                    disabled={disabled || !canWrite}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step={qtyStep}
                    min={0}
                    title={item.sale_mode === "weight" ? "Cantidad en gramos. Ej: 300 = 300 g" : "Cantidad en unidades"}
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
                      if (event.key !== "Enter") return;
                      event.currentTarget.blur();
                    }}
                    className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 text-center text-xs"
                    disabled={disabled || !canWrite}
                  />
                  <button
                    type="button"
                    onClick={() => onIncrease(item.product_id)}
                    disabled={disabled || !canWrite}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{currency.format(item.line_total)}</p>
                  {item.promotion_discount_total > 0 ? (
                    <p className="text-[11px] text-emerald-700">-{currency.format(item.promotion_discount_total)}</p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Subtotal</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  disabled={disabled || !canWrite}
                  aria-label={`Editar ${item.name}`}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
                  title="Editar item"
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(item.product_id)}
                  disabled={disabled || !canWrite}
                  aria-label={`Eliminar ${item.name}`}
                  className="pos-cart-remove-btn"
                  title="Eliminar"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="pos-summary-panel text-sm">
        {showDetailedSubtotal ? (
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal base</span>
            <span className="font-medium text-slate-900">{currency.format(subtotalBeforePromotions)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium text-slate-900">{currency.format(subtotal)}</span>
          </div>
        )}

        {hasProductPromotions ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Desc. promociones</span>
            <span className="font-medium text-slate-900">-{currency.format(promotionDiscountTotal)}</span>
          </div>
        ) : null}

        {hasCartPromotions ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Desc. promo carrito</span>
            <span className="font-medium text-slate-900">-{currency.format(cartPromotionDiscountTotal)}</span>
          </div>
        ) : null}

        {hasAnyPromotion ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Subtotal con promos</span>
            <span className="font-medium text-slate-900">{currency.format(subtotal)}</span>
          </div>
        ) : null}

        {hasSurcharge ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Recargo</span>
            <span className="font-medium text-slate-900">{currency.format(surchargeTotal)}</span>
          </div>
        ) : null}

        {hasPaymentDiscount ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Desc. medio pago</span>
            <span className="font-medium text-slate-900">-{currency.format(paymentDiscountTotal)}</span>
          </div>
        ) : null}

        {hasPaymentAdjustment ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Ajuste medio pago</span>
            <span className="font-medium text-slate-900">{currency.format(paymentAdjustment)}</span>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="font-semibold text-slate-900">Total final</span>
          <span className="font-kpi text-2xl font-semibold text-brand-700">{currency.format(total)}</span>
        </div>
      </div>

      <button
        type="button"
        className="ui-btn-primary w-full py-3 text-base disabled:opacity-50"
        disabled={disabled || !canWrite || !items.length}
        onClick={onCheckout}
      >
        Confirmar venta
      </button>
    </section>
  );
};
