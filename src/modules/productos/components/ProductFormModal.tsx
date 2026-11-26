import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ProductImageEditorModal } from "@/modules/productos/components/ProductImageEditorModal";
import { ReturnablePackagesModal } from "@/modules/productos/components/ReturnablePackagesModal";
import { Camera, Check, Package, Sparkles } from "lucide-react";
import { masterProductsService, type MasterProduct } from "@/services/master-products.service";
import { settingsService } from "@/services/settings.service";
import type { StoreCatalogList } from "@/types/entities";
import {
  computePricingForward,
  computePricingReverse,
  DEFAULT_IVA_PERCENT,
} from "@/modules/productos/utils/product-pricing";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";
import { parseReturnableConfig, useTenantReturnablePackages } from "@/utils/returnable-packages";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { isStockTrackingEnabled } from "@/utils/stock-tracking";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";
import { useProductsStore } from "@/features/products/store/products.store";
import { cn } from "@/utils/cn";
import {
  replaceSpokenSpanishNumbers,
  deduplicateRepeatedPhrases,
  convertSpokenBarcode,
  convertSpokenProductCode,
} from "@/features/voice/utils/voice-normalizer";

type CalcMode = "forward" | "reverse";

interface ProductFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  product?: ProductViewModel | null;
  disabled?: boolean;
  categoryOptions: string[];
  subcategoryOptions: string[];
  initialBarcode?: string | null;
  initialName?: string | null;
  initialValues?: Partial<ProductFormModalValues> | null;
  onClose: () => void;
  onSubmit: (values: ProductFormModalValues) => Promise<void>;
}

const createBaseDefaults = (): ProductFormValues => ({
  nombre: "",
  saleMode: "unit",
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
  isReturnable: false,
  returnablePackageName: "",
  returnablePackagePrice: 0,
  trackStock: true,
  publicadoWeb: true,
  destacadoWeb: false,
});

const createDefaults = (): ProductFormModalValues => ({
  ...createBaseDefaults(),
  favorito: false,
  trackStock: true,
  estadoActivo: true,
  publicadoWeb: true,
  destacadoWeb: false,
  imagenFile: null,
  imagenEliminada: false,
});

