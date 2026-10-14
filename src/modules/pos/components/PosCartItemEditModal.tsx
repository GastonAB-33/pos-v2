import { useEffect, useState } from "react";
import { Barcode, Hash, Package, Scale } from "lucide-react";
import type { PosCartItemEditInput } from "@/modules/pos/hooks/usePosSale";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";

export type PosCartItemEditScope = "sale_only" | "system_and_sale";

export interface PosCartItemView {
  product_id: string;
  name: string;
  category: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_price: number;
  code?: string | null;
  barcode?: string | null;
}

interface PosCartItemEditModalProps {
  item: PosCartItemView | null;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (values: PosCartItemEditInput, scope: PosCartItemEditScope) => void | Promise<void>;
}

const kgToGrams = (quantityKg: number): number => Number((quantityKg * 1000).toFixed(3));
const gramsToKg = (quantityGrams: number): number => Number((quantityGrams / 1000).toFixed(3));
const parsePositive = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const PosCartItemEditModal = ({
  item,
  disabled,
  onClose,
  onSubmit,
}: PosCartItemEditModalProps) => {
  useBodyScrollLock(Boolean(item));
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [saleMode, setSaleMode] = useState<"unit" | "weight">("unit");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editScope, setEditScope] = useState<PosCartItemEditScope>("sale_only");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setSaleMode(item.sale_mode);
    setQuantity(String(item.sale_mode === "weight" ? kgToGrams(item.quantity) : item.quantity));
    setUnitPrice(String(item.unit_price));
    setEditScope("sale_only");
    setIsSubmitting(false);
  }, [item]);

  if (!item) return null;

  const isManualItem = item.product_id.startsWith("manual-");

  const handleSaleModeChange = (nextMode: "unit" | "weight") => {
    if (nextMode === saleMode) return;
    setSaleMode(nextMode);

    const currentQtyNum = parsePositive(quantity);
    if (nextMode === "weight") {
      // De unidades a gramos: si tenía 1 unidad, pasar a 1000g (1 kg)
      const convertedGrams = currentQtyNum > 0 ? kgToGrams(currentQtyNum) : 1000;
      setQuantity(String(convertedGrams));
    } else {
      // De gramos a unidades: si tenía gramos, convertir a kg y redondear
      const convertedUnits = Math.max(1, Math.round(gramsToKg(currentQtyNum)));
      setQuantity(String(convertedUnits));
    }
  };

  const handleSubmit = async (scopeToUse?: PosCartItemEditScope) => {
    const finalScope = scopeToUse ?? editScope;
    const parsedQuantity = parsePositive(quantity);
    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          productId: item.product_id,
          name: name.trim() || item.name,
          category: category.trim() || item.category,
          saleMode,
          quantity: saleMode === "weight" ? gramsToKg(parsedQuantity) : parsedQuantity,
          unitPrice: parsePositive(unitPrice),
        },
        finalScope
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentGramsEquivalent =
    saleMode === "weight" && parsePositive(quantity) > 0
      ? gramsToKg(parsePositive(quantity))
      : null;

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
      <button type="button" aria-label="Cerrar edicion de item" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-4 sm:p-5 shadow-panel dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Editar producto del carrito</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Modificá modalidad de venta, precio o cantidad y elegí el alcance del cambio.
            </p>
          </div>
          <ModalCloseButton label="Cerrar edición" onClick={onClose} disabled={isSubmitting} />
        </div>

        {/* Códigos de producto y barras del ítem */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-medium">
            <Hash size={14} className="text-slate-400 dark:text-slate-500" />
            <span className="text-slate-500 dark:text-slate-400">Código:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
              {item.code?.trim() ? item.code : "Sin código"}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <div className="flex items-center gap-1.5 font-medium">
            <Barcode size={14} className="text-slate-400 dark:text-slate-500" />
            <span className="text-slate-500 dark:text-slate-400">Código de barras:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
              {item.barcode?.trim() ? item.barcode : "Sin código de barras"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Selector de opciones: Para esta venta vs Guardar en el sistema */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                editScope === "sale_only"
                  ? "border-blue-500 bg-blue-50/40 dark:border-blue-400 dark:bg-blue-950/30"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40"
              }`}
            >
              <input
                type="radio"
                name="pos-item-edit-scope"
                checked={editScope === "sale_only"}
                onChange={() => setEditScope("sale_only")}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Editar para esta venta
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Aplica únicamente a este carrito sin alterar el catálogo.
                </span>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                editScope === "system_and_sale"
                  ? "border-emerald-500 bg-emerald-50/40 dark:border-emerald-400 dark:bg-emerald-950/30"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40"
              } ${isManualItem ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="pos-item-edit-scope"
                disabled={isManualItem}
                checked={editScope === "system_and_sale"}
                onChange={() => setEditScope("system_and_sale")}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Editar y guardar en el sistema
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {isManualItem
                    ? "No disponible para ítems manuales sin producto registrado."
                    : "Actualiza precio y modalidad en esta venta y en el catálogo para futuras ventas."}
                </span>
              </div>
            </label>
          </div>

          {/* Selector de modalidad de venta: Por unidad vs Pesable */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Modalidad de venta
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaleModeChange("unit")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  saleMode === "unit"
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Package size={15} />
                <span>Por unidad (u.)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaleModeChange("weight")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  saleMode === "weight"
                    ? "border-amber-500 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-300"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Scale size={15} />
                <span>Pesable / Balanza (kg)</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="ui-input"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Categoría</label>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="ui-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {saleMode === "weight" ? "Cantidad (gramos)" : "Cantidad (unidades)"}
                </label>
                {currentGramsEquivalent !== null && (
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    = {currentGramsEquivalent} kg
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: quantity === "0" || quantity === "0.00" || quantity === "0,00",
                    onClear: () => setQuantity(""),
                  })
                }
                onBlur={(e) =>
                  handleNumericInputBlur(e, saleMode === "weight" ? "0" : "1", (val) => setQuantity(val))
                }
                className="ui-input border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90"
                placeholder={saleMode === "weight" ? "Ej: 260" : "Ej: 1"}
              />
              {saleMode === "weight" ? (
                <div className="space-y-1.5 mt-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Atajos rápidos:</span>
                    {[100, 250, 500, 1000].map((presetGrams) => (
                      <button
                        key={presetGrams}
                        type="button"
                        onClick={() => setQuantity(String(presetGrams))}
                        className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 transition"
                      >
                        {presetGrams < 1000 ? `${presetGrams}g` : "1kg"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ingresá los gramos exactos de forma libre (ej: 260 g = 0.260 kg).
                  </p>
                </div>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {saleMode === "weight" ? "Precio venta (por kg)" : "Precio venta (por unidad)"}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: unitPrice === "0" || unitPrice === "0.00" || unitPrice === "0,00",
                    onClear: () => setUnitPrice(""),
                  })
                }
                onBlur={(e) =>
                  handleNumericInputBlur(e, "0", (val) => setUnitPrice(val))
                }
                className="ui-input"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            className="ui-btn-ghost dark:border-slate-700 dark:text-slate-200"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={disabled || isSubmitting}
          >
            {isSubmitting
              ? "Guardando..."
              : editScope === "system_and_sale"
              ? "Editar y guardar en el sistema"
              : "Editar para esta venta"}
          </button>
        </div>
      </div>
    </section>
  );
};
