import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import {
  computePricingBackward,
  computePricingForward,
  DEFAULT_IVA_PERCENT,
} from "@/modules/productos/utils/product-pricing";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";

type CalcMode = "forward" | "backward";

interface ProductFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  product?: ProductViewModel | null;
  disabled?: boolean;
  categoryOptions: string[];
  subcategoryOptions: string[];
  onClose: () => void;
  onSubmit: (values: ProductFormModalValues) => Promise<void>;
}

const createBaseDefaults = (): ProductFormValues => ({
  nombre: "",
  codigoBarras: "",
  codigoProducto: "",
  stock: 0,
  categoria: "",
  subcategoria: "",
  precioCosto: 0,
  porcentajeGanancia: 0,
  precioSinIva: 0,
  porcentajeIva: DEFAULT_IVA_PERCENT,
  precioFinal: 0,
  imagenUrl: "",
});

const createDefaults = (): ProductFormModalValues => ({
  ...createBaseDefaults(),
  favorito: false,
  estadoActivo: true,
});

const productFormModalSchema = productFormSchema.extend({
  favorito: z.boolean(),
  estadoActivo: z.boolean(),
});

const normalizeToUniqueSorted = (values: string[]): string[] => {
  const seen = new Set<string>();
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return normalized.sort((a, b) => a.localeCompare(b));
};

const parseVoiceNumber = (value: string, fallback: number): number => {
  const replacements: Array<[RegExp, string]> = [
    [/\bcero\b/g, "0"],
    [/\buno\b/g, "1"],
    [/\bdos\b/g, "2"],
    [/\btres\b/g, "3"],
    [/\bcuatro\b/g, "4"],
    [/\bcinco\b/g, "5"],
    [/\bseis\b/g, "6"],
    [/\bsiete\b/g, "7"],
    [/\bocho\b/g, "8"],
    [/\bnueve\b/g, "9"],
    [/\bdiez\b/g, "10"],
    [/\bcoma\b/g, "."],
    [/\bpunto\b/g, "."],
  ];

  let normalized = value.toLowerCase();
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  const clean = normalized.replace(/[^\d,.-]/g, "").replace(/,/g, ".");

  if (!clean) return fallback;

  const parsed = Number(clean);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo leer la imagen"));
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen"));
    };

    reader.readAsDataURL(file);
  });
};

