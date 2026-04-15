import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import { ProductImageEditorModal } from "@/modules/productos/components/ProductImageEditorModal";
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
  imagenFile: null,
  imagenEliminada: false,
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

const collapseSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

const replaceSpokenNumbers = (value: string): string => {
  const replacements: Array<[RegExp, string]> = [
    [/\bcero\b/gi, "0"],
    [/\buno\b/gi, "1"],
    [/\bdos\b/gi, "2"],
    [/\btres\b/gi, "3"],
    [/\bcuatro\b/gi, "4"],
    [/\bcinco\b/gi, "5"],
    [/\bseis\b/gi, "6"],
    [/\bsiete\b/gi, "7"],
    [/\bocho\b/gi, "8"],
    [/\bnueve\b/gi, "9"],
    [/\bdiez\b/gi, "10"],
    [/\bcoma\b/gi, "."],
    [/\bpunto\b/gi, "."],
  ];

  let normalized = value;
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
};

const normalizeVoiceName = (value: string): string => collapseSpaces(value);

const normalizeVoiceBarcode = (value: string): string => {
  const normalized = replaceSpokenNumbers(value);
  return normalized.replace(/\D/g, "");
};

const normalizeVoiceProductCode = (value: string): string => {
  const normalized = replaceSpokenNumbers(value).toUpperCase();
  return normalized.replace(/[^A-Z0-9-_]/g, "").slice(0, 80);
};

const parseVoiceNumber = (value: string, fallback: number): number => {
  const normalized = replaceSpokenNumbers(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/,/g, ".");

  if (!normalized) return fallback;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
};

