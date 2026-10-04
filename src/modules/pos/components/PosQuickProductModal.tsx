import { useEffect, useMemo, useState } from "react";
import type { PosQuickProductInput } from "@/modules/pos/hooks/usePosSale";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { handleNumericInputFocus } from "@/utils/input-helpers";

interface PosQuickProductModalProps {
  open: boolean;
  categories: string[];
  disabled?: boolean;
  onClose: () => void;
  onAddManual: (values: PosQuickProductInput) => boolean;
  onCreateAndAdd: (values: PosQuickProductInput) => Promise<boolean>;
  title?: string;
  subtitle?: string;
  saleOnlyLabel?: string;
  saleOnlyDescription?: string;
  catalogLabel?: string;
  catalogDescription?: string;
  submitButtonText?: string;
  initialName?: string;
  initialBarcode?: string;
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
  title,
  subtitle,
  saleOnlyLabel,
  saleOnlyDescription,
  catalogLabel,
  catalogDescription,
  submitButtonText,
  initialName,
  initialBarcode,
}: PosQuickProductModalProps) => {
  useBodyScrollLock(open);
  const [saveMode, setSaveMode] = useState<SaveMode>("catalog");
  const [saleMode, setSaleMode] = useState<"unit" | "weight">("unit");
  const [name, setName] = useState(initialName ?? "");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [code, setCode] = useState(initialBarcode ?? "");
  const [barcode, setBarcode] = useState(initialBarcode ?? "");
  const [favorite, setFavorite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cleanInitialBarcode = initialBarcode?.trim() ?? "";
    setSaveMode("catalog");
    setSaleMode("unit");
    setName(initialName ?? "");
    setCategory(categories[0] ?? "General");
    setQuantity("1");
    setUnitPrice("");
    setCostPrice("");
    setStock("");
    setCode(cleanInitialBarcode);
    setBarcode(cleanInitialBarcode);
    setFavorite(true);
    setIsSubmitting(false);
  }, [categories, initialBarcode, initialName, open]);

  const quantityLabel = saleMode === "weight" ? "Cantidad a vender (gramos)" : "Cantidad a vender";
  const priceLabel = saleMode === "weight" ? "Precio venta (por kg)" : "Precio venta";
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
            <h2 className="text-base font-semibold text-slate-900">
              {title ?? "Agregar producto rapido"}
            </h2>
            <p className="text-xs text-slate-500">
              {subtitle ?? "Carga lo minimo para resolver la venta sin salir del POS."}
            </p>
          </div>
          <ModalCloseButton label="Cerrar producto rápido" onClick={onClose} disabled={isSubmitting} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              <input
                type="radio"
                className="mr-2"
                checked={saveMode === "sale_only"}
                onChange={() => setSaveMode("sale_only")}
              />
              {saleOnlyLabel ?? "Solo para esta venta"}
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {saleOnlyDescription ?? "No se guarda en productos ni descuenta stock."}
              </span>
            </label>
            <label className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              <input
                type="radio"
                className="mr-2"
                checked={saveMode === "catalog"}
                onChange={() => setSaveMode("catalog")}
              />
              {catalogLabel ?? "Guardar en el sistema"}
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {catalogDescription ?? "Crea el producto y queda disponible para futuras ventas."}
              </span>
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
                spellCheck={false}
                data-lpignore="true"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Categoria</label>
              <input
                list="pos-quick-product-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="ui-input"
                autoComplete="off"
              />
              <datalist id="pos-quick-product-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {category.trim() ? (
                categories.some((c) => c.toLowerCase() === category.trim().toLowerCase()) ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Categoría existente
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Esta categoría no está creada (se creará al guardar)
                  </p>
                )
              ) : null}
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
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: false,
                  })
                }
                className="ui-input"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{priceLabel}</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: unitPrice === "0" || unitPrice === "0.00",
                    onClear: () => setUnitPrice(""),
                  })
                }
                className="ui-input"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Codigo de barras</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Opcional o escaneado"
                className="ui-input"
              />
            </div>

            {saveMode === "catalog" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Costo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(event) => setCostPrice(event.target.value)}
                    onFocus={(e) =>
                      handleNumericInputFocus(e, {
                        isNew: costPrice === "0" || costPrice === "0.00",
                        onClear: () => setCostPrice(""),
                      })
                    }
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{stockLabel}</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    onFocus={(e) =>
                      handleNumericInputFocus(e, {
                        isNew: stock === "0" || stock === "0.00",
                        onClear: () => setStock(""),
                      })
                    }
                    placeholder={suggestedStock}
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Codigo interno</label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="ui-input"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                  Mostrar en favoritos del POS
                </label>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="ui-btn-primary" onClick={() => void submit()} disabled={disabled || isSubmitting}>
            {isSubmitting ? "Agregando..." : submitButtonText ?? "Agregar al carrito"}
          </button>
        </div>
      </div>
    </section>
  );
};
