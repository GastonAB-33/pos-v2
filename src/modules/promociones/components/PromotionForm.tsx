import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  AlertCircle,
  BadgePercent,
  Calculator,
  CheckCircle2,
  DollarSign,
  Package,
  Percent,
  PlusCircle,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import {
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  matchesProductSearch,
  type ProductSearchScope,
} from "@/utils/search";
import { buildPromotionBarcode, type PromotionWithDetails } from "@/services/promotions.service";
import type { Product } from "@/types/entities";
import {
  promotionFormSchema,
  type PromotionFormValues,
} from "@/modules/promociones/schemas/promotion-form.schema";
import { cn } from "@/utils/cn";

interface PromotionFormProps {
  mode: "create" | "edit";
  promotion?: PromotionWithDetails;
  products: Product[];
  primaryBarcodes?: Record<string, string>;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PromotionFormValues) => Promise<void>;
  onRequestCreateProduct?: () => void;
  newlyCreatedProduct?: Product | null;
}

type PricingAssignmentMode = "final_price" | "percent_discount" | "amount_discount";

const defaultValues: PromotionFormValues = {
  name: "",
  code: "",
  barcode: "",
  description: "",
  type: "combo_price",
  scope: "bundle",
  productId: "",
  minQuantity: 1,
  discountPercent: "",
  discountAmount: "",
  comboPrice: "",
  startsAt: "",
  endsAt: "",
  bundleItems: [],
};

const roundAmount = (value: number) => Number(value.toFixed(2));
const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const toDatetimeLocal = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

