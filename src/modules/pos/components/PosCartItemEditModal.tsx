import { useEffect, useState } from "react";
import type { PosCartItemEditInput } from "@/modules/pos/hooks/usePosSale";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

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
  onSubmit: (values: PosCartItemEditInput) => void;
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

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setQuantity(String(item.sale_mode === "weight" ? kgToGrams(item.quantity) : item.quantity));
    setUnitPrice(String(item.unit_price));
  }, [item]);

  if (!item) return null;

  const submit = () => {
    const parsedQuantity = parsePositive(quantity);
    onSubmit({
      productId: item.product_id,
      name,
      category,
      quantity: item.sale_mode === "weight" ? gramsToKg(parsedQuantity) : parsedQuantity,
      unitPrice: parsePositive(unitPrice),
    });
    onClose();
  };

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
      <button type="button" aria-label="Cerrar edicion de item" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Editar producto del carrito</h2>
            <p className="text-xs text-slate-500">Estos cambios afectan solo esta venta.</p>
          </div>
          <ModalCloseButton label="Cerrar edición" onClick={onClose} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className="ui-input" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="ui-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {item.sale_mode === "weight" ? "Cantidad (gramos)" : "Cantidad"}
            </label>
            <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="ui-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {item.sale_mode === "weight" ? "Precio por kg" : "Precio unitario"}
            </label>
            <input type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="ui-input" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="ui-btn-primary" onClick={submit} disabled={disabled}>
            Guardar cambios
          </button>
        </div>
      </div>
    </section>
  );
};
