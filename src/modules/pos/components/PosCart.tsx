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
  items: PosCartItemView[];
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
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PosCart = ({
  items,
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
  onIncrease,
  onDecrease,
  onSetQuantity,
  onRemove,
}: PosCartProps) => {
  const hasProductPromotions = promotionDiscountTotal > 0;
  const hasCartPromotions = cartPromotionDiscountTotal > 0;
  const hasAnyPromotion = hasProductPromotions || hasCartPromotions;
  const hasSurcharge = surchargeTotal > 0;
  const hasPaymentDiscount = paymentDiscountTotal > 0;
  const hasPaymentAdjustment = paymentAdjustment !== 0;
  const showDetailedSubtotal = hasAnyPromotion || hasSurcharge || hasPaymentDiscount;

  return (
    <section className="pos-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Cart ({items.length} items)</h2>
        <span className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Venta activa
        </span>
      </div>

      {!items.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Todavia no agregaste productos.
        </div>
      ) : (
        <div className="max-h-[320px] space-y-1.5 overflow-auto pr-1">
          {items.map((item) => {
            const qtyStep = item.sale_mode === "weight" ? 0.1 : 1;

            return (
              <article key={item.product_id} className="pos-cart-item pos-cart-item--compact">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.name}>{item.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.category}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{currency.format(item.unit_price)} c/u</p>
                  {item.applied_promotion_name ? (
                    <p className="text-[11px] text-emerald-700">Promo: {item.applied_promotion_name}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  {item.sale_mode === "weight" ? <span className="ui-badge ui-badge--info">kg</span> : null}
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
                    value={item.quantity}
                    onChange={(event) =>
                      onSetQuantity(item.product_id, Number(event.target.value))
                    }
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
    </section>
  );
};