export const PromotionForm = ({
  mode,
  promotion,
  products,
  primaryBarcodes = {},
  disabled,
  onCancel,
  onSubmit,
  onRequestCreateProduct,
  newlyCreatedProduct,
}: PromotionFormProps) => {
  const [pricingMode, setPricingMode] = useState<PricingAssignmentMode>("final_price");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [flashFeedback, setFlashFeedback] = useState<{
    type: "success" | "error";
    message: string;
    timestamp: number;
  } | null>(null);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = (type: "success" | "error", message: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashFeedback({ type, message, timestamp: Date.now() });
    flashTimerRef.current = setTimeout(() => {
      setFlashFeedback(null);
    }, 2200);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const {
    register,
    watch,
    setValue,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues,
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "bundleItems",
  });

  const watchedItems = watch("bundleItems") ?? [];
  const watchedName = watch("name");
  const watchedComboPrice = watch("comboPrice");
  const watchedDiscountPercent = watch("discountPercent");
  const watchedDiscountAmount = watch("discountAmount");

  // Map of products by ID for fast lookups
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Compute regular total based on selected items and their unit prices
  const regularTotal = useMemo(() => {
    let sum = 0;
    for (const item of watchedItems) {
      const prod = productById.get(item.productId);
      const unitPrice = prod?.price ?? 0;
      const qty = Number(item.quantity) || 0;
      sum += unitPrice * qty;
    }
    return roundAmount(sum);
  }, [watchedItems, productById]);

  // Initialize form on edit or reset on create
  useEffect(() => {
    if (!promotion) {
      reset(defaultValues);
      setPricingMode("final_price");
      return;
    }

    const initialItems =
      promotion.items && promotion.items.length > 0
        ? promotion.items.map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
          }))
        : promotion.product_id
        ? [{ productId: promotion.product_id, quantity: promotion.min_quantity ?? 1 }]
        : [];

    let initialMode: PricingAssignmentMode = "final_price";
    if (promotion.type === "percentage_discount") {
      initialMode = "percent_discount";
    } else if (promotion.type === "fixed_discount") {
      initialMode = "amount_discount";
    } else {
      initialMode = "final_price";
    }
    setPricingMode(initialMode);

    reset({
      name: promotion.name,
      code: promotion.code,
      barcode: promotion.barcodes?.[0]?.barcode ?? buildPromotionBarcode(promotion.code),
      description: promotion.description ?? "",
      type: promotion.type,
      scope: promotion.scope,
      productId: promotion.product_id ?? "",
      minQuantity: promotion.min_quantity ?? 1,
      discountPercent: promotion.discount_percent ?? "",
      discountAmount: promotion.discount_amount ?? "",
      comboPrice: promotion.combo_price ?? "",
      startsAt: toDatetimeLocal(promotion.starts_at),
      endsAt: toDatetimeLocal(promotion.ends_at),
      bundleItems: initialItems,
    });
  }, [promotion, reset]);

  // Listen for newly created products from ProductFormModal and auto-add to items
  useEffect(() => {
    if (!newlyCreatedProduct) return;
    const exists = watchedItems.some((item) => item.productId === newlyCreatedProduct.id);
    if (!exists) {
      append({ productId: newlyCreatedProduct.id, quantity: 1 });
    }
  }, [newlyCreatedProduct, append, watchedItems]);

  // Auto-generate code and barcode from name in create mode
  const handleNameChange = (val: string) => {
    setValue("name", val, { shouldValidate: true });
    if (mode === "create") {
      const generatedCode = slugify(val);
      if (generatedCode) {
        setValue("code", generatedCode, { shouldValidate: true });
        setValue("barcode", buildPromotionBarcode(generatedCode), { shouldValidate: true });
      }
    }
  };

  // Identify promo type automatically based on selected items
  const promoAnalysis = useMemo(() => {
    const totalItems = watchedItems.length;
    if (totalItems === 0) {
      return {
        typeKey: "empty" as const,
        title: "Sin artículos seleccionados",
        badge: "Seleccioná al menos un artículo",
        badgeColor: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        icon: Package,
        description: "Agregá artículos desde el catálogo para configurar la promoción.",
      };
    }

    const firstItem = watchedItems[0];
    const firstQty = Number(firstItem?.quantity) > 0 ? Number(firstItem.quantity) : 1;
    const firstProd = productById.get(firstItem?.productId);
    const isWeight = firstProd?.sale_mode === "weight";

    if (totalItems === 1 && firstQty === 1 && !isWeight) {
      return {
        typeKey: "single_discount" as const,
        title: "Artículo individual en descuento",
        badge: "🏷️ Descuento individual",
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        icon: Tag,
        description:
          "Se aplica un precio especial o porcentaje de descuento directo a una unidad del producto.",
      };
    }

    if (totalItems === 1 && isWeight && firstQty === 1) {
      return {
        typeKey: "single_discount" as const,
        title: `Artículo pesable (1 kg de ${firstProd?.name ?? "artículo"})`,
        badge: "⚖️ 1 kg en promo",
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        icon: Tag,
        description:
          "Se aplica un precio promocional o porcentaje de descuento directo por kilogramo.",
      };
    }

    if (totalItems === 1 && firstQty > 0 && firstQty !== 1) {
      return {
        typeKey: "pack_volume" as const,
        title: isWeight
          ? `Pack por peso (${firstQty} kg de ${firstProd?.name ?? "artículo"})`
          : `Pack por cantidad (${firstQty}x del mismo artículo)`,
        badge: isWeight ? `⚖️ Pack ${firstQty} kg` : `📦 Pack ${firstQty}x1 / Volumen`,
        badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
        icon: Package,
        description: isWeight
          ? `Venta cerrada de ${firstQty} kg de ${firstProd?.name ?? "artículo"} a un precio promocional especial.`
          : `Venta cerrada de ${firstQty} unidades del mismo artículo a un precio promocional especial.`,
      };
    }

    return {
      typeKey: "combo_bundle" as const,
      title: `Combo combinado (${totalItems} artículos distintos)`,
      badge: `🎁 Combo de ${totalItems} artículos`,
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
      icon: Sparkles,
      description: "Venta conjunta de varios artículos combinados con un precio promocional único.",
    };
  }, [watchedItems, productById]);

  // Synchronize scope, type, and calculate live numbers
  useEffect(() => {
    const firstItem = watchedItems[0];
    const qty = Number(firstItem?.quantity) > 0 ? Number(firstItem.quantity) : 1;
    if (promoAnalysis.typeKey === "single_discount") {
      setValue("scope", "product");
      setValue("productId", firstItem?.productId ?? "");
      setValue("minQuantity", qty);
    } else {
      setValue("scope", "bundle");
      setValue("productId", firstItem?.productId ?? "");
      setValue("minQuantity", qty);
    }
  }, [promoAnalysis.typeKey, watchedItems, setValue]);

  // Handle adding a product by ID with live feedback
  const handleAddProductById = (productId: string, productName?: string) => {
    const prod = productById.get(productId);
    const name = productName || prod?.name || "Artículo";
    const isWeight = prod?.sale_mode === "weight";
    const exists = watchedItems.some((item) => item.productId === productId);
    if (exists) {
      const idx = watchedItems.findIndex((item) => item.productId === productId);
      const currentQty = Number(watchedItems[idx].quantity) || 1;
      const nextQty = Number((currentQty + 1).toFixed(3));
      update(idx, { productId, quantity: nextQty });
      triggerFlash(
        "success",
        `✓ "${name}" (+1 ${isWeight ? "kg" : "unidad"} agregada, total: ${nextQty} ${isWeight ? "kg" : "u."})`
      );
    } else {
      append({ productId, quantity: 1 });
      triggerFlash(
        "success",
        `✓ "${name}" (${isWeight ? "1 kg inicial, podés ajustar el peso" : "1 unidad"}) agregado a la promoción`
      );
    }
  };

  const findProductByCodeOrBarcode = (query: string): Product | null => {
    const clean = query.trim().toLowerCase();
    if (!clean) return null;
    const cleanNum = clean.replace(/^0+/, "");

    // 1. Direct match in primaryBarcodes
    for (const [pId, bCode] of Object.entries(primaryBarcodes)) {
      if (!bCode) continue;
      const bClean = bCode.trim().toLowerCase();
      if (bClean === clean || (cleanNum && bClean.replace(/^0+/, "") === cleanNum)) {
        const prod = productById.get(pId);
        if (prod) return prod;
      }
    }

    // 2. Direct match in product.code
    for (const prod of products) {
      if (prod.code) {
        const cClean = prod.code.trim().toLowerCase();
        if (cClean === clean || (cleanNum && cClean.replace(/^0+/, "") === cleanNum)) {
          return prod;
        }
      }
    }

    // 3. Fallback: match by name
    for (const prod of products) {
      if (prod.name.trim().toLowerCase() === clean) {
        return prod;
      }
    }

    return null;
  };

  // Escáner de código de barras global: agrega el producto sin necesidad de tener el cursor en el buscador
  useBarcodeScanner({
    enabled: !disabled,
    onScan: (scannedBarcode) => {
      const clean = scannedBarcode.trim();
      if (!clean) return;

      const found = findProductByCodeOrBarcode(clean);
      if (found) {
        handleAddProductById(found.id, found.name);
        setSearchQuery("");
        setIsSearchOpen(false);
      } else {
        triggerFlash("error", `✕ No se encontró ningún artículo con el código "${clean}"`);
      }
    },
  });

  const searchResults = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return [];

    return products
      .filter((prod) =>
        matchesProductSearch(
          {
            name: prod.name,
            code: prod.code,
            barcode: primaryBarcodes[prod.id],
            category: prod.category,
            subcategory: prod.subcategory,
          },
          raw,
          searchScope
        )
      )
      .slice(0, 15);
  }, [products, primaryBarcodes, searchQuery, searchScope]);

  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchResults]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (searchResults.length > 0) {
        setIsSearchOpen(true);
        setSelectedResultIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (searchResults.length > 0) {
        setIsSearchOpen(true);
        setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (searchResults.length > 0) {
        const selected = searchResults[selectedResultIndex] || searchResults[0];
        handleAddProductById(selected.id, selected.name);
        setSearchQuery("");
        setIsSearchOpen(false);
      } else if (searchQuery.trim()) {
        const found = findProductByCodeOrBarcode(searchQuery.trim());
        if (found) {
          handleAddProductById(found.id, found.name);
          setSearchQuery("");
          setIsSearchOpen(false);
        } else {
          triggerFlash("error", `✕ No se encontró ningún artículo para "${searchQuery.trim()}"`);
        }
      }
    } else if (event.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  // Sync active pricing mode with schema types
  const handleSwitchPricingMode = (newMode: PricingAssignmentMode) => {
    setPricingMode(newMode);
    if (newMode === "final_price") {
      setValue("type", "combo_price");
      if (watchedDiscountPercent && regularTotal > 0) {
        const percent = Number(watchedDiscountPercent);
        const finalP = roundAmount(regularTotal * (1 - percent / 100));
        setValue("comboPrice", finalP);
      } else if (watchedDiscountAmount && regularTotal > 0) {
        const amount = Number(watchedDiscountAmount);
        const finalP = roundAmount(Math.max(0, regularTotal - amount));
        setValue("comboPrice", finalP);
      }
    } else if (newMode === "percent_discount") {
      setValue("type", "percentage_discount");
      if (watchedComboPrice && regularTotal > 0) {
        const comboP = Number(watchedComboPrice);
        const diff = Math.max(0, regularTotal - comboP);
        const percent = roundAmount((diff / regularTotal) * 100);
        setValue("discountPercent", percent);
      }
    } else if (newMode === "amount_discount") {
      setValue("type", "fixed_discount");
      if (watchedComboPrice && regularTotal > 0) {
        const comboP = Number(watchedComboPrice);
        const diff = roundAmount(Math.max(0, regularTotal - comboP));
        setValue("discountAmount", diff);
      }
    }
  };

  // Live calculation of Promo Price, Discount $, and Discount %
  const livePricing = useMemo(() => {
    let finalPrice = regularTotal;
    let savingsAmount = 0;
    let savingsPercent = 0;

    if (pricingMode === "final_price") {
      const enteredPrice = Number(watchedComboPrice);
      if (Number.isFinite(enteredPrice) && enteredPrice >= 0 && regularTotal > 0) {
        finalPrice = enteredPrice;
        savingsAmount = roundAmount(Math.max(0, regularTotal - finalPrice));
        savingsPercent = regularTotal > 0 ? roundAmount((savingsAmount / regularTotal) * 100) : 0;
      }
    } else if (pricingMode === "percent_discount") {
      const enteredPercent = Number(watchedDiscountPercent);
      if (Number.isFinite(enteredPercent) && enteredPercent > 0 && regularTotal > 0) {
        savingsPercent = enteredPercent;
        savingsAmount = roundAmount(regularTotal * (enteredPercent / 100));
        finalPrice = roundAmount(Math.max(0, regularTotal - savingsAmount));
      }
    } else if (pricingMode === "amount_discount") {
      const enteredAmount = Number(watchedDiscountAmount);
      if (Number.isFinite(enteredAmount) && enteredAmount > 0 && regularTotal > 0) {
        savingsAmount = Math.min(regularTotal, enteredAmount);
        savingsPercent = regularTotal > 0 ? roundAmount((savingsAmount / regularTotal) * 100) : 0;
        finalPrice = roundAmount(Math.max(0, regularTotal - savingsAmount));
      }
    }

    return {
      finalPrice,
      savingsAmount,
      savingsPercent,
    };
  }, [pricingMode, regularTotal, watchedComboPrice, watchedDiscountPercent, watchedDiscountAmount]);

  // Keep comboPrice updated so the final price is always persisted
  useEffect(() => {
    if (pricingMode !== "final_price" && livePricing.finalPrice != null) {
      setValue("comboPrice", livePricing.finalPrice);
    }
  }, [pricingMode, livePricing.finalPrice, setValue]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {/* 1. Datos Principales: Nombre, Código y Código de Barras */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Tag size={16} className="text-blue-500" />
          <span>Información de la promoción</span>
        </h4>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Nombre de la promoción <span className="text-red-500">*</span>
            </label>
            <input
              value={watchedName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Pack Corona 3x1 o Combo Fernet + Coca"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
            />
            {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Código interno <span className="text-red-500">*</span>
            </label>
            <input
              {...register("code")}
              placeholder="promo_pack_corona"
              className="w-full font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
            />
            {errors.code ? <p className="mt-1 text-xs text-red-500">{errors.code.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Código de barras escaneable
            </label>
            <input
              {...register("barcode")}
              placeholder="PROMO-CORONA-3X1"
              className="w-full font-mono text-sm uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Podés escanearlo directamente en el POS o buscarlo como "PROMO..."
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Descripción / Notas <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            {...register("description")}
            placeholder="Detalles visibles para el cajero o en reportes"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </div>

      {/* 2. Selector de Artículos y Tabla de Componentes */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-indigo-500" />
              <span>Artículos incluidos en la promoción</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                {fields.length}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Seleccioná los artículos existentes o creá uno nuevo sobre la marcha.
            </p>
          </div>

          {onRequestCreateProduct ? (
            <button
              type="button"
              onClick={onRequestCreateProduct}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/60 transition shadow-2xs cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>+ Crear nuevo artículo</span>
            </button>
          ) : null}
        </div>

        {/* Buscador inteligente idéntico al POS con soporte de escáner global y resaltado verde/rojo */}
        <div
          ref={searchContainerRef}
          data-search-open={isSearchOpen ? "true" : undefined}
          className={cn(
            "relative rounded-xl p-3 border transition-all duration-300",
            flashFeedback?.type === "success"
              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/40"
              : flashFeedback?.type === "error"
              ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 ring-2 ring-rose-400/40"
              : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80"
          )}
        >
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 focus-within:border-blue-500 dark:focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={getSearchPlaceholder(searchScope)}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none min-w-0"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              disabled={disabled}
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : null}

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

            <select
              value={searchScope}
              onChange={(e) => {
                setSearchScope(e.target.value as ProductSearchScope);
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer py-0.5 px-1 shrink-0 max-w-[150px] truncate"
              aria-label="Ámbito de búsqueda"
              disabled={disabled}
            >
              {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium py-1"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback visual con texto explicativo */}
          {flashFeedback ? (
            <div
              className={cn(
                "mt-2 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn",
                flashFeedback.type === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {flashFeedback.type === "success" ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : (
                <AlertCircle size={14} className="shrink-0" />
              )}
              <span>{flashFeedback.message}</span>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              💡 Podés buscar por nombre, código o pistolear el código de barras con el lector desde cualquier parte de la pantalla.
            </p>
          )}

          {/* Menú flotante de resultados del buscador */}
          {isSearchOpen && searchResults.length > 0 ? (
            <div className="absolute left-3 right-3 top-full mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl z-40 divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((prod, index) => {
                const barcode = primaryBarcodes[prod.id] || prod.code || "";
                const isSelected = index === selectedResultIndex;
                const isWeight = prod.sale_mode === "weight";

                return (
                  <div
                    key={prod.id}
                    ref={(el) => {
                      resultItemRefs.current[index] = el;
                    }}
                    onClick={() => {
                      handleAddProductById(prod.id, prod.name);
                      setSearchQuery("");
                      setIsSearchOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2.5 rounded-lg cursor-pointer transition border",
                      isSelected
                        ? "border-blue-500 dark:border-sky-500 bg-blue-50/90 dark:bg-sky-950/80 ring-2 ring-blue-500/40 shadow-xs"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {prod.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {barcode && (
                          <span>
                            Cód: <strong className="font-mono">{barcode}</strong>
                          </span>
                        )}
                        {prod.category && <span>• {prod.category}</span>}
                        <span>
                          • Stock:{" "}
                          {isWeight
                            ? `${(prod.stock_current * 1000).toLocaleString("es-AR")} g`
                            : `${prod.stock_current} u.`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                        {currency.format(prod.price)}
                      </span>
                      {isWeight && <span className="text-[10px] text-slate-400 block">/ kg</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isSearchOpen && searchQuery.trim() ? (
            <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl z-40 text-center text-xs text-slate-500 dark:text-slate-400">
              No se encontraron artículos que coincidan con "{searchQuery.trim()}".
            </div>
          ) : null}
        </div>

        {/* Tabla de Artículos Agregados */}
        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/40">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No hay artículos agregados todavía.</p>
            <p className="text-xs text-slate-400 mt-1">
              Elegí un artículo del desplegable superior o creá un artículo nuevo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 shadow-2xs">
            <table className="w-full text-left text-sm divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2.5">Artículo</th>
                  <th className="px-3 py-2.5">Stock Actual</th>
                  <th className="px-3 py-2.5 text-right">Precio Reg. Unit.</th>
                  <th className="px-3 py-2.5 text-center w-32">Cantidad / Peso</th>
                  <th className="px-3 py-2.5 text-right">Subtotal Reg.</th>
                  <th className="px-3 py-2.5 text-center w-16">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fields.map((field, index) => {
                  const currentItem = watchedItems[index];
                  const prod = productById.get(currentItem?.productId);
                  const isWeight = prod?.sale_mode === "weight";
                  const qty = Number(currentItem?.quantity) || 1;
                  const unitPrice = prod?.price ?? 0;
                  const itemSubtotal = roundAmount(qty * unitPrice);

                  return (
                    <tr key={field.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {prod?.name ?? "Artículo no encontrado"}
                          </span>
                          {isWeight && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                              ⚖️ Pesable
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {prod?.category ?? "General"} {prod?.code ? `| Cód: ${prod.code}` : ""}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                            (prod?.stock_current ?? 0) > 0
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          )}
                        >
                          {prod?.stock_current ?? 0} {isWeight ? "kg" : "u."}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium text-slate-700 dark:text-slate-200">
                        {currency.format(unitPrice)}
                        {isWeight && <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">/kg</span>}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min={isWeight ? "0.001" : "1"}
                            step={isWeight ? "any" : "1"}
                            placeholder={isWeight ? "0.000" : "1"}
                            {...register(`bundleItems.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                            className="w-20 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-2 py-1 text-sm font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            disabled={disabled}
                          />
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 select-none">
                            {isWeight ? "kg" : "u."}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        {currency.format(itemSubtotal)}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Quitar artículo"
                          disabled={disabled}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {errors.bundleItems ? (
          <p className="mt-1 text-xs text-red-500">{errors.bundleItems.message}</p>
        ) : null}

        {/* 3. Detección Automática de Tipo de Promoción */}
        <div
          className={cn(
            "rounded-xl border p-3.5 flex items-start sm:items-center gap-3 transition",
            promoAnalysis.typeKey === "empty"
              ? "border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300"
              : "border-blue-200 dark:border-sky-800/70 bg-blue-50/70 dark:bg-sky-950/30 text-blue-900 dark:text-sky-200"
          )}
        >
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-2xs shrink-0 text-blue-600 dark:text-sky-400">
            <promoAnalysis.icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {promoAnalysis.title}
              </span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md", promoAnalysis.badgeColor)}>
                {promoAnalysis.badge}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {promoAnalysis.description}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Asignación de Precios y Cálculo en Vivo */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator size={16} className="text-emerald-500" />
              <span>Precio y cálculo de la promoción</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Elegí cómo querés asignar el precio: por monto final, porcentaje de descuento o descuento fijo.
            </p>
          </div>

          {/* Segmented Mode Selector */}
          <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-900 p-1 border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleSwitchPricingMode("final_price")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1",
                pricingMode === "final_price"
                  ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <DollarSign size={13} />
              <span>Precio final ($)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPricingMode("percent_discount")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1",
                pricingMode === "percent_discount"
                  ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <Percent size={13} />
              <span>Descuento (%)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPricingMode("amount_discount")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1",
                pricingMode === "amount_discount"
                  ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <BadgePercent size={13} />
              <span>Descuento fijo ($)</span>
            </button>
          </div>
        </div>

        {/* Input Dinámico según Modo Seleccionado */}
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          {pricingMode === "final_price" ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Precio final de la promoción ($) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("comboPrice")}
                  placeholder="Ej: 7500"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 pl-7 pr-3 py-2 text-base font-bold text-emerald-600 dark:text-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  disabled={disabled}
                />
              </div>
              {errors.comboPrice ? (
                <p className="mt-1 text-xs text-red-500">{errors.comboPrice.message}</p>
              ) : null}
            </div>
          ) : null}

          {pricingMode === "percent_discount" ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Porcentaje de descuento (%) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute right-3 top-2.5 text-sm font-bold text-slate-400">%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  {...register("discountPercent")}
                  placeholder="Ej: 20"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 pr-7 py-2 text-base font-bold text-blue-600 dark:text-sky-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={disabled}
                />
              </div>
              {errors.discountPercent ? (
                <p className="mt-1 text-xs text-red-500">{errors.discountPercent.message}</p>
              ) : null}
            </div>
          ) : null}

          {pricingMode === "amount_discount" ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Monto de descuento fijo ($) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("discountAmount")}
                  placeholder="Ej: 2000"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 pl-7 pr-3 py-2 text-base font-bold text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  disabled={disabled}
                />
              </div>
              {errors.discountAmount ? (
                <p className="mt-1 text-xs text-red-500">{errors.discountAmount.message}</p>
              ) : null}
            </div>
          ) : null}

          {/* 3 KPI Live Cards */}
          <div className="sm:col-span-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2.5">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Precio Regular Total
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
                {currency.format(regularTotal)}
              </span>
            </div>

            <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5">
              <span className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                Precio Promoción Final
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {currency.format(livePricing.finalPrice)}
              </span>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-sky-800 bg-blue-50/60 dark:bg-sky-950/30 p-2.5">
              <span className="block text-[11px] font-bold text-blue-800 dark:text-sky-300">
                Ahorro del Cliente
              </span>
              <span className="text-sm sm:text-base font-extrabold text-blue-700 dark:text-sky-400">
                -{currency.format(livePricing.savingsAmount)}
                <span className="text-[10px] ml-1 font-semibold">({livePricing.savingsPercent}%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Vigencia de la Promoción */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>Vigencia de la promoción</span>
          <span className="text-xs text-slate-400 font-normal">(opcional)</span>
        </h4>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Fecha y hora de inicio
            </label>
            <input
              type="datetime-local"
              {...register("startsAt")}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Fecha y hora de fin
            </label>
            <input
              type="datetime-local"
              {...register("endsAt")}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={disabled}
            />
            {errors.endsAt ? <p className="mt-1 text-xs text-red-500">{errors.endsAt.message}</p> : null}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          ℹ️ Al definir una <strong>Fecha y hora de fin</strong>, una vez cumplido ese límite la promoción se deshabilita automáticamente y dejará de aplicarse en las ventas del POS.
        </p>
      </div>

      {/* 6. Footer con Botones */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={disabled || fields.length === 0}
          className="ui-btn-primary px-5 py-2 text-sm font-bold shadow-panel disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {mode === "create" ? "Guardar y activar promoción" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
