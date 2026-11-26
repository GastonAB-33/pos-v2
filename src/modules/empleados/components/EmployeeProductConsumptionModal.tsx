import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { productsService } from "@/services/products.service";
import { settingsService } from "@/services/settings.service";
import { parseScaleBarcode } from "@/services/barcode/scale-barcode.service";
import { useProductsStore } from "@/features/products/store/products.store";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import { PosQuickProductModal } from "@/modules/pos/components/PosQuickProductModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { PosQuickProductInput } from "@/modules/pos/hooks/usePosSale";
import type { BarcodeScaleSettings, Employee, Product } from "@/types/entities";
import { Search, ShoppingBag, Plus, Minus, Trash2, Barcode, Tag, X } from "lucide-react";

interface EmployeeProductConsumptionModalProps {
  open: boolean;
  tenantId: string;
  employee: Employee;
  onClose: () => void;
  onSubmit: (values: {
    amount: number;
    notes: string;
    category: "product_purchase";
  }) => Promise<boolean>;
}

interface CartItem {
  product: Product;
  quantity: number;
  applyDiscount: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const defaultBarcodeScaleSettings: BarcodeScaleSettings = {
  scale_parser_enabled: false,
  scale_mode: "total_price",
  scale_prefix: "20",
  code_length: 13,
  plu_start: 3,
  plu_length: 4,
  weight_start: 8,
  weight_length: 5,
  weight_decimals: 3,
  amount_start: 7,
  amount_length: 6,
  amount_decimals: 2,
  ean13_enabled: true,
};

export const EmployeeProductConsumptionModal = ({
  open,
  tenantId,
  employee,
  onClose,
  onSubmit,
}: EmployeeProductConsumptionModalProps) => {
  useBodyScrollLock(open);
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [primaryBarcodes, setPrimaryBarcodes] = useState<Record<string, string>>({});
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(employee.discount_percent ?? 10);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState("");
  const [scaleSettings, setScaleSettings] = useState<BarcodeScaleSettings>(defaultBarcodeScaleSettings);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Helper para verificar si la categoría del producto está excluida del descuento
  const isCategoryExcluded = useCallback(
    (category?: string | null) => {
      if (!category || !category.trim()) return false;
      const norm = category.trim().toLowerCase();
      return excludedCategories.some((cat) => cat.trim().toLowerCase() === norm);
    },
    [excludedCategories]
  );

  // Cargar catálogo de productos, códigos de barras y configuración del tenant
  useEffect(() => {
    if (!open || !tenantId) return;

    let isMounted = true;
    setIsLoading(true);

    const prodStore = useProductsStore.getState();
    const hasFreshCatalog = prodStore.loadedTenantId === tenantId && prodStore.products.length > 0;
    const productsPromise = hasFreshCatalog
      ? Promise.resolve(prodStore.products)
      : prodStore.loadCatalog(tenantId).then(() => useProductsStore.getState().products);
    const barcodesPromise = hasFreshCatalog
      ? Promise.resolve(prodStore.primaryBarcodes)
      : productsService.getPrimaryBarcodesMapByTenant(tenantId).catch(() => ({}));

    Promise.all([
      productsPromise,
      barcodesPromise,
      settingsService.getByTenant(tenantId).catch(() => null),
    ])
      .then(([productsData, barcodesMap, tenantSettings]) => {
        if (!isMounted) return;
        setProducts((productsData as Product[]).filter((p) => p.is_active));
        setPrimaryBarcodes((barcodesMap as Record<string, string>) || {});
        const defaultDiscount = tenantSettings?.pos?.employee_discount_percent ?? 10;
        setDiscountPercent(employee.discount_percent ?? defaultDiscount);
        setExcludedCategories(tenantSettings?.pos?.employee_discount_excluded_categories ?? []);
        if (tenantSettings?.codigos_balanza) {
          setScaleSettings(tenantSettings.codigos_balanza);
        }
      })
      .catch(() => {
        toast.error("Error al cargar productos o configuración");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, tenantId, employee.discount_percent, toast]);

  // Cerrar dropdown de búsqueda al hacer clic afuera
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Agregar al carrito (si la categoría está excluida, arranca destildado sin descuento)
  const addToCart = useCallback(
    (product: Product, quantity: number = 1) => {
      const isExcluded = isCategoryExcluded(product.category);
      const qtyToAdd = Math.max(0.001, Number(quantity.toFixed(3)));
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: Number((item.quantity + qtyToAdd).toFixed(3)) }
              : item
          );
        }
        return [
          ...prev,
          {
            product,
            quantity: qtyToAdd,
            applyDiscount: !isExcluded,
          },
        ];
      });
    },
    [isCategoryExcluded]
  );

  // Helper para buscar producto por PLU de balanza
  const findProductByPluCode = useCallback(
    (pluCode: string): Product | null => {
      const normPlu = pluCode.trim().toLowerCase();
      const strippedPlu = normPlu.replace(/^0+/, "");

      // 1. Coincidencia por primaryBarcodes
      for (const [productId, pBarcode] of Object.entries(primaryBarcodes)) {
        if (!pBarcode) continue;
        const norm = pBarcode.trim().toLowerCase();
        if (norm === normPlu || (strippedPlu && norm.replace(/^0+/, "") === strippedPlu)) {
          const candidate = products.find((p) => p.id === productId);
          if (candidate) return candidate;
        }
      }

      // 2. Coincidencia por código de producto interno
      return (
        products.find((p) => {
          if (!p.code) return false;
          const norm = p.code.trim().toLowerCase();
          return norm === normPlu || (strippedPlu && norm.replace(/^0+/, "") === strippedPlu);
        }) ?? null
      );
    },
    [products, primaryBarcodes]
  );

  // Procesar código de barras de balanza pesable o importe total
  const tryProcessScaleBarcode = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const term = rawCode.trim();
      if (!term) return false;

      // Si la balanza no está explícitamente marcada como activa en BD, pero se escanea un EAN-13
      // estándar que empieza con el prefijo típico (por defecto "20"), activamos el parser
      const activeScaleSettings: BarcodeScaleSettings = scaleSettings.scale_parser_enabled
        ? scaleSettings
        : term.startsWith(scaleSettings.scale_prefix || "20") && term.length === (scaleSettings.code_length || 13)
        ? { ...scaleSettings, scale_parser_enabled: true }
        : scaleSettings;

      const parsedScale = parseScaleBarcode(term, activeScaleSettings);
      if (!parsedScale) return false;

      // Buscar producto por PLU en memoria
      let scaleProduct = findProductByPluCode(parsedScale.productCode);

      // Si no está en memoria local, fallback remoto
      if (!scaleProduct && tenantId) {
        try {
          let remoteProduct = await productsService.getByBarcode(tenantId, parsedScale.productCode);
          if (!remoteProduct && parsedScale.productCode.replace(/^0+/, "")) {
            remoteProduct = await productsService.getByBarcode(
              tenantId,
              parsedScale.productCode.replace(/^0+/, "")
            );
          }
          if (remoteProduct && remoteProduct.is_active !== false) {
            scaleProduct = remoteProduct;
            setProducts((prev) => {
              if (prev.some((p) => p.id === remoteProduct.id)) return prev;
              return [remoteProduct, ...prev];
            });
            setPrimaryBarcodes((prev) => ({ ...prev, [remoteProduct.id]: parsedScale.productCode }));
          }
        } catch {
          // ignore
        }
      }

      if (!scaleProduct || !scaleProduct.is_active) {
        toast.error(`Código de balanza detectado pero no se encontró producto para PLU "${parsedScale.productCode}"`);
        return true;
      }

      const isUnitProduct = scaleProduct.sale_mode === "unit";
      let detectedQuantity = 1;

      if (isUnitProduct) {
        if (parsedScale.mode === "weight") {
          const rawInt = parsedScale.rawWeight ? parseInt(parsedScale.rawWeight, 10) : 0;
          const decimals = activeScaleSettings.weight_decimals ?? 3;
          const parsedUnits =
            rawInt > 0
              ? rawInt
              : parsedScale.weight != null
              ? Math.round(parsedScale.weight * 10 ** decimals)
              : 1;
          detectedQuantity = Math.max(1, parsedUnits);
        } else {
          detectedQuantity =
            scaleProduct.price > 0 && parsedScale.totalPrice != null && parsedScale.totalPrice > 0
              ? Math.max(1, Math.round(parsedScale.totalPrice / scaleProduct.price))
              : 1;
        }
      } else {
        // Venta por peso (kg / gramos)
        if (parsedScale.weight != null && parsedScale.weight > 0) {
          detectedQuantity = Number(parsedScale.weight.toFixed(3));
        } else if (
          parsedScale.mode === "total_price" &&
          parsedScale.totalPrice != null &&
          parsedScale.totalPrice > 0 &&
          scaleProduct.price > 0
        ) {
          detectedQuantity = Number((parsedScale.totalPrice / scaleProduct.price).toFixed(3));
        } else {
          detectedQuantity = 1;
        }
      }

      addToCart(scaleProduct, detectedQuantity);
      const unitLabel = scaleProduct.sale_mode === "weight" ? "kg" : "u.";
      toast.success(`"${scaleProduct.name}" (${detectedQuantity} ${unitLabel}) agregado`);
      setSearch("");
      setIsSearchFocused(false);
      return true;
    },
    [scaleSettings, findProductByPluCode, tenantId, addToCart, toast]
  );

  // Escaneo global de código de barras (con pistola USB sin necesidad de foco en el buscador)
  const handleBarcodeScan = useCallback(
    async (scannedBarcode: string) => {
      const term = scannedBarcode.trim();
      if (!term) return;

      // 0. Verificar si es código de balanza pesable
      const handledAsScale = await tryProcessScaleBarcode(term);
      if (handledAsScale) return;

      const norm = term.toLowerCase();
      const stripped = norm.replace(/^0+/, "");

      // 1. Buscar en memoria por código de barras principal, código de producto o nombre
      let found = products.find((p) => {
        const pCode = (p.code || "").trim().toLowerCase();
        const pBarcode = (primaryBarcodes[p.id] || "").trim().toLowerCase();
        return (
          pBarcode === norm ||
          pCode === norm ||
          (stripped && (pBarcode.replace(/^0+/, "") === stripped || pCode.replace(/^0+/, "") === stripped)) ||
          p.name.toLowerCase() === norm
        );
      });

      // 2. Fallback remoto a la base de datos si no está en memoria
      if (!found && tenantId) {
        try {
          const remoteProduct = await productsService.getByBarcode(tenantId, term);
          if (remoteProduct && remoteProduct.is_active !== false) {
            found = remoteProduct;
            setProducts((prev) => {
              if (prev.some((p) => p.id === remoteProduct.id)) return prev;
              return [remoteProduct, ...prev];
            });
            setPrimaryBarcodes((prev) => ({ ...prev, [remoteProduct.id]: term }));
          }
        } catch (err) {
          console.warn("Error en búsqueda remota de código de barras:", err);
        }
      }

      if (found) {
        addToCart(found);
        toast.success(`"${found.name}" agregado por lector`);
        setSearch("");
        setIsSearchFocused(false);
      } else {
        toast.error(`No se encontró producto con código "${scannedBarcode}"`);
      }
    },
    [products, primaryBarcodes, tenantId, addToCart, toast, tryProcessScaleBarcode]
  );

  // Escucha activa para pistola de código de barras USB
  useBarcodeScanner({
    enabled: open && !isQuickProductModalOpen,
    onScan: handleBarcodeScan,
  });

  // Manejo de Enter en el input de búsqueda
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = search.trim();
      if (!raw) return;

      // 0. Si el texto ingresado coincide con un código de balanza pesable
      const handledAsScale = await tryProcessScaleBarcode(raw);
      if (handledAsScale) return;

      const norm = raw.toLowerCase();
      const stripped = norm.replace(/^0+/, "");

      let exact = products.find((p) => {
        const pCode = (p.code || "").trim().toLowerCase();
        const pBarcode = (primaryBarcodes[p.id] || "").trim().toLowerCase();
        return (
          pBarcode === norm ||
          pCode === norm ||
          (stripped && (pBarcode.replace(/^0+/, "") === stripped || pCode.replace(/^0+/, "") === stripped)) ||
          p.name.toLowerCase() === norm
        );
      });

      if (!exact && tenantId) {
        try {
          const remoteProduct = await productsService.getByBarcode(tenantId, raw);
          if (remoteProduct && remoteProduct.is_active !== false) {
            exact = remoteProduct;
            setProducts((prev) => {
              if (prev.some((p) => p.id === remoteProduct.id)) return prev;
              return [remoteProduct, ...prev];
            });
            setPrimaryBarcodes((prev) => ({ ...prev, [remoteProduct.id]: raw }));
          }
        } catch {
          // ignore
        }
      }

      if (exact) {
        addToCart(exact);
        setSearch("");
        setIsSearchFocused(false);
        toast.success(`"${exact.name}" agregado`);
        return;
      }

      if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearch("");
        setIsSearchFocused(false);
        toast.success(`"${filteredProducts[0].name}" agregado`);
        return;
      }
    } else if (e.key === "Escape") {
      setSearch("");
      setIsSearchFocused(false);
    }
  };

  // Filtrado reactivo al tipear en el buscador
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    const stripped = term.replace(/^0+/, "");

    return products
      .filter((p) => {
        const barcode = (primaryBarcodes[p.id] || "").toLowerCase();
        const code = (p.code || "").toLowerCase();
        return (
          p.name.toLowerCase().includes(term) ||
          code.includes(term) ||
          barcode.includes(term) ||
          (stripped && (code.includes(stripped) || barcode.includes(stripped))) ||
          (p.brand && p.brand.toLowerCase().includes(term))
        );
      })
      .slice(0, 8);
  }, [products, primaryBarcodes, search]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return list.length > 0 ? list : ["General"];
  }, [products]);

  // Actualizar cantidades
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const step = item.product.sale_mode === "weight" ? 0.1 : 1;
            const nextQty = Number((item.quantity + delta * step).toFixed(3));
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const setItemExactQuantity = (productId: string, qty: number) => {
    if (isNaN(qty) || qty <= 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: Number(qty.toFixed(3)) } : item
      )
    );
  };

  // Tildar / Destildar descuento de empleado por renglón de producto
  const toggleItemDiscount = (productId: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, applyDiscount: !item.applyDiscount }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cálculos de subtotales y descuentos
  const subtotalGross = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const eligibleSubtotal = useMemo(() => {
    return cart
      .filter((item) => item.applyDiscount)
      .reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const nonEligibleSubtotal = useMemo(() => {
    return cart
      .filter((item) => !item.applyDiscount)
      .reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Number(((eligibleSubtotal * discountPercent) / 100).toFixed(2));
  }, [eligibleSubtotal, discountPercent]);

  const totalAmount = useMemo(() => {
    return Math.max(0, Number((subtotalGross - discountAmount).toFixed(2)));
  }, [subtotalGross, discountAmount]);

  // Carga manual de producto no registrado
  const handleAddManualProduct = (input: PosQuickProductInput): boolean => {
    const name = input.name.trim();
    if (!name || input.quantity <= 0 || input.unitPrice <= 0) return false;

    const manualId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const manualProduct: Product = {
      id: manualId,
      tenant_id: tenantId,
      name,
      category: input.category.trim() || "Varios",
      subcategory: null,
      brand: null,
      supplier: null,
      code: input.code.trim() || "MANUAL",
      description: "Producto no registrado (temporal)",
      price: input.unitPrice,
      cost_price: input.costPrice || 0,
      currency_code: "ARS",
      stock_current: 9999,
      stock_min: null,
      stock_max: null,
      sale_mode: input.saleMode,
      is_favorite: false,
      is_active: true,
      image_url: null,
      vat_percent: 21,
      profit_percent: 0,
      price_without_vat: Number((input.unitPrice / 1.21).toFixed(2)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const isExcluded = isCategoryExcluded(input.category);
    setCart((prev) => [
      ...prev,
      { product: manualProduct, quantity: input.quantity, applyDiscount: !isExcluded },
    ]);

    toast.success(`"${name}" agregado al retiro`);
    return true;
  };

  const handleCreateAndAddProduct = async (input: PosQuickProductInput): Promise<boolean> => {
    const name = input.name.trim();
    if (!name || input.quantity <= 0 || input.unitPrice <= 0) return false;

    try {
      const priceWithoutVat = Number((input.unitPrice / 1.21).toFixed(2));
      const code = input.code.trim() || input.barcode.trim() || null;
      const created = await productsService.create(tenantId, {
        code,
        name,
        image_url: null,
        brand: null,
        supplier: null,
        is_favorite: input.favorite,
        description: null,
        price: input.unitPrice,
        cost_price: input.costPrice || 0,
        stock_current: Math.max(input.stock, input.quantity),
        stock_min: null,
        stock_max: null,
        category: input.category.trim() || "General",
        subcategory: null,
        sale_mode: input.saleMode,
        currency_code: "ARS",
        price_without_vat: priceWithoutVat,
        vat_percent: 21,
        profit_percent: 0,
        is_active: true,
      });

      if (input.barcode.trim()) {
        try {
          await productsService.setPrimaryBarcode(tenantId, created.id, input.barcode.trim());
          setPrimaryBarcodes((prev) => ({ ...prev, [created.id]: input.barcode.trim() }));
        } catch {
          // ignore
        }
      }

      setProducts((prev) => [...prev, created]);
      useProductsStore.getState().upsertProduct(created);
      const isExcluded = isCategoryExcluded(created.category);
      setCart((prev) => [...prev, { product: created, quantity: input.quantity, applyDiscount: !isExcluded }]);

      toast.success(`"${name}" creado y agregado al retiro`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar el producto");
      return false;
    }
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Agregá al menos un producto retirado por el empleado");
      return;
    }

    if (employee.current_account_limit != null && employee.current_account_limit > 0) {
      const projected = (employee.current_balance ?? 0) + totalAmount;
      if (projected > employee.current_account_limit) {
        const confirmOverlimit = window.confirm(
          `Atención: El retiro supera el límite de crédito del empleado ($${employee.current_account_limit}). Saldo proyectado: ${currency.format(
            projected
          )}. ¿Deseás registrarlo igualmente?`
        );
        if (!confirmOverlimit) return;
      }
    }

    const structuredTicket = {
      items: cart.map((item) => ({
        product_name: item.product.name,
        quantity: item.quantity,
        unit: item.product.sale_mode === "weight" ? "kg" : "x",
        unit_price: item.product.price,
        line_total: Number((item.product.price * item.quantity).toFixed(2)),
        no_discount: !item.applyDiscount,
      })),
      subtotal: subtotalGross,
      discountAmount,
      discountPercent: discountAmount > 0 ? discountPercent : null,
      total: totalAmount,
      customNotes: customNotes.trim() || null,
    };

    const notes = `Retiro de mercadería (${cart.length} ${cart.length === 1 ? "ítem" : "ítems"})${customNotes.trim() ? ` • Nota: ${customNotes.trim()}` : ""} <!-- TICKET_JSON:${JSON.stringify(structuredTicket)} -->`;

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        amount: totalAmount,
        notes,
        category: "product_purchase",
      });

      if (success) {
        // Descontar inventario de stock
        for (const item of cart) {
          if (!item.product.id.startsWith("manual-") && !item.product.id.startsWith("temp-")) {
            const currentStock = item.product.stock_current ?? 0;
            const nextStock = Math.max(0, Number((currentStock - item.quantity).toFixed(3)));
            try {
              await productsService.updateStock(tenantId, item.product.id, nextStock);
            } catch (err) {
              console.warn("No se pudo actualizar stock en retiro de empleado:", err);
            }
          }
        }

        toast.success(
          `Retiro registrado por ${currency.format(totalAmount)}. Se cargó a la cuenta corriente de ${employee.full_name}.`
        );
        setCart([]);
        setCustomNotes("");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDropdownOpen = isSearchFocused && search.trim().length > 0;

  return (
    <>
      <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-5xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden dark:bg-slate-900 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shrink-0">
                <ShoppingBag size={18} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Registrar Retiro de Productos
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              Empleado: <strong className="text-slate-700 dark:text-slate-200">{employee.full_name}</strong> • Saldo adeudado: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currency.format(employee.current_balance ?? 0)}</span>
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        {/* Buscador Único Superior con Autocomplete y Lector Activo */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/70 shrink-0">
          <div ref={searchContainerRef} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                data-scanner-capture="true"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar producto por nombre o código (o escanear)..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-14 sm:pr-28 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent font-medium shadow-2xs"
              />

              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
                {search.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setIsSearchFocused(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                ) : null}
                <span
                  className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-none"
                  title="Lector de código de barras activo"
                >
                  <Barcode size={12} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden sm:inline">Lector activo</span>
                </span>
              </div>

              {/* Dropdown de Resultados cuando se tipea */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 max-h-72 overflow-y-auto space-y-1 animate-in fade-in duration-100">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        No se encontraron productos para &quot;{search.trim()}&quot;
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickProductInitialName(search.trim());
                          setIsSearchFocused(false);
                          setIsQuickProductModalOpen(true);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Cargar &quot;{search.trim()}&quot; como no registrado</span>
                      </button>
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          addToCart(p);
                          setSearch("");
                          setIsSearchFocused(false);
                          toast.success(`"${p.name}" agregado`);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {primaryBarcodes[p.id] || p.code || "Sin código"}
                            {p.brand ? ` • ${p.brand}` : ""}
                            {p.stock_current != null ? ` • Stock: ${p.stock_current}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {currency.format(p.price)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs">
                            <Plus size={12} />
                            Agregar
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickProductInitialName(search.trim());
                setIsQuickProductModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 px-3.5 py-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer shrink-0 shadow-2xs w-full sm:w-auto"
              title="Cargar producto no registrado en el catálogo"
            >
              <Plus size={15} />
              <span>No registrado</span>
            </button>
          </div>
        </div>

        {/* Formulario Principal con Scroll Interno y Footer Fijo */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Área con scroll para Carrito y Detalle */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
              {/* Columna Izquierda: Carrito de Retiro */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Carrito de Retiro
                    </h4>
                    <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      {cart.length} {cart.length === 1 ? "producto" : "productos"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                    Tildá o destildá el descuento en cada ítem
                  </span>
                </div>

                {isLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    Cargando catálogo...
                  </div>
                ) : cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <ShoppingBag size={22} />
                    </div>
                    <p className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                      El carrito de retiro está vacío
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      Buscá en el campo superior o escaneá con el lector para cargar productos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] sm:max-h-[420px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border p-3 transition shadow-2xs ${
                          item.applyDiscount
                            ? "border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        }`}
                      >
                        {/* Checkbox de Descuento de Empleado e Información */}
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                          <label
                            className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 mt-0.5 sm:mt-0"
                            title={
                              item.applyDiscount
                                ? "Desmarcar para cobrar a precio regular sin descuento"
                                : "Marcar para aplicar descuento de empleado"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={item.applyDiscount}
                              onChange={() => toggleItemDiscount(item.product.id)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                                item.applyDiscount
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <Tag size={10} />
                              {item.applyDiscount ? `${discountPercent}% OFF` : "Sin desc."}
                            </span>
                          </label>

                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {item.product.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              {currency.format(item.product.price)}{" "}
                              {item.product.sale_mode === "weight" ? "/kg" : "c/u"}
                              {item.product.stock_current != null ? ` • Stock: ${item.product.stock_current}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Controles de Cantidad, Subtotal y Quitar */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t border-slate-100 dark:border-slate-800 sm:border-0">
                          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="h-6 w-6 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                              title="Disminuir cantidad"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={item.quantity}
                              onChange={(e) => setItemExactQuantity(item.product.id, parseFloat(e.target.value))}
                              className="w-12 text-center text-xs font-bold font-mono bg-transparent outline-none text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="h-6 w-6 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span className="min-w-16 sm:w-20 text-right font-bold text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100">
                            {currency.format(item.product.price * item.quantity)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="!rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Quitar producto"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna Derecha: Detalle del Importe y Nota */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-4 space-y-3.5 shadow-xs">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Detalle del Importe
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Cta. Cte. Empleados
                  </span>
                </div>

                {/* Desglose de Importes */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal productos:</span>
                    <span className="font-semibold font-mono text-slate-900 dark:text-slate-200">
                      {currency.format(subtotalGross)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pl-2 border-l-2 border-indigo-400 dark:border-indigo-600">
                    <span>• Con descuento ({cart.filter((i) => i.applyDiscount).length} ítems):</span>
                    <span className="font-mono">{currency.format(eligibleSubtotal)}</span>
                  </div>

                  {nonEligibleSubtotal > 0 && (
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-[11px] pl-2 border-l-2 border-amber-400 dark:border-amber-700">
                      <span>• Sin descuento ({cart.filter((i) => !i.applyDiscount).length} ítems):</span>
                      <span className="font-mono font-semibold">{currency.format(nonEligibleSubtotal)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Tag size={13} />
                      <span className="font-semibold">Descuento aplicado:</span>
                      <span
                        className="inline-flex items-center rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[11px] font-bold font-mono text-emerald-800 dark:text-emerald-300 shadow-2xs"
                        title="Porcentaje fijo establecido en Configuración"
                      >
                        {discountPercent}% OFF
                      </span>
                    </div>
                    <span className="font-bold font-mono">-{currency.format(discountAmount)}</span>
                  </div>
                </div>

                {/* Campo de Notas */}
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Nota o motivo del retiro (opcional):
                  </label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Ej: almuerzo de turno, adelanto mercadería..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Fijo / Sticky en la base del Modal */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-4">
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total a Cargar:
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                  Cta. corriente ({cart.length} {cart.length === 1 ? "ítem" : "ítems"})
                </p>
              </div>
              <span className="text-xl sm:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                {currency.format(totalAmount)}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                <ShoppingBag size={15} />
                <span>{isSubmitting ? "Registrando..." : "Confirmar Retiro"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>

      {isQuickProductModalOpen && (
        <PosQuickProductModal
          open={isQuickProductModalOpen}
          categories={categories}
          onClose={() => setIsQuickProductModalOpen(false)}
          initialName={quickProductInitialName}
          title="Registrar producto no registrado"
          subtitle="Cargá los datos del producto para agregarlo al retiro del empleado."
          saleOnlyLabel="Solo para este momento"
          saleOnlyDescription="No se guarda en el catálogo de productos ni descuenta stock."
          catalogLabel="Registrar en el sistema y guardar producto nuevo"
          catalogDescription="Crea el producto en el catálogo y queda disponible para futuras ventas o retiros."
          submitButtonText="Agregar al retiro"
          onAddManual={handleAddManualProduct}
          onCreateAndAdd={handleCreateAndAddProduct}
        />
      )}
    </>
  );
};
