import { useCallback, useEffect, useRef, useState } from "react";
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
  defaultSaveMode?: "sale_only" | "catalog";
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
  defaultSaveMode = "sale_only",
}: PosQuickProductModalProps) => {
  useBodyScrollLock(open);
  const [saveMode, setSaveMode] = useState<SaveMode>(defaultSaveMode);
  const [saleMode, setSaleMode] = useState<"unit" | "weight">("unit");
  const [name, setName] = useState(initialName ?? "");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Referencias para navegación secuencial tipo Excel/POS
  const nameInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const saleModeSelectRef = useRef<HTMLSelectElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const modalBoxRef = useRef<HTMLDivElement>(null);

  type FormFieldElement = HTMLInputElement | HTMLSelectElement;

  const getOrderedFields = useCallback((): FormFieldElement[] => {
    if (saveMode === "catalog") {
      const items = [
        nameInputRef.current,
        categoryInputRef.current,
        saleModeSelectRef.current,
        barcodeInputRef.current,
        codeInputRef.current,
        quantityInputRef.current,
        unitPriceInputRef.current,
      ];
      return items.filter((el): el is FormFieldElement => el !== null);
    } else {
      const items = [
        nameInputRef.current,
        saleModeSelectRef.current,
        barcodeInputRef.current,
        quantityInputRef.current,
        unitPriceInputRef.current,
      ];
      return items.filter((el): el is FormFieldElement => el !== null);
    }
  }, [saveMode]);

  const focusField = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.focus();
    if (element instanceof HTMLInputElement) {
      element.select();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const cleanInitialBarcode = initialBarcode?.trim() ?? "";
    setSaveMode(defaultSaveMode);
    setSaleMode("unit");
    setName(initialName ?? "");
    setCategory("");
    setQuantity("1");
    setUnitPrice("");
    setCode("");
    setBarcode(cleanInitialBarcode);
    setIsSubmitting(false);
    setErrorMessage(null);
  }, [categories, defaultSaveMode, initialBarcode, initialName, open]);

  // Autofoco inicial en el primer campo (Nombre) al abrir modal
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      focusField(nameInputRef.current);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, focusField]);

  // Atajo global F2 para alternar modo mientras el modal esté abierto
  useEffect(() => {
    if (!open) return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        setSaveMode((prev) => (prev === "sale_only" ? "catalog" : "sale_only"));
        setErrorMessage(null);
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [open]);

  // Mantener foco seguro cuando se alterna de modo
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      const fields = getOrderedFields();
      if (!active || active === document.body || !fields.some((f) => f === active)) {
        focusField(nameInputRef.current);
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [saveMode, open, getOrderedFields, focusField]);

  const quantityLabel = saleMode === "weight" ? "Cantidad a vender (gramos)" : "Cantidad a vender";
  const priceLabel = saleMode === "weight" ? "Precio venta (por kg)" : "Precio venta";

  if (!open) return null;

  const buildInput = (): PosQuickProductInput => {
    const quantityValue = parsePositive(quantity);
    const normalizedQuantity = saleMode === "weight" ? gramsToKg(quantityValue) : quantityValue;
    const stockValue = normalizedQuantity > 0 ? normalizedQuantity : 1;

    return {
      name: name.trim(),
      category: saveMode === "sale_only" ? "Venta manual" : category.trim(),
      saleMode,
      quantity: normalizedQuantity,
      unitPrice: parsePositive(unitPrice),
      costPrice: 0,
      stock: stockValue,
      code: code.trim(),
      barcode: barcode.trim(),
      favorite: false,
    };
  };

  const submit = async () => {
    if (isSubmitting || disabled) return;

    if (!name.trim()) {
      setErrorMessage("Por favor ingresa el nombre del producto.");
      focusField(nameInputRef.current);
      return;
    }

    if (saveMode === "catalog" && !category.trim()) {
      setErrorMessage("Debes establecer una categoría para guardar el producto en el catálogo.");
      focusField(categoryInputRef.current);
      return;
    }

    const priceValue = parsePositive(unitPrice);
    if (priceValue <= 0) {
      setErrorMessage("Por favor ingresa un precio de venta mayor a 0.");
      focusField(unitPriceInputRef.current);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
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

  // Manejador centralizado de flujo por teclado:
  // - Enter: avanza a la siguiente celda y en la última celda finaliza / guarda
  // - Ctrl+Enter / Meta+Enter: finaliza directamente desde cualquier celda
  // - Esc: retrocede a la celda anterior; en la primera celda cierra el modal
  // - F2: alterna entre "Solo para esta venta" y "Guardar en el sistema"
  const handleModalKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "F2") {
      event.preventDefault();
      event.stopPropagation();
      setSaveMode((prev) => (prev === "sale_only" ? "catalog" : "sale_only"));
      setErrorMessage(null);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void submit();
      return;
    }

    if (event.key === "Enter") {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl?.tagName === "BUTTON") {
        return;
      }

      const fields = getOrderedFields();
      const currentIndex = activeEl ? fields.findIndex((f) => f === activeEl) : -1;

      if (currentIndex >= 0) {
        event.preventDefault();
        event.stopPropagation();

        if (currentIndex === fields.length - 1) {
          // Última celda -> Finalizar y agregar al carrito
          void submit();
        } else {
          // Avanzar a la siguiente celda
          focusField(fields[currentIndex + 1]);
        }
      }
      return;
    }

    if (event.key === "Escape") {
      const activeEl = document.activeElement as HTMLElement | null;
      const fields = getOrderedFields();
      const currentIndex = activeEl ? fields.findIndex((f) => f === activeEl) : -1;

      event.preventDefault();
      event.stopPropagation();

      if (currentIndex > 0) {
        // Retroceder a la celda anterior
        focusField(fields[currentIndex - 1]);
      } else {
        // Primera celda (Nombre) o fuera de celdas -> Cerrar modal
        onClose();
      }
      return;
    }
  };

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4">
      <button type="button" aria-label="Cerrar producto rapido" className="absolute inset-0" onClick={onClose} />
      <div
        ref={modalBoxRef}
        onKeyDown={handleModalKeyDown}
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title ?? "Agregar producto rapido"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle ?? "Carga lo minimo para resolver la venta sin salir del POS."}
            </p>
          </div>
          <ModalCloseButton label="Cerrar producto rápido" onClick={onClose} disabled={isSubmitting} />
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {/* Selector de Modo: Solo para esta venta vs Guardar en el catálogo */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors relative ${
                saveMode === "sale_only"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30 text-slate-900 dark:text-slate-100 ring-1 ring-blue-500/40"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="quick_product_save_mode"
                    className="mr-2 accent-blue-600"
                    checked={saveMode === "sale_only"}
                    onChange={() => {
                      setSaveMode("sale_only");
                      setErrorMessage(null);
                    }}
                  />
                  <span className="font-semibold">{saleOnlyLabel ?? "Solo para esta venta"}</span>
                </div>
                <kbd className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-2xs">
                  F2
                </kbd>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 font-normal pl-6">
                {saleOnlyDescription ?? "No se guarda en productos ni descuenta stock."}
              </span>
            </label>

            <label
              className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors relative ${
                saveMode === "catalog"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30 text-slate-900 dark:text-slate-100 ring-1 ring-blue-500/40"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="quick_product_save_mode"
                    className="mr-2 accent-blue-600"
                    checked={saveMode === "catalog"}
                    onChange={() => {
                      setSaveMode("catalog");
                      setErrorMessage(null);
                    }}
                  />
                  <span className="font-semibold">{catalogLabel ?? "Guardar en el sistema"}</span>
                </div>
                <kbd className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-2xs">
                  F2
                </kbd>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 font-normal pl-6">
                {catalogDescription ?? "Crea el producto y queda disponible para futuras ventas."}
              </span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Nombre del producto (ancho completo) */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Nombre <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrorMessage(null);
                }}
                className="ui-input"
                placeholder="Nombre del producto..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>

            {/* Categoría: SOLO visible en modo "Guardar en el sistema" */}
            {saveMode === "catalog" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Categoría <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={categoryInputRef}
                  list="pos-quick-product-categories"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Seleccionar o escribir categoría..."
                  className="ui-input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
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
            ) : null}

            {/* Tipo de venta */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de venta</label>
              <select
                ref={saleModeSelectRef}
                value={saleMode}
                onChange={(event) => setSaleMode(event.target.value as "unit" | "weight")}
                className="ui-input"
              >
                <option value="unit">Por unidad</option>
                <option value="weight">Pesable</option>
              </select>
            </div>

            {/* Códigos de barra e interno según el modo */}
            {saveMode === "sale_only" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Código de barras <span className="text-xs text-slate-400 font-normal dark:text-slate-400">(opcional)</span>
                </label>
                <input
                  ref={barcodeInputRef}
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
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Código de barras <span className="text-xs text-slate-400 font-normal dark:text-slate-400">(opcional)</span>
                  </label>
                  <input
                    ref={barcodeInputRef}
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Código interno <span className="text-xs text-slate-400 font-normal dark:text-slate-400">(opcional)</span>
                  </label>
                  <input
                    ref={codeInputRef}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    value={code}
                    placeholder="Opcional"
                    onChange={(event) => setCode(event.target.value)}
                    className="ui-input"
                  />
                </div>
              </>
            )}

            {/* Cantidad a vender */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{quantityLabel}</label>
              <input
                ref={quantityInputRef}
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
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>

            {/* Precio venta */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {priceLabel} <span className="text-rose-500">*</span>
              </label>
              <input
                ref={unitPriceInputRef}
                type="number"
                min="0.01"
                step="0.01"
                value={unitPrice}
                onChange={(event) => {
                  setUnitPrice(event.target.value);
                  setErrorMessage(null);
                }}
                onFocus={(e) =>
                  handleNumericInputFocus(e, {
                    isNew: unitPrice === "0" || unitPrice === "0.00",
                    onClear: () => setUnitPrice(""),
                  })
                }
                placeholder="0.00"
                className="ui-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  F2
                </kbd>
                <span>Modo</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Enter
                </kbd>
                <span>Avanzar / Finalizar</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Esc
                </kbd>
                <span>Atrás</span>
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                className="h-9 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                onClick={onClose}
                disabled={isSubmitting}
              >
                <span>Cancelar</span>
                <kbd className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1 py-0.2 text-[9px] font-bold text-slate-500 dark:text-slate-300">
                  Esc
                </kbd>
              </button>
              <button
                type="submit"
                className="h-9 px-5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-500 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                disabled={disabled || isSubmitting}
              >
                <span>{isSubmitting ? "Agregando..." : submitButtonText ?? "Agregar al carrito"}</span>
                <kbd className="rounded border border-fuchsia-400 bg-fuchsia-700/60 px-1 py-0.2 text-[9px] font-bold text-white">
                  Enter
                </kbd>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
