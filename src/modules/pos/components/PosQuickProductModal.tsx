import { useEffect, useMemo, useState } from "react";
import type { PosQuickProductInput } from "@/modules/pos/hooks/usePosSale";

interface PosQuickProductModalProps {
  open: boolean;
  categories: string[];
  disabled?: boolean;
  onClose: () => void;
  onAddManual: (values: PosQuickProductInput) => boolean;
  onCreateAndAdd: (values: PosQuickProductInput) => Promise<boolean>;
}

type SaveMode = "sale_only" | "catalog";

const parsePositive = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const gramsToKg = (value: number): number => Number((value / 1000).toFixed(3));

export const PosQuickProductModal = ({
  open,
  categories,
  disabled,
  onClose,
  onAddManual,
  onCreateAndAdd,
}: PosQuickProductModalProps) => {
  const [saveMode, setSaveMode] = useState<SaveMode>("sale_only");
  const [saleMode, setSaleMode] = useState<"unit" | "weight">("unit");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [favorite, setFavorite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaveMode("sale_only");
    setSaleMode("unit");
    setName("");
    setCategory(categories[0] ?? "General");
    setQuantity("1");
    setUnitPrice("");
    setCostPrice("");
    setStock("");
    setCode("");
    setBarcode("");
    setFavorite(true);
    setIsSubmitting(false);
  }, [categories, open]);

  const quantityLabel = saleMode === "weight" ? "Cantidad a vender (gramos)" : "Cantidad a vender";
  const priceLabel = saleMode === "weight" ? "Precio por kg" : "Precio unitario";
  const stockLabel = saleMode === "weight" ? "Stock inicial en kg" : "Stock inicial";
  const parsedQuantity = useMemo(() => parsePositive(quantity), [quantity]);
  const suggestedStock =
    saleMode === "weight" ? String(Math.max(gramsToKg(parsedQuantity), 0.001)) : quantity;

  if (!open) return null;

  const buildInput = (): PosQuickProductInput => {
    const quantityValue = parsePositive(quantity);
    const normalizedQuantity = saleMode === "weight" ? gramsToKg(quantityValue) : quantityValue;
    const stockValue = parsePositive(stock || suggestedStock);

    return {
      name,
      category,
      saleMode,
      quantity: normalizedQuantity,
      unitPrice: parsePositive(unitPrice),
      costPrice: parsePositive(costPrice),
      stock: stockValue,
      code,
      barcode,
      favorite,
    };
  };

  const submit = async () => {
    if (isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      const values = buildInput();
      const ok =
        saveMode === "catalog"
          ? await onCreateAndAdd(values)
          : onAddManual(values);

      if (ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
      <button type="button" aria-label="Cerrar producto rapido" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Agregar producto rapido</h2>
            <p className="text-xs text-slate-500">Carga lo minimo para resolver la venta sin salir del POS.</p>
          </div>
          <button type="button" className="ui-btn-ghost px-3 py-1.5 text-xs" onClick={onClose} disabled={isSubmitting}>
            Cerrar
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="radio"
                className="mr-2"
                checked={saveMode === "sale_only"}
                onChange={() => setSaveMode("sale_only")}
              />
              Solo para esta venta
              <span className="mt-1 block text-xs text-slate-500">No se guarda en productos ni descuenta stock.</span>
            </label>
            <label className="rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="radio"
                className="mr-2"
                checked={saveMode === "catalog"}
                onChange={() => setSaveMode("catalog")}
              />
              Guardar en el sistema
              <span className="mt-1 block text-xs text-slate-500">Crea el producto y queda disponible para futuras ventas.</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="ui-input" autoFocus />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
              <input
                list="pos-quick-product-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="ui-input"
              />
              <datalist id="pos-quick-product-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de venta</label>
              <select value={saleMode} onChange={(event) => setSaleMode(event.target.value as "unit" | "weight")} className="ui-input">
                <option value="unit">Por unidad</option>
                <option value="weight">Pesable</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{quantityLabel}</label>
              <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="ui-input" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{priceLabel}</label>
              <input type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="ui-input" />
            </div>

            {saveMode === "catalog" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Costo</label>
                  <input type="number" min="0" step="0.01" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} className="ui-input" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{stockLabel}</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    placeholder={suggestedStock}
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Codigo interno</label>
                  <input value={code} onChange={(event) => setCode(event.target.value)} className="ui-input" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Codigo de barras</label>
                  <input value={barcode} onChange={(event) => setBarcode(event.target.value)} className="ui-input" />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                  Mostrar en favoritos del POS
                </label>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="ui-btn-primary" onClick={() => void submit()} disabled={disabled || isSubmitting}>
            {isSubmitting ? "Agregando..." : "Agregar al carrito"}
          </button>
        </div>
      </div>
    </section>
  );
};