export const ProductFormModal = ({
  open,
  mode,
  product,
  disabled,
  categoryOptions,
  subcategoryOptions,
  onClose,
  onSubmit,
}: ProductFormModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormModalValues>({
    resolver: zodResolver(productFormModalSchema),
    defaultValues: createDefaults(),
  });

  const [calcMode, setCalcMode] = useState<CalcMode>("forward");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<string[]>(() => normalizeToUniqueSorted(categoryOptions));
  const [localSubcategories, setLocalSubcategories] = useState<string[]>(() =>
    normalizeToUniqueSorted(subcategoryOptions)
  );

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalCategories((current) => normalizeToUniqueSorted([...current, ...categoryOptions]));
  }, [categoryOptions]);

  useEffect(() => {
    setLocalSubcategories((current) => normalizeToUniqueSorted([...current, ...subcategoryOptions]));
  }, [subcategoryOptions]);

  useEffect(() => {
    if (!open) return;

    if (!product) {
      reset(createDefaults());
      setCalcMode("forward");
      setPhotoError(null);
      return;
    }

    reset({
      nombre: product.nombre,
      codigoBarras: product.codigoBarras,
      codigoProducto: product.codigoProducto,
      stock: product.stock,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      precioCosto: product.precioCosto,
      porcentajeGanancia: product.porcentajeGanancia,
      precioSinIva: product.precioSinIva,
      porcentajeIva: product.porcentajeIva,
      precioFinal: product.precioFinal,
      favorito: product.favorito,
      estadoActivo: product.activo,
      imagenUrl: product.imagenUrl,
    });
    setCalcMode("forward");
    setPhotoError(null);
  }, [open, product, reset]);

  const nombre = watch("nombre");
  const codigoBarras = watch("codigoBarras");
  const codigoProducto = watch("codigoProducto");
  const stock = watch("stock");
  const categoria = watch("categoria");
  const subcategoria = watch("subcategoria");
  const imagenUrl = watch("imagenUrl");

  const imagenPreview = useMemo(() => imagenUrl?.trim() ?? "", [imagenUrl]);

  const applyForwardPricing = () => {
    const values = getValues();
    const next = computePricingForward({
      precioCosto: values.precioCosto,
      porcentajeGanancia: values.porcentajeGanancia,
      porcentajeIva: values.porcentajeIva,
    });

    setValue("precioSinIva", next.precioSinIva, { shouldDirty: true, shouldValidate: true });
    setValue("precioFinal", next.precioFinal, { shouldDirty: true, shouldValidate: true });
    setValue("porcentajeGanancia", next.porcentajeGanancia, { shouldDirty: true, shouldValidate: true });
    setCalcMode("forward");
  };

  const applyBackwardPricing = () => {
    const values = getValues();
    const next = computePricingBackward({
      precioCosto: values.precioCosto,
      precioFinal: values.precioFinal,
      porcentajeIva: values.porcentajeIva,
    });

    setValue("precioSinIva", next.precioSinIva, { shouldDirty: true, shouldValidate: true });
    setValue("porcentajeGanancia", next.porcentajeGanancia, { shouldDirty: true, shouldValidate: true });
    setValue("precioFinal", next.precioFinal, { shouldDirty: true, shouldValidate: true });
    setCalcMode("backward");
  };

  const ensureCategory = (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    setLocalCategories((current) => normalizeToUniqueSorted([...current, clean]));
    setValue("categoria", clean, { shouldDirty: true, shouldValidate: true });
  };

  const ensureSubcategory = (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    setLocalSubcategories((current) => normalizeToUniqueSorted([...current, clean]));
    setValue("subcategoria", clean, { shouldDirty: true, shouldValidate: true });
  };

  const handleStockVoiceChange = (nextValue: string) => {
    const parsed = parseVoiceNumber(nextValue, Number(stock) || 0);
    setValue("stock", parsed, { shouldDirty: true, shouldValidate: true });
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setPhotoError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setValue("imagenUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo cargar la imagen";
      setPhotoError(message);
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const title = useMemo(
    () => (mode === "create" ? "Nuevo Producto" : "Editar Producto"),
    [mode]
  );

  const handleFormSubmit = async (values: ProductFormModalValues) => {
    const pricing =
      calcMode === "backward"
        ? computePricingBackward({
            precioCosto: values.precioCosto,
            precioFinal: values.precioFinal,
            porcentajeIva: values.porcentajeIva,
          })
        : computePricingForward({
            precioCosto: values.precioCosto,
            porcentajeGanancia: values.porcentajeGanancia,
            porcentajeIva: values.porcentajeIva,
          });

    await onSubmit({
      ...values,
      codigoBarras: values.codigoBarras?.trim() ?? "",
      codigoProducto: values.codigoProducto?.trim() ?? "",
      categoria: values.categoria?.trim() ?? "",
      subcategoria: values.subcategoria?.trim() ?? "",
      imagenUrl: values.imagenUrl?.trim() ?? "",
      precioSinIva: pricing.precioSinIva,
      precioFinal: pricing.precioFinal,
      porcentajeGanancia: pricing.porcentajeGanancia,
    });
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Completa los datos y el sistema recalcula precios al salir de cada campo.
            </p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
            Cerrar
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Nombre</label>
                <VoiceDictationButton
                  value={nombre ?? ""}
                  onValueChange={(nextValue) =>
                    setValue("nombre", nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                  insertMode="replace"
                  disabled={disabled}
                  label="Dictar nombre"
                />
              </div>
              <input {...register("nombre")} className="ui-input" disabled={disabled} />
              {errors.nombre ? <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p> : null}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Stock</label>
                <VoiceDictationButton
                  value={String(stock ?? "")}
                  onValueChange={handleStockVoiceChange}
                  insertMode="replace"
                  disabled={disabled}
                  label="Dictar stock"
                />
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.001"
                {...register("stock", {
                  setValueAs: (value) => {
                    if (typeof value === "number") return value;
                    const parsed = Number(String(value ?? "").replace(",", "."));
                    return Number.isFinite(parsed) ? parsed : 0;
                  },
                })}
                className="ui-input"
                disabled={disabled}
              />
              {errors.stock ? <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p> : null}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Código de barras</label>
                <div className="flex items-center gap-1">
                  <VoiceDictationButton
                    value={codigoBarras ?? ""}
                    onValueChange={(nextValue) =>
                      setValue("codigoBarras", nextValue.replace(/\s+/g, ""), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    insertMode="replace"
                    disabled={disabled}
                    label="Dictar código de barras"
                  />
                  <button
                    type="button"
                    className="ui-btn-ghost px-2 py-1 text-xs"
                    onClick={() => setScannerOpen(true)}
                    disabled={disabled}
                  >
                    Escanear cámara
                  </button>
                </div>
              </div>
              <input {...register("codigoBarras")} className="ui-input" disabled={disabled} />
              {errors.codigoBarras ? (
                <p className="mt-1 text-xs text-red-600">{errors.codigoBarras.message}</p>
              ) : null}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Código de producto</label>
                <VoiceDictationButton
                  value={codigoProducto ?? ""}
                  onValueChange={(nextValue) =>
                    setValue("codigoProducto", nextValue.replace(/\s+/g, ""), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  insertMode="replace"
                  disabled={disabled}
                  label="Dictar código de producto"
                />
              </div>
              <input {...register("codigoProducto")} className="ui-input" disabled={disabled} />
              {errors.codigoProducto ? (
                <p className="mt-1 text-xs text-red-600">{errors.codigoProducto.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
              <div className="flex items-center gap-2">
                <input
                  list="categorias-productos"
                  {...register("categoria", {
                    onBlur: (event) => ensureCategory(event.target.value),
                  })}
                  className="ui-input"
                  disabled={disabled}
                  placeholder="Buscar o crear categoría"
                />
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => ensureCategory(categoria ?? "")}
                  disabled={disabled || !categoria?.trim()}
                >
                  Crear
                </button>
              </div>
              <datalist id="categorias-productos">
                {localCategories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {errors.categoria ? <p className="mt-1 text-xs text-red-600">{errors.categoria.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subcategoría</label>
              <div className="flex items-center gap-2">
                <input
                  list="subcategorias-productos"
                  {...register("subcategoria", {
                    onBlur: (event) => ensureSubcategory(event.target.value),
                  })}
                  className="ui-input"
                  disabled={disabled}
                  placeholder="Buscar o crear subcategoría"
                />
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => ensureSubcategory(subcategoria ?? "")}
                  disabled={disabled || !subcategoria?.trim()}
                >
                  Crear
                </button>
              </div>
              <datalist id="subcategorias-productos">
                {localSubcategories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {errors.subcategoria ? (
                <p className="mt-1 text-xs text-red-600">{errors.subcategoria.message}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Foto del producto</h4>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageChange}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={disabled}
                >
                  Cargar / sacar foto
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => setValue("imagenUrl", "", { shouldDirty: true, shouldValidate: true })}
                  disabled={disabled || !imagenPreview}
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                {imagenPreview ? (
                  <img src={imagenPreview} alt="Foto del producto" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-xs text-slate-500">Sin foto</span>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  URL / referencia de imagen
                </label>
                <input
                  {...register("imagenUrl")}
                  className="ui-input"
                  disabled={disabled}
                  placeholder="https://... o referencia"
                />
                <p className="text-xs text-slate-500">
                  Puedes pegar una URL manual o cargar una foto desde archivo/cámara.
                </p>
                {photoError ? <p className="text-xs text-red-600">{photoError}</p> : null}
                {errors.imagenUrl ? <p className="text-xs text-red-600">{errors.imagenUrl.message}</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Precios y cálculo</h4>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio de costo</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioCosto", {
                    onBlur: () => applyForwardPricing(),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.precioCosto ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioCosto.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">% Ganancia</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("porcentajeGanancia", {
                    onBlur: () => applyForwardPricing(),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeGanancia ? (
                  <p className="mt-1 text-xs text-red-600">{errors.porcentajeGanancia.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio sin IVA</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioSinIva")}
                  readOnly
                  className="ui-input bg-slate-100"
                  disabled={disabled}
                />
                {errors.precioSinIva ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioSinIva.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">% IVA</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("porcentajeIva", {
                    onBlur: () => applyForwardPricing(),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeIva ? (
                  <p className="mt-1 text-xs text-red-600">{errors.porcentajeIva.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio final</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioFinal", {
                    onBlur: () => applyBackwardPricing(),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.precioFinal ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioFinal.message}</p>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Si editas el precio final, se recalcula la ganancia de forma inversa. Si el costo es 0, se evita dividir por cero.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" {...register("favorito")} disabled={disabled} />
              Marcar como favorito para POS
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" {...register("estadoActivo")} disabled={disabled} />
              Producto activo
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
              Cancelar
            </button>
            <button type="submit" className="ui-btn-primary" disabled={disabled}>
              {mode === "create" ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        title="Escanear código de barras del producto"
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          setValue("codigoBarras", barcode, { shouldDirty: true, shouldValidate: true });
          setScannerOpen(false);
        }}
      />
    </section>
  );
};

