import { useEffect, useState } from "react";
import { BadgePercent, Barcode, Calculator, Percent, ShoppingCart, Trash2 } from "lucide-react";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";
import { cn } from "@/utils/cn";
import type { CartManualDiscount, PosCartItemComputed } from "@/modules/pos/hooks/usePosSale";
import type { ReturnableCartStatus, ReturnableConfig } from "@/utils/returnable-packages";

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
  is_debt_payment_item?: boolean;
  is_returnable_package_item?: boolean;
  returnable_config?: ReturnableConfig | null;
  returnable_status?: ReturnableCartStatus;
  manual_discount?: { type: "percent" | "amount"; value: number; reason: string } | null;
  manual_promotion?: { id: string; name: string; code: string; discount_amount: number } | null;
}

interface PosCartProps {
  id?: string;
  items: PosCartItemView[];
  isHighlighted?: boolean;
  barcodeValue: string;
  subtotalBeforePromotions: number;
  promotionDiscountTotal: number;
  cartPromotionDiscountTotal: number;
  cartManualDiscount?: CartManualDiscount | null;
  manualCartDiscountTotal?: number;
  subtotal: number;
  surchargeTotal: number;
  paymentDiscountTotal: number;
  roundingAdjustment?: number;
  roundingEnabled?: boolean;
  onToggleRounding?: () => void;
  total: number;
  discountsEnabled?: boolean;
  onToggleDiscounts?: () => void;
  onOpenCartDiscountModal?: () => void;
  onRemoveCartDiscount?: () => void;
  onOpenItemPromoModal?: (item: PosCartItemComputed) => void;
  canWrite: boolean;
  disabled?: boolean;
  onBarcodeChange: (value: string) => void;
  onBarcodeSubmit: () => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onEdit: (item: PosCartItemView) => void;
  onRemove: (productId: string) => void;
  onCycleReturnableStatus?: (productId: string) => void;
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
  isHighlighted = false,
  barcodeValue,
  subtotalBeforePromotions,
  promotionDiscountTotal,
  cartPromotionDiscountTotal,
  cartManualDiscount,
  manualCartDiscountTotal = 0,
  subtotal,
  surchargeTotal,
  paymentDiscountTotal,
  roundingAdjustment = 0,
  roundingEnabled = true,
  onToggleRounding,
  total,
  discountsEnabled = true,
  onToggleDiscounts,
  onOpenCartDiscountModal,
  onRemoveCartDiscount,
  onOpenItemPromoModal,
  canWrite,
  disabled,
  onBarcodeChange,
  onBarcodeSubmit,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onEdit,
  onRemove,
  onCycleReturnableStatus,
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
    if (Number.isFinite(parsedInput) && parsedInput >= 0) {
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
    <section
      id={id}
      className={[
        "pos-surface flex flex-col space-y-2 transition-all duration-300",
        isHighlighted
          ? "ring-2 ring-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
          : "",
      ].join(" ")}
    >
      {/* Encabezado del Carrito */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShoppingCart
            size={17}
            className={[
              "transition-all duration-200",
              isHighlighted ? "text-emerald-500 scale-110" : "text-blue-600",
            ].join(" ")}
          />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
            {isHighlighted && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-full border border-emerald-300/40 dark:border-emerald-700/60 animate-pulse">
                ✓ Agregado
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleRounding ? (
            <button
              type="button"
              onClick={onToggleRounding}
              disabled={disabled || !canWrite}
              title={
                roundingEnabled
                  ? "Redondeo comercial activado (clic para desactivar)"
                  : "Redondeo comercial desactivado (clic para activar)"
              }
              aria-label={roundingEnabled ? "Desactivar redondeo" : "Activar redondeo"}
              className={cn(
                "h-6 px-1.5 rounded-lg border flex items-center justify-center gap-1 text-[11px] font-semibold transition shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0",
                roundingEnabled
                  ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                  : "border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
              )}
            >
              {roundingEnabled ? (
                <Calculator size={13} />
              ) : (
                <span className="relative flex items-center justify-center">
                  <Calculator size={13} className="opacity-50" />
                  <span className="absolute h-0.5 w-3 bg-rose-500 rotate-45 rounded-full" />
                </span>
              )}
              <span>{roundingEnabled ? "Red. ON" : "Red. OFF"}</span>
            </button>
          ) : onToggleDiscounts ? (
            <button
              type="button"
              onClick={onToggleDiscounts}
              disabled={disabled || !canWrite}
              title={
                discountsEnabled
                  ? "Descuentos activados (clic para desactivar)"
                  : "Descuentos desactivados (clic para activar)"
              }
              aria-label={discountsEnabled ? "Desactivar descuentos" : "Activar descuentos"}
              className={cn(
                "h-6 w-6 rounded-lg border flex items-center justify-center transition shadow-2xs cursor-pointer disabled:opacity-40",
                discountsEnabled
                  ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                  : "border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
              )}
            >
              {discountsEnabled ? (
                <BadgePercent size={13} />
              ) : (
                <span className="relative flex items-center justify-center">
                  <BadgePercent size={13} className="opacity-50" />
                  <span className="absolute h-0.5 w-3.5 bg-rose-500 rotate-45 rounded-full" />
                </span>
              )}
            </button>
          ) : null}

          {onOpenCartDiscountModal ? (
            <button
              type="button"
              onClick={onOpenCartDiscountModal}
              disabled={disabled || !canWrite || items.length === 0}
              title={
                cartManualDiscount
                  ? `Descuento global aplicado: ${cartManualDiscount.type === "percent" ? `${cartManualDiscount.value}%` : `$${cartManualDiscount.value}`}. Clic para editar`
                  : "Aplicar descuento global al carrito con monto y motivo"
              }
              className={cn(
                "h-6 px-2 rounded-lg border flex items-center justify-center gap-1 text-[11px] font-semibold transition shadow-2xs cursor-pointer disabled:opacity-40",
                cartManualDiscount
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold"
                  : "border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 dark:hover:border-emerald-800/80"
              )}
            >
              <Percent size={11} className={cartManualDiscount ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
              <span>
                {cartManualDiscount
                  ? cartManualDiscount.type === "percent"
                    ? `-${cartManualDiscount.value}%`
                    : `-$${cartManualDiscount.value.toLocaleString("es-AR")}`
                  : "Desc."}
              </span>
            </button>
          ) : null}

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
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
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
          {cartManualDiscount ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <BadgePercent size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs">Desc. Carrito</span>
                    <span className="text-[10px] font-extrabold px-1 py-0.2 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                      {cartManualDiscount.type === "percent"
                        ? `-${cartManualDiscount.value}%`
                        : `-$${cartManualDiscount.value.toLocaleString("es-AR")}`}
                    </span>
                    {manualCartDiscountTotal > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        (-{currency.format(manualCartDiscountTotal)})
                      </span>
                    ) : null}
                  </div>
                  {cartManualDiscount.reason ? (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate">
                      {cartManualDiscount.reason}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onOpenCartDiscountModal ? (
                  <button
                    type="button"
                    onClick={onOpenCartDiscountModal}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                ) : null}
                {onRemoveCartDiscount ? (
                  <button
                    type="button"
                    onClick={onRemoveCartDiscount}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white dark:hover:bg-slate-800"
                    title="Quitar descuento del carrito"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {items.map((item) => {
            const qtyStep = item.sale_mode === "weight" ? "any" : 1;

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
                      {item.is_debt_payment_item ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          Cobro Cta. Cte.
                        </span>
                      ) : null}
                      {item.is_returnable_package_item ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          📦 Cobro de Envase
                        </span>
                      ) : null}
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
                      {item.manual_discount ? (
                        <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                          {item.manual_discount.type === "percent" ? `-${item.manual_discount.value}%` : `-$${item.manual_discount.value}`}
                        </span>
                      ) : null}
                      {item.manual_promotion ? (
                        <span className="rounded bg-purple-100 px-1 py-0.2 text-[9px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                          {item.manual_promotion.name}
                        </span>
                      ) : null}
                      {item.returnable_config?.enabled && onCycleReturnableStatus ? (
                        <button
                          type="button"
                          onClick={() => onCycleReturnableStatus(item.product_id)}
                          disabled={disabled || !canWrite}
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition shadow-2xs cursor-pointer select-none",
                            item.returnable_status === "charge"
                              ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900"
                              : item.returnable_status === "owe"
                              ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900"
                              : "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900"
                          )}
                          title="Hacé clic para cambiar estado: Trajo envase / Cobrar envase / Anotar envase"
                        >
                          {item.returnable_status === "charge" ? (
                            <span>💰 Cobrar envase (+{currency.format(item.returnable_config.packagePrice * item.quantity)})</span>
                          ) : item.returnable_status === "owe" ? (
                            <span>📝 Anotar envase (Cta. Cte.)</span>
                          ) : (
                            <span>✓ Trajo envase</span>
                          )}
                        </button>
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
                  {item.is_debt_payment_item ? (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Pago único
                    </span>
                  ) : item.is_returnable_package_item ? (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60">
                      {item.quantity} {item.quantity === 1 ? "envase" : "envases"}
                    </span>
                  ) : (
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
                        placeholder="0"
                        title={
                          item.sale_mode === "weight"
                            ? "Cantidad en gramos"
                            : "Cantidad en unidades"
                        }
                        value={quantityDrafts[item.product_id] ?? quantityToInputValue(item)}
                        onFocus={(event) =>
                          handleNumericInputFocus(event, {
                            isNew: true,
                            onClear: () =>
                              setQuantityDrafts((current) => ({
                                ...current,
                                [item.product_id]: "",
                              })),
                          })
                        }
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setQuantityDrafts((current) => ({
                            ...current,
                            [item.product_id]: nextValue,
                          }));

                          const parsedInput = Number(nextValue);
                          if (nextValue.trim() && Number.isFinite(parsedInput) && parsedInput >= 0) {
                            onSetQuantity(
                              item.product_id,
                              item.sale_mode === "weight" ? gramsToKg(parsedInput) : parsedInput
                            );
                          }
                        }}
                        onBlur={(event) => {
                          handleNumericInputBlur(event, "0", () => {
                            setQuantityDrafts((current) => ({
                              ...current,
                              [item.product_id]: "0",
                            }));
                            onSetQuantity(item.product_id, 0);
                          });
                          commitQuantityDraft(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        className="h-7 w-14 rounded-lg border border-slate-300 bg-white text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-slate-400">g</span>
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                            ({Number(item.quantity.toFixed(3))} kg)
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {!item.is_debt_payment_item && !item.is_returnable_package_item && onOpenItemPromoModal ? (
                      <button
                        type="button"
                        onClick={() => onOpenItemPromoModal(item as PosCartItemComputed)}
                        disabled={disabled || !canWrite}
                        aria-label={`Promoción o descuento para ${item.name}`}
                        className={cn(
                          "rounded-lg border px-1.5 py-0.5 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1",
                          item.manual_discount || item.manual_promotion
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        )}
                        title="Aplicar promoción o descuento a este producto"
                      >
                        <BadgePercent
                          size={11}
                          className={item.manual_discount || item.manual_promotion ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}
                        />
                        <span>Promo</span>
                      </button>
                    ) : null}
                    {!item.is_returnable_package_item && (
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
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(item.product_id)}
                      disabled={disabled || !canWrite}
                      aria-label={`Eliminar ${item.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                      title={item.is_returnable_package_item ? "Quitar cobro de envase" : "Eliminar producto"}
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

          {!discountsEnabled ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-rose-500 dark:text-rose-400">
              <span>Descuentos</span>
              <span className="font-semibold text-[10px] uppercase">Desactivados</span>
            </div>
          ) : null}

          {manualCartDiscountTotal > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Percent size={11} />
                <span>
                  Desc. carrito {cartManualDiscount?.type === "percent" ? `(${cartManualDiscount.value}%)` : ""}
                </span>
              </span>
              <span className="font-semibold">-{currency.format(manualCartDiscountTotal)}</span>
            </div>
          ) : null}

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

          {roundingAdjustment !== 0 && roundingEnabled ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Redondeo comercial</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {roundingAdjustment > 0 ? `+${currency.format(roundingAdjustment)}` : currency.format(roundingAdjustment)}
              </span>
            </div>
          ) : !roundingEnabled ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>Redondeo comercial</span>
              <span className="font-semibold text-[10px] uppercase text-rose-500 dark:text-rose-400">
                Desactivado
              </span>
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