const productFormModalSchema = productFormSchema.extend({
  favorito: z.boolean().optional().default(false),
  trackStock: z.boolean().default(true),
  estadoActivo: z.boolean(),
  publicadoWeb: z.boolean().default(true),
  destacadoWeb: z.boolean().default(false),
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
  return replaceSpokenSpanishNumbers(value);
};

const normalizeVoiceName = (value: string): string => {
  const deduplicated = deduplicateRepeatedPhrases(value);
  return collapseSpaces(deduplicated);
};

const normalizeVoiceBarcode = (value: string): string => {
  return convertSpokenBarcode(value);
};

const normalizeVoiceProductCode = (value: string): string => {
  return convertSpokenProductCode(value);
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
  initialBarcode,
  initialName,
  initialValues,
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
    setError,
    formState: { errors },
  } = useForm<ProductFormModalValues>({
    resolver: zodResolver(productFormModalSchema),
    defaultValues: createDefaults(),
  });

  useBodyScrollLock(open);

  const [calcMode, setCalcMode] = useState<CalcMode>("forward");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [imageEditorSource, setImageEditorSource] = useState<string | null>(null);
  const [imageDraftFile, setImageDraftFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isPackagesManagerOpen, setIsPackagesManagerOpen] = useState(false);
  const [isCustomPackageMode, setIsCustomPackageMode] = useState(false);
  const [customPackageInput, setCustomPackageInput] = useState("");
  const [masterMatch, setMasterMatch] = useState<MasterProduct | null>(null);
  const [localCategories, setLocalCategories] = useState<string[]>(() =>
    normalizeToUniqueSorted([...categoryOptions, ...masterProductsService.getDefaultCategories()])
  );
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
    setMasterMatch(null);
    reset(createDefaults());
  }, [open, reset]);

  useEffect(() => {
    setLocalCategories((current) =>
      normalizeToUniqueSorted([...current, ...categoryOptions, ...masterProductsService.getDefaultCategories()])
    );
  }, [categoryOptions]);

  useEffect(() => {
    setLocalSubcategories((current) => normalizeToUniqueSorted([...current, ...subcategoryOptions]));
  }, [subcategoryOptions]);

  useEffect(() => {
    if (!open) return;

    if (!product) {
      const initSaleMode = initialValues?.saleMode ?? "unit";
      const isInitWeight = initSaleMode === "weight";
      const initStock = initialValues?.stock != null
        ? (isInitWeight ? Number((initialValues.stock * 1000).toFixed(3)) : initialValues.stock)
        : 0;

      reset({
        ...createDefaults(),
        ...(initialValues ?? {}),
        stock: initStock,
        codigoBarras: initialBarcode ? initialBarcode.trim() : (initialValues?.codigoBarras ?? ""),
        nombre: initialName ? initialName.trim() : (initialValues?.nombre ?? ""),
        categoria: initialValues?.categoria ?? "",
        subcategoria: initialValues?.subcategoria ?? "",
      });
      setCalcMode("forward");
      setPhotoError(null);
      setImageEditorSource(null);
      setImageDraftFile(null);
      setImageRemoved(false);
      setLocalPreviewUrl(null);
      return;
    }

    const returnableConfig = parseReturnableConfig(product.entity?.description);
    const isWeight = (product.saleMode ?? product.entity?.sale_mode) === "weight";
    const initialStock = isWeight
      ? Number(((product.stock ?? product.entity?.stock_current ?? 0) * 1000).toFixed(3))
      : (product.stock ?? 0);

    reset({
      nombre: product.nombre,
      saleMode: product.saleMode,
      codigoBarras: product.codigoBarras,
      codigoProducto: product.codigoProducto,
      stock: initialStock,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      precioCosto: product.precioCosto,
      porcentajeGanancia: product.porcentajeGanancia,
      precioSinIva: product.precioSinIva,
      porcentajeIva: product.porcentajeIva,
      precioFinal: product.precioFinal,
      favorito: product.favorito,
      trackStock: isStockTrackingEnabled(product.entity?.description),
      estadoActivo: product.activo,
      publicadoWeb: product.publicadoWeb ?? true,
      destacadoWeb: product.destacadoWeb ?? false,
      imagenUrl: product.imagenUrl,
      imagenFile: null,
      imagenEliminada: false,
      isReturnable: returnableConfig?.enabled ?? false,
      returnablePackageName: returnableConfig?.packageName ?? "",
      returnablePackagePrice: returnableConfig?.packagePrice ?? 0,
    });
    setCalcMode("forward");
    setPhotoError(null);
    setImageEditorSource(null);
    setImageDraftFile(null);
    setImageRemoved(false);
    setLocalPreviewUrl(null);
  }, [open, product, reset, initialBarcode, initialName, initialValues]);

  const nombre = watch("nombre");
  const saleMode = watch("saleMode");
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
  const isReturnable = watch("isReturnable");
  const { tenantId } = useTenant();
  const { packages: tenantPackages } = useTenantReturnablePackages(tenantId);
  const [storeCustomLists, setStoreCustomLists] = useState<StoreCatalogList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const productId = product?.entity?.id;
    if (!open || !tenantId || mode !== "edit" || !productId) {
      setStoreCustomLists([]);
      setSelectedListIds([]);
      return;
    }
    void settingsService.getByTenant(tenantId).then((res) => {
      if (!active) return;
      const lists = res.tienda?.custom_lists ?? [];
      setStoreCustomLists(lists);
      setSelectedListIds(
        lists.filter((l) => l.product_ids.includes(productId)).map((l) => l.id)
      );
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [open, tenantId, mode, product?.entity?.id]);

  const imagenPreview = useMemo(() => {
    if (localPreviewUrl) return localPreviewUrl;
    return imagenUrl?.trim() ?? "";
  }, [imagenUrl, localPreviewUrl]);

  const trimmedCategory = (categoria ?? "").trim();
  const isCategoryCreated = useMemo(() => {
    if (!trimmedCategory) return null;
    return categoryOptions.some(
      (opt) => opt.trim().toLowerCase() === trimmedCategory.toLowerCase()
    );
  }, [categoryOptions, trimmedCategory]);

  const trimmedSubcategory = (subcategoria ?? "").trim();
  const isSubcategoryCreated = useMemo(() => {
    if (!trimmedSubcategory) return null;
    return subcategoryOptions.some(
      (opt) => opt.trim().toLowerCase() === trimmedSubcategory.toLowerCase()
    );
  }, [subcategoryOptions, trimmedSubcategory]);

  const catalogProducts = useProductsStore((state) => state.products);
  const catalogBarcodes = useProductsStore((state) => state.allBarcodes);
  const currentProductId = mode === "edit" ? product?.entity.id : null;

  const duplicateCodeProduct = useMemo(() => {
    const cleanCode = (codigoProducto ?? "").trim().toUpperCase();
    if (!cleanCode) return null;
    return (
      catalogProducts.find(
        (p) => p.id !== currentProductId && p.code && p.code.trim().toUpperCase() === cleanCode
      ) ?? null
    );
  }, [catalogProducts, codigoProducto, currentProductId]);

  const duplicateBarcodeProduct = useMemo(() => {
    const cleanBarcode = normalizeVoiceBarcode(codigoBarras ?? "");
    if (!cleanBarcode) return null;

    const barcodeRow = catalogBarcodes.find(
      (row) => row.product_id !== currentProductId && normalizeVoiceBarcode(row.barcode) === cleanBarcode
    );
    if (barcodeRow) {
      return catalogProducts.find((p) => p.id === barcodeRow.product_id) ?? null;
    }
    const productWithCode = catalogProducts.find(
      (p) => p.id !== currentProductId && p.code && p.code.trim().toUpperCase() === cleanBarcode.toUpperCase()
    );
    return productWithCode ?? null;
  }, [catalogBarcodes, catalogProducts, codigoBarras, currentProductId]);

  // Búsqueda inteligente en Catálogo Maestro Global al ingresar código de barras en alta
  useEffect(() => {
    if (!open || mode !== "create") return;
    const clean = normalizeVoiceBarcode(codigoBarras ?? "");
    if (!clean || clean.length < 6) {
      setMasterMatch(null);
      return;
    }

    let isMounted = true;
    masterProductsService.getByBarcode(clean).then((found) => {
      if (!isMounted) return;
      setMasterMatch(found);
      if (found) {
        const currentNombre = getValues("nombre")?.trim() ?? "";
        if (!currentNombre) {
          setValue("nombre", found.name, { shouldDirty: true, shouldValidate: true });
        }
        const currentCat = getValues("categoria")?.trim() ?? "";
        if (!currentCat && found.category) {
          setValue("categoria", found.category, { shouldDirty: true, shouldValidate: true });
          setLocalCategories((prev) => normalizeToUniqueSorted([...prev, found.category]));
        }
        const currentSub = getValues("subcategoria")?.trim() ?? "";
        if (!currentSub && found.subcategory) {
          setValue("subcategoria", found.subcategory, { shouldDirty: true, shouldValidate: true });
          setLocalSubcategories((prev) => normalizeToUniqueSorted([...prev, found.subcategory || ""]));
        }
        const currentImg = getValues("imagenUrl")?.trim() ?? "";
        if (!currentImg && found.image_url) {
          setValue("imagenUrl", found.image_url, { shouldDirty: true, shouldValidate: true });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [codigoBarras, mode, open, getValues, setValue]);

  useEffect(() => {
    if (!open) return;

    const setIfChanged = (
      field: "precioSinIva" | "precioFinal" | "porcentajeGanancia" | "precioCosto",
      nextValue: number
    ) => {
      const current = Number(getValues(field));
      if (Math.abs(current - nextValue) < 0.005) return;

      setValue(field, nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };

    if (calcMode === "reverse") {
      const reverse = computePricingReverse({
        precioFinal,
        porcentajeGanancia,
        porcentajeIva,
      });

      setIfChanged("precioSinIva", reverse.precioSinIva);
      setIfChanged("precioCosto", reverse.precioCosto);
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

  const applyReversePricing = () => {
    setCalcMode("reverse");
    const values = getValues();
    const next = computePricingReverse({
      precioFinal: values.precioFinal,
      porcentajeGanancia: values.porcentajeGanancia,
      porcentajeIva: values.porcentajeIva,
    });

    setValue("precioSinIva", next.precioSinIva, { shouldDirty: true, shouldValidate: true });
    setValue("precioCosto", next.precioCosto, { shouldDirty: true, shouldValidate: true });
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
    if (duplicateCodeProduct) {
      setError("codigoProducto", {
        type: "manual",
        message: `El código ya está asignado al producto "${duplicateCodeProduct.name}"`,
      });
      return;
    }

    if (duplicateBarcodeProduct) {
      setError("codigoBarras", {
        type: "manual",
        message: `El código de barras ya está asignado al producto "${duplicateBarcodeProduct.name}"`,
      });
      return;
    }

    let precioCosto = values.precioCosto;
    let precioSinIva = 0;
    let precioFinal = values.precioFinal;
    let porcentajeGanancia = values.porcentajeGanancia;

    if (calcMode === "reverse") {
      const reverse = computePricingReverse({
        precioFinal: values.precioFinal,
        porcentajeGanancia: values.porcentajeGanancia,
        porcentajeIva: values.porcentajeIva,
      });
      precioCosto = reverse.precioCosto;
      precioSinIva = reverse.precioSinIva;
      precioFinal = reverse.precioFinal;
      porcentajeGanancia = reverse.porcentajeGanancia;
    } else {
      const forward = computePricingForward({
        precioCosto: values.precioCosto,
        porcentajeGanancia: values.porcentajeGanancia,
        porcentajeIva: values.porcentajeIva,
      });
      precioSinIva = forward.precioSinIva;
      precioFinal = forward.precioFinal;
      porcentajeGanancia = forward.porcentajeGanancia;
    }

    const isWeight = values.saleMode === "weight";
    const stockToSubmit = isWeight ? Number((values.stock / 1000).toFixed(4)) : values.stock;

    await onSubmit({
      ...values,
      stock: stockToSubmit,
      saleMode: values.saleMode,
      codigoBarras: values.codigoBarras?.trim() ?? "",
      codigoProducto: values.codigoProducto?.trim() ?? "",
      categoria: values.categoria?.trim() ?? "",
      subcategoria: values.subcategoria?.trim() ?? "",
      imagenUrl: values.imagenUrl?.trim() ?? "",
      precioCosto,
      precioSinIva,
      precioFinal,
      porcentajeGanancia,
      imagenFile: imageDraftFile,
      imagenEliminada: imageRemoved,
    });

    const editedProductId = product?.entity?.id;
    if (mode === "edit" && editedProductId && tenantId && storeCustomLists.length > 0) {
      const nextLists = storeCustomLists.map((list) => {
        const shouldInclude = selectedListIds.includes(list.id);
        const alreadyIncludes = list.product_ids.includes(editedProductId);
        if (shouldInclude && !alreadyIncludes) {
          return { ...list, product_ids: [...list.product_ids, editedProductId] };
        }
        if (!shouldInclude && alreadyIncludes) {
          return { ...list, product_ids: list.product_ids.filter((id) => id !== editedProductId) };
        }
        return list;
      });
      void settingsService.updateSection(tenantId, "tienda", { custom_lists: nextLists }).catch(() => {});
    }

    // Retroalimentar el Catálogo Maestro Global de forma colaborativa y no bloqueante
    if (values.codigoBarras?.trim() && values.nombre?.trim() && values.categoria?.trim()) {
      void masterProductsService.contribute({
        barcode: values.codigoBarras.trim(),
        name: values.nombre.trim(),
        category: values.categoria.trim(),
        subcategory: values.subcategoria?.trim(),
      });
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4 backdrop-blur-[1px] overflow-hidden">
      <div className="flex flex-col max-h-[92dvh] sm:max-h-[90vh] w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900 min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 sm:px-5 py-3.5 sm:py-4 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase truncate">
              <span className="text-slate-400 dark:text-slate-500">INVENTARIO</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">GESTIÓN DE PRODUCTOS</span>
            </div>
            <h3 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">{title}</h3>
          </div>
          <ModalCloseButton label="Cerrar producto" onClick={onClose} disabled={disabled} />
        </div>

        <form className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden" onSubmit={handleSubmit(handleFormSubmit)} onKeyDown={handlePreventEnterSubmit} autoComplete="off">
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            <div className="min-w-0 grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-4 sm:space-y-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-slate-50/70 p-3.5 sm:p-5 dark:border-slate-800 dark:bg-slate-950/40 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Datos básicos</h4>
                </div>
                <div className="min-w-0 grid gap-3.5 sm:gap-4 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 sm:grid-cols-2 dark:border-slate-700/80 dark:bg-slate-900 shadow-xs overflow-hidden">
                  <div className="min-w-0">
                    <div className="mb-1 flex min-h-[34px] items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre</label>
                      <div className="shrink-0">
                        <VoiceDictationButton
                          value={nombre ?? ""}
                          onValueChange={(nextValue) =>
                            setValue("nombre", normalizeVoiceName(nextValue), {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          insertMode="replace"
                          fieldType="text"
                          disabled={disabled}
                          label="Dictar nombre"
                        />
                      </div>
                    </div>
                    <input
                      {...register("nombre")}
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-form-type="other"
                      className="ui-input"
                      disabled={disabled}
                    />
                    {errors.nombre ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nombre.message}</p> : null}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex min-h-[34px] items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        {saleMode === "weight" ? "Stock en gramos (g)" : "Stock (unidades)"}
                      </label>
                      <div className="shrink-0">
                        <VoiceDictationButton
                          value={String(stock ?? "")}
                          onValueChange={handleStockVoiceChange}
                          insertMode="replace"
                          fieldType="number"
                          disabled={disabled}
                          label="Dictar stock"
                        />
                      </div>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={saleMode === "weight" ? "1" : "0.001"}
                      placeholder="0"
                      {...register("stock", {
                        setValueAs: parseNumericField,
                      })}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: mode === "create",
                          onClear: () => setValue("stock", "" as any),
                        })
                      }
                      onBlur={(e) => {
                        handleNumericInputBlur(e, "0", () => {
                          setValue("stock", 0);
                        });
                      }}
                      className="ui-input"
                      disabled={disabled}
                    />
                    {errors.stock ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.stock.message}</p> : null}
                  </div>

                  <div className="min-w-0 sm:col-span-2">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tipo de venta</label>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl sm:rounded-2xl border p-3 text-sm transition-all shadow-2xs",
                        saleMode === "unit"
                          ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
                          : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      )}>
                        <input
                          type="radio"
                          value="unit"
                          {...register("saleMode")}
                          disabled={disabled}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Por unidad</span>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl sm:rounded-2xl border p-3 text-sm transition-all shadow-2xs",
                        saleMode === "weight"
                          ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
                          : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      )}>
                        <input
                          type="radio"
                          value="weight"
                          {...register("saleMode")}
                          disabled={disabled}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Pesable (por kg)</span>
                      </label>
                    </div>
                  </div>

                <div className="min-w-0">
                  <label className="mb-1 block text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">
                    Código de barras
                  </label>
                  <div className="mb-1 flex h-8 items-center gap-1">
                    <div className="shrink-0">
                      <VoiceDictationButton
                        value={codigoBarras ?? ""}
                        onValueChange={(nextValue) =>
                          setValue("codigoBarras", normalizeVoiceBarcode(nextValue), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        insertMode="replace"
                        fieldType="barcode"
                        disabled={disabled}
                        label="Dictar código de barras"
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 sm:w-auto items-center justify-center gap-1.5 rounded-full border border-slate-200/90 bg-white p-0 sm:px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 transition-all shrink-0"
                      onClick={() => setScannerOpen(true)}
                      disabled={disabled}
                      title="Escanear código de barras con la cámara"
                      aria-label="Escanear código de barras con la cámara"
                    >
                      <Camera className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span className="hidden sm:inline">Escanear cámara</span>
                    </button>
                  </div>
                  <input
                    {...register("codigoBarras", {
                      setValueAs: (value) => normalizeVoiceBarcode(String(value ?? "")),
                    })}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    className={cn(
                      "ui-input",
                      (errors.codigoBarras || duplicateBarcodeProduct) &&
                        "border-red-500 focus:border-red-500 dark:border-red-500"
                    )}
                    disabled={disabled}
                  />
                  {errors.codigoBarras ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.codigoBarras.message}</p>
                  ) : duplicateBarcodeProduct ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Ya existe un producto con este código de barras ("{duplicateBarcodeProduct.name}")
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <label className="mb-1 block text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">
                    Código de producto
                  </label>
                  <div className="mb-1 flex h-8 items-center justify-start">
                    <div className="shrink-0">
                      <VoiceDictationButton
                        value={codigoProducto ?? ""}
                        onValueChange={(nextValue) =>
                          setValue("codigoProducto", normalizeVoiceProductCode(nextValue), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        insertMode="replace"
                        fieldType="code"
                        disabled={disabled}
                        label="Dictar código de producto"
                      />
                    </div>
                  </div>
                  <input
                    {...register("codigoProducto", {
                      setValueAs: (value) => normalizeVoiceProductCode(String(value ?? "")),
                    })}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    className={cn(
                      "ui-input",
                      (errors.codigoProducto || duplicateCodeProduct) &&
                        "border-red-500 focus:border-red-500 dark:border-red-500"
                    )}
                    disabled={disabled}
                  />
                  {errors.codigoProducto ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.codigoProducto.message}</p>
                  ) : duplicateCodeProduct ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Ya existe un producto con este código ("{duplicateCodeProduct.name}")
                    </p>
                  ) : null}
                </div>

                {/* Banner de Catálogo Global que abarca el ancho completo (sm:col-span-2) sin desbordar en móvil */}
                {masterMatch && mode === "create" ? (
                  <div className="sm:col-span-2 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/70 p-3 text-xs text-blue-950 dark:text-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0 w-full overflow-hidden">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs mt-0.5 sm:mt-0">
                        <Sparkles size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-blue-900 dark:text-blue-200 leading-tight">
                          Catálogo Global
                        </p>
                        <p className="truncate text-slate-600 dark:text-slate-300 text-[11.5px]">
                          {masterMatch.name} {masterMatch.category ? `· ${masterMatch.category}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("nombre", masterMatch.name, { shouldDirty: true, shouldValidate: true });
                        setValue("categoria", masterMatch.category, { shouldDirty: true, shouldValidate: true });
                        setLocalCategories((prev) => normalizeToUniqueSorted([...prev, masterMatch.category]));
                        if (masterMatch.subcategory) {
                          setValue("subcategoria", masterMatch.subcategory, { shouldDirty: true, shouldValidate: true });
                          setLocalSubcategories((prev) => normalizeToUniqueSorted([...prev, masterMatch.subcategory!]));
                        }
                      }}
                      className="self-start sm:self-auto shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Reaplicar datos
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 overflow-hidden space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 dark:border-slate-700/80 dark:bg-slate-900 shadow-xs">
                <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">Clasificación</h5>
                </div>

                <div className="grid gap-3 md:grid-cols-2 min-w-0">
                  <div className="min-w-0">
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Categoría <span className="text-red-500">*</span>
                    </label>
                    <input
                      list="categorias-productos"
                      {...register("categoria", {
                        onBlur: (event) => ensureCategory(event.target.value),
                      })}
                      className="ui-input w-full"
                      disabled={disabled}
                      placeholder="Seleccionar o escribir categoría..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                    />
                    <datalist id="categorias-productos">
                      {localCategories.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {trimmedCategory ? (
                      isCategoryCreated ? (
                        <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 leading-tight">
                          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>Categoría existente</span>
                        </p>
                      ) : (
                        <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 leading-tight">
                          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>Esta categoría no está creada (se creará al guardar)</span>
                        </p>
                      )
                    ) : null}
                    {errors.categoria ? <p className="mt-1 text-xs text-red-600">{errors.categoria.message}</p> : null}
                  </div>

                  <div className="min-w-0">
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Subcategoría</label>
                    <input
                      list="subcategorias-productos"
                      {...register("subcategoria", {
                        onBlur: (event) => ensureSubcategory(event.target.value),
                      })}
                      className="ui-input w-full"
                      disabled={disabled}
                      placeholder="Seleccionar o escribir subcategoría..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                    />
                    <datalist id="subcategorias-productos">
                      {localSubcategories.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {trimmedSubcategory ? (
                      isSubcategoryCreated ? (
                        <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 leading-tight">
                          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>Subcategoría existente</span>
                        </p>
                      ) : (
                        <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 leading-tight">
                          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>Esta subcategoría no está creada (se creará al guardar)</span>
                        </p>
                      )
                    ) : null}
                    {errors.subcategoria ? (
                      <p className="mt-1 text-xs text-red-600">{errors.subcategoria.message}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <aside className="min-w-0 overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Fotografía</h4>
              </div>
              <div
                className={cn(
                  "mt-3 flex h-60 items-center justify-center overflow-hidden rounded-2xl transition-colors",
                  imagenPreview
                    ? "border border-slate-200/90 bg-white p-2.5 dark:border-slate-700/80 dark:bg-slate-950"
                    : "border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40"
                )}
              >
                {imagenPreview ? (
                  <img
                    src={imagenPreview}
                    alt="Foto del producto"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-3 text-center text-xs text-slate-500 dark:text-slate-400">Sin imagen cargada</span>
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

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={disabled}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Cargar o reemplazar
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                  onClick={handleRemovePhoto}
                  disabled={disabled || !imagenPreview}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <path d="M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14M10 10v6M14 10v6" />
                  </svg>
                  Eliminar foto
                </button>
              </div>

              {photoError ? <p className="mt-2 text-xs text-red-600">{photoError}</p> : null}
            </aside>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/40 min-w-0 overflow-hidden">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Precios y cálculo</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 min-w-0">
              <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 dark:border-slate-700/80 dark:bg-slate-900 shadow-xs">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {saleMode === "weight" ? "Precio de costo por kg" : "Precio de costo"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("precioCosto", {
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("forward"),
                  })}
                  onFocus={(e) =>
                    handleNumericInputFocus(e, {
                      isNew: mode === "create",
                      onClear: () => setValue("precioCosto", "" as any),
                    })
                  }
                  onBlur={(e) => {
                    handleNumericInputBlur(e, "0", () => {
                      setValue("precioCosto", 0);
                    });
                    applyForwardPricing();
                  }}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.precioCosto ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.precioCosto.message}</p>
                ) : null}
              </div>

              <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 dark:border-slate-700/80 dark:bg-slate-900 shadow-xs">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">% Ganancia</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("porcentajeGanancia", {
                    setValueAs: parseNumericField,
                  })}
                  onFocus={(e) =>
                    handleNumericInputFocus(e, {
                      isNew: mode === "create",
                      onClear: () => setValue("porcentajeGanancia", "" as any),
                    })
                  }
                  onBlur={(e) => {
                    handleNumericInputBlur(e, "0", () => {
                      setValue("porcentajeGanancia", 0);
                    });
                    if (calcMode === "reverse") {
                      applyReversePricing();
                    } else {
                      applyForwardPricing();
                    }
                  }}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeGanancia ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.porcentajeGanancia.message}</p>
                ) : null}
              </div>

              <div className="min-w-0 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 sm:p-4 dark:border-sky-800/80 dark:bg-sky-950/40 shadow-xs">
                <div className="mb-1 flex items-center gap-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-sky-200">Precio sin IVA</label>
                  <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700 dark:border-sky-700/80 dark:bg-sky-900/80 dark:text-sky-200">
                    Calculado
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioSinIva")}
                  readOnly
                  className="ui-input bg-sky-50/60 dark:bg-sky-950/70 dark:border-sky-700/80 dark:text-sky-100 font-semibold"
                  disabled={disabled}
                />
                {errors.precioSinIva ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.precioSinIva.message}</p>
                ) : null}
              </div>

              <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 dark:border-slate-700/80 dark:bg-slate-900 shadow-xs">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">% IVA</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="21"
                  {...register("porcentajeIva", {
                    setValueAs: parseNumericField,
                    onBlur: () => {
                      if (calcMode === "reverse") {
                        applyReversePricing();
                      } else {
                        applyForwardPricing();
                      }
                    },
                  })}
                  onFocus={(e) =>
                    handleNumericInputFocus(e, {
                      isNew: false,
                    })
                  }
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeIva ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.porcentajeIva.message}</p>
                ) : null}
              </div>

              <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 sm:p-4 dark:border-emerald-800/80 dark:bg-emerald-950/40 shadow-xs">
                <div className="mb-1 flex items-center gap-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-emerald-200">
                    {saleMode === "weight" ? "Precio final por kg" : "Precio final"}
                  </label>
                  <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:border-emerald-700/80 dark:bg-emerald-900/80 dark:text-emerald-200">
                    Principal
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("precioFinal", {
                    setValueAs: parseNumericField,
                    onChange: () => setCalcMode("reverse"),
                  })}
                  onFocus={(e) =>
                    handleNumericInputFocus(e, {
                      isNew: mode === "create",
                      onClear: () => setValue("precioFinal", "" as any),
                    })
                  }
                  onBlur={(e) => {
                    handleNumericInputBlur(e, "0", () => {
                      setValue("precioFinal", 0);
                    });
                    applyReversePricing();
                  }}
                  className="ui-input border-emerald-300 bg-emerald-50/60 dark:border-emerald-600/80 dark:bg-emerald-950/70 dark:text-emerald-100 text-base font-semibold"
                  disabled={disabled}
                />
                {errors.precioFinal ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.precioFinal.message}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Envase retornable */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Envase retornable
                </h4>
              </div>
              <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  {...register("isReturnable")}
                  disabled={disabled}
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-disabled:opacity-50 dark:bg-slate-700" />
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </label>
            </div>

            {isReturnable && (
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 min-w-0">
                <div className="grid gap-3 sm:grid-cols-2 min-w-0">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Tipo de envase configurado
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPackagesManagerOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
                      >
                        <Package className="h-3 w-3" />
                        <span>Ver envases ({tenantPackages.length})</span>
                      </button>
                    </div>

                    <select
                      value={
                        isCustomPackageMode
                          ? "__custom__"
                          : (watch("returnablePackageName") || "")
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__custom__") {
                          setIsCustomPackageMode(true);
                        } else if (val === "") {
                          setIsCustomPackageMode(false);
                          setValue("returnablePackageName", "");
                        } else {
                          setIsCustomPackageMode(false);
                          setValue("returnablePackageName", val);
                          const found = tenantPackages.find(
                            (p) => p.name.toLowerCase() === val.toLowerCase()
                          );
                          if (found && typeof found.suggestedPrice === "number") {
                            setValue("returnablePackagePrice", found.suggestedPrice);
                          }
                        }
                      }}
                      className="ui-select w-full text-xs"
                      disabled={disabled}
                    >
                      <option value="">-- Seleccionar tipo de envase --</option>
                      {tenantPackages.map((pkg) => (
                        <option key={pkg.name} value={pkg.name}>
                          {pkg.name} {pkg.suggestedPrice ? `(${pkg.suggestedPrice.toLocaleString("es-AR")})` : ""}
                        </option>
                      ))}
                      <option value="__custom__">+ Crear nuevo tipo de envase...</option>
                    </select>

                    {isCustomPackageMode && (
                      <div className="mt-2 space-y-1">
                        <input
                          type="text"
                          autoFocus
                          value={customPackageInput}
                          onChange={(e) => {
                            setCustomPackageInput(e.target.value);
                            setValue("returnablePackageName", e.target.value);
                          }}
                          placeholder="Nombre del nuevo envase (ej: ENVASE DE COCA)"
                          className="ui-input w-full text-xs"
                          disabled={disabled}
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Precio del envase (si no trae el vacío)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...register("returnablePackagePrice", { valueAsNumber: true })}
                      placeholder="0"
                      className="ui-input w-full text-xs"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/40 min-w-0 overflow-hidden">
            <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Estado y seguimiento de inventario</h4>
            <div className="grid gap-3 sm:grid-cols-2 min-w-0">
              <label className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 shadow-xs cursor-pointer min-w-0">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Seguimiento de stock</span>
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input type="checkbox" className="peer sr-only" {...register("trackStock")} disabled={disabled} />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 peer-disabled:opacity-50 dark:bg-slate-700" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>

              <label className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 shadow-xs cursor-pointer min-w-0">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Producto activo</span>
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input type="checkbox" className="peer sr-only" {...register("estadoActivo")} disabled={disabled} />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 peer-disabled:opacity-50 dark:bg-slate-700" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/40 min-w-0 overflow-hidden">
            <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Mi Tienda Online (Catálogo Web)</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                Público
              </span>
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 min-w-0">
              <label className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 shadow-xs cursor-pointer min-w-0">
                <div className="pr-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">Publicar en Mi Tienda</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Visible en tu catálogo compartido</span>
                </div>
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input type="checkbox" className="peer sr-only" {...register("publicadoWeb")} disabled={disabled} />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 peer-disabled:opacity-50 dark:bg-slate-700" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>

              <label className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 shadow-xs cursor-pointer min-w-0">
                <div className="pr-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">Destacado en portada</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Aparece en la sección de ofertas</span>
                </div>
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input type="checkbox" className="peer sr-only" {...register("destacadoWeb")} disabled={disabled} />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-amber-500 peer-disabled:opacity-50 dark:bg-slate-700" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>
            </div>

            {mode === "edit" && storeCustomLists.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-2">
                  Listas personalizadas de Mi Tienda:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {storeCustomLists.map((list) => {
                    const isSelected = selectedListIds.includes(list.id);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setSelectedListIds((prev) =>
                            prev.includes(list.id)
                              ? prev.filter((id) => id !== list.id)
                              : [...prev, list.id]
                          )
                        }
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        )}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{list.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          </div>

          {/* Pie de modal: Pegado 100% abajo, sólido, sin transparencias ni paneles visibles detrás */}
          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200/80 bg-white px-4 sm:px-5 py-3 sm:py-3.5 dark:border-slate-800 dark:bg-slate-900 md:px-6 min-w-0">
            <button
              type="button"
              className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all"
              onClick={onClose}
              disabled={disabled}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl sm:rounded-2xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              disabled={disabled}
            >
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

      <ReturnablePackagesModal
        isOpen={isPackagesManagerOpen}
        onClose={() => setIsPackagesManagerOpen(false)}
        canWrite={!disabled}
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
