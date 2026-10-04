import { useEffect, useState } from "react";
import type { PosCartItemEditInput } from "@/modules/pos/hooks/usePosSale";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";

export type PosCartItemEditScope = "sale_only" | "system_and_sale";

interface PosCartItemView {
  product_id: string;
  name: string;
  category: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_price: number;
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
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editScope, setEditScope] = useState<PosCartItemEditScope>("sale_only");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setQuantity(String(item.sale_mode === "weight" ? kgToGrams(item.quantity) : item.quantity));
    setUnitPrice(String(item.unit_price));
    setEditScope("sale_only");
    setIsSubmitting(false);
  }, [item]);

  if (!item) return null;

  const isManualItem = item.product_id.startsWith("manual-");

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
          quantity: item.sale_mode === "weight" ? gramsToKg(parsedQuantity) : parsedQuantity,
          unitPrice: parsePositive(unitPrice),
        },
        finalScope
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
      <button type="button" aria-label="Cerrar edicion de item" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-4 sm:p-5 shadow-panel dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Editar producto del carrito</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Modificá el precio de venta o la cantidad y elegí el alcance del cambio.
            </p>
          </div>
          <ModalCloseButton label="Cerrar edición" onClick={onClose} disabled={isSubmitting} />
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
                  Aplica el precio únicamente a este carrito sin alterar el catálogo.
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
                    : "Actualiza el precio en esta venta y en la base de datos para futuras ventas."}
                </span>
              </div>
            </label>
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
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Categoria</label>
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
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {item.sale_mode === "weight" ? "Cantidad (gramos)" : "Cantidad"}
              </label>
              <input
                type="number"
                min="0"
                step={item.sale_mode === "weight" ? "50" : "0.001"}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: quantity === "0" || quantity === "0.00" || quantity === "0,00",
                    onClear: () => setQuantity(""),
                  })
                }
                onBlur={(e) =>
                  handleNumericInputBlur(e, item.sale_mode === "weight" ? "0" : "1", (val) => setQuantity(val))
                }
                className="ui-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {item.sale_mode === "weight" ? "Precio venta (por kg)" : "Precio venta"}
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