const parseNumericField = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");

  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;

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
  const [imageEditorSource, setImageEditorSource] = useState<string | null>(null);
  const [imageDraftFile, setImageDraftFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<string[]>(() => normalizeToUniqueSorted(categoryOptions));
  const [localSubcategories, setLocalSubcategories] = useState<string[]>(() =>
    normalizeToUniqueSorted(subcategoryOptions)
  );

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!localPreviewUrl?.startsWith("blob:")) return undefined;

    return () => {
      URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (open) return;
    setImageEditorSource(null);
    setImageDraftFile(null);
    setImageRemoved(false);
    setLocalPreviewUrl(null);
  }, [open]);

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
      setImageEditorSource(null);
      setImageDraftFile(null);
      setImageRemoved(false);
      setLocalPreviewUrl(null);
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
      imagenFile: null,
      imagenEliminada: false,
    });
    setCalcMode("forward");
    setPhotoError(null);
    setImageEditorSource(null);
    setImageDraftFile(null);
    setImageRemoved(false);
    setLocalPreviewUrl(null);
  }, [open, product, reset]);

  const nombre = watch("nombre");
  const codigoBarras = watch("codigoBarras");
  const codigoProducto = watch("codigoProducto");
  const stock = watch("stock");
  const categoria = watch("categoria");
  const subcategoria = watch("subcategoria");
  const imagenUrl = watch("imagenUrl");
  const precioCosto = watch("precioCosto");
  const porcentajeGanancia = watch("porcentajeGanancia");
  const porcentajeIva = watch("porcentajeIva");
  const precioFinal = watch("precioFinal");

  const imagenPreview = useMemo(() => {
    if (localPreviewUrl) return localPreviewUrl;
    return imagenUrl?.trim() ?? "";
  }, [imagenUrl, localPreviewUrl]);

  useEffect(() => {
    if (!open) return;

    const setIfChanged = (
      field: "precioSinIva" | "precioFinal" | "porcentajeGanancia",
      nextValue: number
    ) => {
      const current = Number(getValues(field));
      if (Math.abs(current - nextValue) < 0.005) return;

      setValue(field, nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };

    if (calcMode === "backward") {
      const backward = computePricingBackward({
        precioCosto,
        precioFinal,
        porcentajeIva,
      });

      setIfChanged("precioSinIva", backward.precioSinIva);
      setIfChanged("porcentajeGanancia", backward.porcentajeGanancia);
      return;
    }

    const forward = computePricingForward({
      precioCosto,
      porcentajeGanancia,
      porcentajeIva,
    });

    setIfChanged("precioSinIva", forward.precioSinIva);
    setIfChanged("precioFinal", forward.precioFinal);
  }, [
    calcMode,
    getValues,
    open,
    porcentajeGanancia,
    porcentajeIva,
    precioCosto,
    precioFinal,
    setValue,
  ]);

  const applyForwardPricing = () => {
    setCalcMode("forward");
    const values = getValues();
    const next = computePricingForward({
      precioCosto: values.precioCosto,
      porcentajeGanancia: values.porcentajeGanancia,
      porcentajeIva: values.porcentajeIva,
    });

    setValue("precioSinIva", next.precioSinIva, { shouldDirty: true, shouldValidate: true });
    setValue("precioFinal", next.precioFinal, { shouldDirty: true, shouldValidate: true });
  };

  const applyBackwardPricing = () => {
    setCalcMode("backward");
    const values = getValues();
    const next = computePricingBackward({
      precioCosto: values.precioCosto,
      precioFinal: values.precioFinal,
      porcentajeIva: values.porcentajeIva,
    });

    setValue("precioSinIva", next.precioSinIva, { shouldDirty: true, shouldValidate: true });
    setValue("porcentajeGanancia", next.porcentajeGanancia, { shouldDirty: true, shouldValidate: true });
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

  const handleImagePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setPhotoError(null);

    try {
      const source = await readFileAsDataUrl(file);
      setImageEditorSource(source);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo cargar la imagen";
      setPhotoError(message);
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleRemovePhoto = () => {
    setImageDraftFile(null);
    setImageRemoved(Boolean(imagenPreview || product?.imagenUrl));
    setLocalPreviewUrl(null);
    setValue("imagenUrl", "", { shouldDirty: true, shouldValidate: true });
  };

  const handlePreventEnterSubmit = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;

    const target = event.target;
    if (target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLButtonElement && target.type === "submit") return;

    event.preventDefault();
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
      imagenFile: imageDraftFile,
      imagenEliminada: imageRemoved,
    });
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Cálculo automático en vivo. Guardado solo con el botón "Guardar".
            </p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
            Cerrar
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)} onKeyDown={handlePreventEnterSubmit}>
          <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">Nombre</label>
                    <VoiceDictationButton
                      value={nombre ?? ""}
                      onValueChange={(nextValue) =>
                        setValue("nombre", normalizeVoiceName(nextValue), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
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
                      setValueAs: parseNumericField,
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
                          setValue("codigoBarras", normalizeVoiceBarcode(nextValue), {
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
                  <input
                    {...register("codigoBarras", {
                      setValueAs: (value) => normalizeVoiceBarcode(String(value ?? "")),
                    })}
                    className="ui-input"
                    disabled={disabled}
                  />
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
                        setValue("codigoProducto", normalizeVoiceProductCode(nextValue), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      insertMode="replace"
                      disabled={disabled}
                      label="Dictar código de producto"
                    />
                  </div>
                  <input
                    {...register("codigoProducto", {
                      setValueAs: (value) => normalizeVoiceProductCode(String(value ?? "")),
                    })}
                    className="ui-input"
                    disabled={disabled}
                  />
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
            </div>

            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Fotografía</h4>
              <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                {imagenPreview ? (
                  <img src={imagenPreview} alt="Foto del producto" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-3 text-center text-xs text-slate-500">Sin imagen</span>
                )}
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImagePick}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ui-btn-ghost w-full justify-center px-2 py-1 text-xs"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={disabled}
                >
                  Editar foto
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost w-full justify-center px-2 py-1 text-xs"
                  onClick={handleRemovePhoto}
                  disabled={disabled || !imagenPreview}
                >
                  Eliminar foto
                </button>
              </div>

              {photoError ? <p className="mt-2 text-xs text-red-600">{photoError}</p> : null}
            </aside>
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
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("forward"),
                    onBlur: applyForwardPricing,
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
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("forward"),
                    onBlur: applyForwardPricing,
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
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("forward"),
                    onBlur: applyForwardPricing,
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
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("backward"),
                    onBlur: applyBackwardPricing,
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
              El cálculo se actualiza automáticamente al escribir y al salir de cada campo.
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

      <ProductImageEditorModal
        open={Boolean(imageEditorSource)}
        sourceUrl={imageEditorSource}
        disabled={disabled}
        onClose={() => setImageEditorSource(null)}
        onConfirm={({ file, previewUrl }) => {
          setImageEditorSource(null);
          setImageDraftFile(file);
          setImageRemoved(false);
          setLocalPreviewUrl(previewUrl);
          setValue("imagenUrl", previewUrl, { shouldDirty: true, shouldValidate: true });
          setPhotoError(null);
        }}
      />

      <BarcodeScannerModal
        open={scannerOpen}
        title="Escanear código de barras del producto"
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          setValue("codigoBarras", normalizeVoiceBarcode(barcode), {
            shouldDirty: true,
            shouldValidate: true,
          });
          setScannerOpen(false);
        }}
      />
    </section>
  );
};
