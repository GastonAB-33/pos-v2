import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Info,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  storefrontService,
  type StorefrontData,
  type StorefrontProduct,
} from "@/services/storefront.service";
import type { StoreOrderItem } from "@/types/entities";
import { cn } from "@/utils/cn";
import { cleanPhoneForWhatsApp } from "@/utils/whatsapp-voucher.utils";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const StorefrontPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState<StorefrontData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Carrito de compras
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Formulario de Checkout
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"takeaway" | "delivery">("takeaway");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: number;
    whatsappUrl: string;
  } | null>(null);

  // Cargar datos de la tienda
  useEffect(() => {
    let isMounted = true;
    async function loadStore() {
      if (!tenantSlug) {
        setErrorMessage("Identificador de tienda no especificado");
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);

      const res = await storefrontService.getStorefrontData(tenantSlug);
      if (!isMounted) return;

      if (!res.success) {
        setErrorMessage(res.error || "No se pudo cargar la tienda");
      } else {
        setStoreData(res);
        // Preconfigurar delivery mode según la política del comercio
        const dm = res.settings?.delivery_mode;
        if (dm === "delivery_only") {
          setDeliveryMode("delivery");
        } else {
          setDeliveryMode("takeaway");
        }
      }
      setLoading(false);
    }

    void loadStore();
    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  const settings = storeData?.settings;
  const business = storeData?.business;
  const tenant = storeData?.tenant;
  const allProducts = storeData?.products || [];
  const isCustomListsMode = settings?.navigation_mode === "lists";
  const customLists = useMemo(() => settings?.custom_lists || [], [settings?.custom_lists]);

  const visibleCatalogProducts = useMemo(() => {
    if (isCustomListsMode && settings?.only_show_listed_products) {
      const listedIds = new Set(customLists.flatMap((l) => l.product_ids));
      return allProducts.filter((p) => listedIds.has(p.id));
    }
    return allProducts;
  }, [allProducts, isCustomListsMode, settings?.only_show_listed_products, customLists]);

  // Pestañas / Categorías dinámicas (o Listas Personalizadas)
  const availableTabs = useMemo(() => {
    if (isCustomListsMode) {
      return customLists.map((l) => ({
        id: l.id,
        label: l.name,
      }));
    }

    if (!storeData?.categories || storeData.categories.length === 0) return [];
    const cats =
      settings?.categories_mode === "custom" && settings.featured_categories?.length
        ? settings.featured_categories.filter((c) => storeData.categories?.includes(c))
        : storeData.categories;
    return cats.map((c) => ({ id: c, label: c }));
  }, [
    isCustomListsMode,
    customLists,
    storeData?.categories,
    settings?.categories_mode,
    settings?.featured_categories,
  ]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeList =
      isCustomListsMode && selectedCategory !== "all" && selectedCategory !== "featured"
        ? customLists.find((l) => l.id === selectedCategory)
        : null;
    const activeListSet = activeList ? new Set(activeList.product_ids) : null;

    return visibleCatalogProducts.filter((p) => {
      // Regla de stock: si hide_out_of_stock está activo y stock <= 0, ocultar
      if (settings?.hide_out_of_stock && p.stock_current <= 0) {
        return false;
      }

      // Filtro de pestaña (Ofertas, Lista Personalizada o Categoría)
      if (selectedCategory === "featured") {
        if (!p.is_featured_web) return false;
      } else if (selectedCategory !== "all") {
        if (isCustomListsMode) {
          if (!activeListSet || !activeListSet.has(p.id)) return false;
        } else {
          if (p.category !== selectedCategory) return false;
        }
      }

      // Filtro de búsqueda
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBrand = p.brand?.toLowerCase().includes(q);
        const matchesCode = p.code?.toLowerCase().includes(q);
        const matchesCat = p.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesCode && !matchesCat) return false;
      }

      return true;
    });
  }, [
    visibleCatalogProducts,
    searchQuery,
    selectedCategory,
    settings?.hide_out_of_stock,
    isCustomListsMode,
    customLists,
  ]);

  // Ítems del carrito
  const cartItems = useMemo<StoreOrderItem[]>(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = allProducts.find((p) => p.id === productId);
        if (!product || quantity <= 0) return null;
        return {
          product_id: product.id,
          name: product.name,
          quantity,
          unit_price: product.price,
          subtotal: product.price * quantity,
          sale_mode: product.sale_mode,
          image_url: product.image_url,
        };
      })
      .filter(Boolean) as StoreOrderItem[];
  }, [cart, allProducts]);

  const cartTotalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cartItems]);

  // Cálculo de costo de envío
  const deliveryCost = useMemo(() => {
    if (deliveryMode !== "delivery") return 0;
    if (settings?.delivery_cost_type === "free") return 0;
    if (
      settings?.delivery_free_threshold &&
      settings.delivery_free_threshold > 0 &&
      cartSubtotal >= settings.delivery_free_threshold
    ) {
      return 0;
    }
    return settings?.delivery_cost_amount || 0;
  }, [deliveryMode, settings, cartSubtotal]);

  const isDeliveryFreeByThreshold = useMemo(() => {
    return (
      deliveryMode === "delivery" &&
      Boolean(
        settings?.delivery_free_threshold &&
          settings.delivery_free_threshold > 0 &&
          cartSubtotal >= settings.delivery_free_threshold
      )
    );
  }, [deliveryMode, settings, cartSubtotal]);

  const cartTotal = cartSubtotal + deliveryCost;

  // Cálculo de Seña / Pago Previo
  const downPaymentRequired = useMemo(() => {
    if (!settings?.down_payment_policy || settings.down_payment_policy === "none") {
      return 0;
    }
    if (settings.down_payment_policy === "full_100") {
      return cartTotal;
    }
    if (settings.down_payment_policy === "partial_percent") {
      const pct = settings.down_payment_percent || 50;
      return Math.round((cartTotal * pct) / 100);
    }
    return 0;
  }, [cartTotal, settings]);

  const remainingBalance = cartTotal - downPaymentRequired;

  // Manipulación del carrito
  const handleAddToCart = (product: StorefrontProduct) => {
    setCart((prev) => {
      const current = prev[product.id] || 0;
      return { ...prev, [product.id]: current + 1 };
    });
  };

  const handleDecreaseQuantity = (productId: string) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: current - 1 };
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Copiar alias al portapapeles
  const handleCopyAlias = (alias: string) => {
    if (!alias) return;
    navigator.clipboard.writeText(alias);
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2500);
  };

  // Enviar Pedido
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || cartItems.length === 0) return;

    if (!customerName.trim()) {
      alert("Por favor ingresá tu nombre completo");
      return;
    }

    if (!customerPhone.trim()) {
      alert("Por favor ingresá tu número de teléfono de WhatsApp");
      return;
    }

    if (deliveryMode === "delivery" && !addressStreet.trim()) {
      alert("Por favor ingresá la dirección de entrega");
      return;
    }

    // Verificar monto mínimo de envío
    if (
      deliveryMode === "delivery" &&
      settings?.delivery_min_order &&
      settings.delivery_min_order > 0 &&
      cartSubtotal < settings.delivery_min_order
    ) {
      alert(
        `El monto mínimo para envíos a domicilio es de ${currency.format(
          settings.delivery_min_order
        )}. Te faltan ${currency.format(settings.delivery_min_order - cartSubtotal)}.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Guardar en base de datos
      const res = await storefrontService.submitStoreOrder({
        tenantSlug: tenantSlug!,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress:
          deliveryMode === "delivery"
            ? `${addressStreet.trim()}${addressNotes.trim() ? ` (${addressNotes.trim()})` : ""}`
            : undefined,
        deliveryMode,
        deliveryCost,
        subtotal: cartSubtotal,
        total: cartTotal,
        downPaymentRequired,
        remainingBalance,
        items: cartItems,
        notes: orderNotes.trim() || undefined,
      });

      const orderNumber = res.order_number || Math.floor(100 + Math.random() * 900);

      // 2. Construir mensaje de WhatsApp
      const storePhoneRaw =
        settings?.whatsapp_phone || business?.phone || "5491100000000";
      const cleanStorePhone = cleanPhoneForWhatsApp(storePhoneRaw);

      let waText = `🛍️ *NUEVO PEDIDO WEB #${orderNumber}*\n`;
      waText += `*${tenant?.trade_name || "Mi Tienda"}*\n`;
      waText += `══════════════════════\n`;
      waText += `👤 *Cliente:* ${customerName.trim()}\n`;
      waText += `📱 *Teléfono:* ${customerPhone.trim()}\n`;
      waText += `📦 *Modalidad:* ${
        deliveryMode === "takeaway" ? "Retiro en el local" : "Envío a domicilio"
      }\n`;
      if (deliveryMode === "delivery") {
        waText += `📍 *Dirección:* ${addressStreet.trim()}${
          addressNotes.trim() ? ` (${addressNotes.trim()})` : ""
        }\n`;
      }
      waText += `══════════════════════\n\n`;
      waText += `🛒 *DETALLE DEL PEDIDO:*\n`;

      for (const it of cartItems) {
        const unit = it.sale_mode === "weight" ? "kg" : "u.";
        waText += `• ${it.quantity} ${unit} x *${it.name}* → ${currency.format(
          it.subtotal
        )}\n`;
      }

      waText += `\n──────────────────────\n`;
      waText += `Subtotal productos: ${currency.format(cartSubtotal)}\n`;
      if (deliveryMode === "delivery") {
        if (deliveryCost === 0) {
          waText += `Costo de envío: *GRATIS*\n`;
        } else {
          waText += `Costo de envío: ${currency.format(deliveryCost)}\n`;
        }
      }
      waText += `💰 *TOTAL FINAL: ${currency.format(cartTotal)}*\n`;
      waText += `──────────────────────\n`;

      // Política de pago / Seña
      if (downPaymentRequired > 0) {
        waText += `\n⚠️ *CONDICIONES DE PREPARACIÓN:*\n`;
        if (settings?.down_payment_policy === "full_100") {
          waText += `Se requiere abonar el *100% por adelantado* (${currency.format(
            downPaymentRequired
          )}) para iniciar la preparación.\n`;
        } else {
          waText += `Seña previa para iniciar pedido (${settings?.down_payment_percent || 50}%): *${currency.format(
            downPaymentRequired
          )}*\n`;
          waText += `Saldo a abonar contra entrega: *${currency.format(
            remainingBalance
          )}*\n`;
        }
        if (settings?.bank_alias) {
          waText += `\n🏦 *Datos para transferir seña:*\n`;
          waText += `• *Alias:* ${settings.bank_alias}\n`;
          if (settings.bank_name) waText += `• *Banco:* ${settings.bank_name}\n`;
          if (settings.bank_account_holder)
            waText += `• *Titular:* ${settings.bank_account_holder}\n`;
          if (settings.bank_cbu) waText += `• *CBU/CVU:* ${settings.bank_cbu}\n`;
          waText += `\n*(Adjunto a continuación el comprobante de transferencia)*\n`;
        }
      } else {
        waText += `\n💵 *Forma de pago:* Se abona contra entrega/retiro.\n`;
      }

      if (orderNotes.trim()) {
        waText += `\n📝 *Aclaraciones:* ${orderNotes.trim()}\n`;
      }

      const encodedMsg = encodeURIComponent(waText);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanStorePhone}&text=${encodedMsg}`;

      setCompletedOrder({ orderNumber, whatsappUrl });
      setCart({});

      // Abrir WhatsApp automáticamente
      window.open(whatsappUrl, "_blank");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Cargando catálogo de la tienda...
        </p>
      </div>
    );
  }

  if (errorMessage || !storeData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mb-4">
          <Store size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Tienda no disponible
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
          {errorMessage || "No se pudo encontrar el catálogo solicitado."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50/80 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 pb-28">
      {/* 1. Header del Comercio */}
      <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {(settings?.logo_url || tenant?.logo_url) ? (
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800">
                <img
                  src={settings?.logo_url || tenant?.logo_url || ""}
                  alt={tenant?.trade_name || "Logo"}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-lg shadow-sm">
                {(tenant?.trade_name || "T")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-snug truncate">
                {settings?.store_name || tenant?.trade_name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {settings?.store_description || "Catálogo y pedidos online"}
              </p>
            </div>
          </div>

          {/* Botón flotante superior del Carrito */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-md transition-all active:scale-95 shrink-0"
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">Mi Pedido</span>
            {cartTotalItemsCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[11px] font-black shadow-xs">
                {cartTotalItemsCount}
              </span>
            )}
          </button>
        </div>

        {/* 2. Buscador y Pestañas Dinámicas */}
        <div className="max-w-6xl mx-auto px-4 pb-3 space-y-2.5">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por producto, marca o rubro..."
              className="w-full pl-10 pr-9 py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Pestañas de Categorías Dinámicas (Scroll Horizontal) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
              )}
            >
              Todos ({visibleCatalogProducts.length})
            </button>

            {visibleCatalogProducts.some((p) => p.is_featured_web) && (
              <button
                type="button"
                onClick={() => setSelectedCategory("featured")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedCategory === "featured"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200/90 dark:bg-slate-800 dark:text-amber-300 dark:border-amber-800/60"
                )}
              >
                <Sparkles size={12} />
                <span>Ofertas</span>
              </button>
            )}

            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedCategory === tab.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 3. Banner de Portada (si está cargado) + Info del Local */}
      {settings?.banner_url && (
        <section className="max-w-6xl mx-auto px-4 mt-3">
          <div className="h-32 sm:h-48 w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <img
              src={settings.banner_url}
              alt={settings.store_name || tenant?.trade_name || "Banner"}
              className="h-full w-full object-cover"
            />
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 mt-3">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-300">
          {/* Horario */}
          {settings?.schedule_text && (
            <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-slate-200 dark:border-slate-800">
              <Clock size={13} className="text-blue-500" />
              <span>{settings.schedule_text}</span>
            </div>
          )}

          {/* Modalidad de entrega */}
          <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-slate-200 dark:border-slate-800">
            <Truck size={13} className="text-emerald-500" />
            <span>
              {settings?.delivery_mode === "takeaway_only"
                ? "Solo retiro por el local"
                : settings?.delivery_mode === "delivery_only"
                ? "Envíos a domicilio"
                : "Retiro en local o envíos a domicilio"}
            </span>
          </div>

          {/* Seña previa */}
          {settings?.down_payment_policy && settings.down_payment_policy !== "none" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Info size={13} className="text-amber-500" />
              <span>
                {settings.down_payment_policy === "full_100"
                  ? "Pago 100% previo para iniciar preparación"
                  : `Seña del ${settings.down_payment_percent || 50}% para armar pedido`}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 4. Grilla de Productos */}
      <main className="max-w-6xl mx-auto px-4 mt-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No se encontraron productos
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Probá cambiando la categoría o usando otras palabras en el buscador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map((prod) => {
              const qtyInCart = cart[prod.id] || 0;
              const isOutOfStock = prod.stock_current <= 0;

              return (
                <article
                  key={prod.id}
                  className="flex flex-col justify-between min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    {/* Contenedor de Fotografía */}
                    <div className="relative mb-2.5 flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/60">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="h-full w-full object-contain transition-transform hover:scale-105 duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {prod.category}
                        </span>
                      )}

                      {prod.is_featured_web && (
                        <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-950 shadow-xs">
                          ★ Oferta
                        </span>
                      )}

                      {isOutOfStock && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-rose-600/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          Agotado
                        </span>
                      )}
                    </div>

                    {/* Categoría y Título */}
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                      {prod.category}
                    </p>
                    <h4
                      className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2"
                      title={prod.name}
                    >
                      {prod.name}
                    </h4>
                  </div>

                  {/* Precio y Botón de Agregar */}
                  <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-1 min-w-0">
                    <div className="min-w-0">
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate block">
                        {currency.format(prod.price)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 block -mt-0.5">
                        / {prod.sale_mode === "weight" ? "kg" : "u."}
                      </span>
                    </div>

                    {/* Controles de cantidad */}
                    {isOutOfStock && !settings?.allow_out_of_stock_orders ? (
                      <span className="w-full sm:w-auto text-center text-[10.5px] font-bold text-rose-500 py-1.5 px-2 rounded-xl bg-rose-50 dark:bg-rose-950/40">
                        Agotado
                      </span>
                    ) : qtyInCart > 0 ? (
                      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 p-1 sm:p-0.5">
                        <button
                          type="button"
                          onClick={() => handleDecreaseQuantity(prod.id)}
                          className="h-7 w-7 sm:h-6 sm:w-6 rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shadow-2xs hover:bg-slate-100 active:scale-95"
                          title="Restar uno"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 sm:w-5 text-center text-xs font-black text-blue-900 dark:text-blue-100">
                          {qtyInCart}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(prod)}
                          className="h-7 w-7 sm:h-6 sm:w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-2xs hover:bg-blue-700 active:scale-95"
                          title="Sumar uno"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(prod)}
                        className="w-full sm:w-auto justify-center rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1 shrink-0"
                      >
                        <Plus size={13} />
                        <span>Agregar</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. Barra Flotante Inferior de Carrito (Express Bottom Bar) */}
      {cartTotalItemsCount > 0 && !isCartOpen && (
        <aside className="fixed bottom-3 inset-x-3 sm:max-w-md sm:mx-auto z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between rounded-2xl sm:rounded-3xl bg-blue-600 hover:bg-blue-700 text-white p-3.5 sm:p-4 shadow-2xl transition-all active:scale-[0.98] cursor-pointer ring-4 ring-blue-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-sm">
                {cartTotalItemsCount}
              </div>
              <div className="text-left">
                <span className="text-[11px] uppercase tracking-wider font-semibold opacity-90 block">
                  Ver mi pedido
                </span>
                <span className="text-base font-black">
                  {currency.format(cartSubtotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold bg-white/15 px-3 py-1.5 rounded-xl">
              <span>Continuar</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </aside>
      )}

      {/* 6. Modal / Drawer de Checkout Express ("Mi Pedido") */}
      {isCartOpen && (
        <section className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="relative w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 max-h-[92dvh] sm:max-h-[90vh] flex flex-col min-w-0 overflow-hidden">
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-blue-600" size={20} />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Mi Pedido ({cartTotalItemsCount} productos)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            {completedOrder ? (
              /* Pantalla de Confirmación Exitosa */
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                  <Check size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  ¡Pedido #{completedOrder.orderNumber} generado con éxito!
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Se ha preparado el mensaje con tu pedido para WhatsApp. Si no se abrió automáticamente, tocá el botón verde abajo.
                </p>
                <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
                  <a
                    href={completedOrder.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 text-sm shadow-md transition"
                  >
                    Abrir WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedOrder(null);
                      setIsCartOpen(false);
                    }}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Seguir navegando
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto min-h-0 pt-3 pr-1 space-y-4">
                {/* Lista de productos seleccionados */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.image_url ? (
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white p-0.5 dark:border-slate-800">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.quantity} {item.sale_mode === "weight" ? "kg" : "u."} x{" "}
                            {currency.format(item.unit_price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {currency.format(item.subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product_id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Eliminar del pedido"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paso 1: Modalidad de Entrega */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 space-y-2.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Forma de Entrega
                  </span>

                  {settings?.delivery_mode === "both" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("takeaway")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          deliveryMode === "takeaway"
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 ring-2 ring-blue-500/30"
                            : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        )}
                      >
                        <Store size={14} />
                        <span>Retiro en local</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryMode("delivery")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          deliveryMode === "delivery"
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 ring-2 ring-blue-500/30"
                            : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        )}
                      >
                        <Truck size={14} />
                        <span>Envío a domicilio</span>
                      </button>
                    </div>
                  ) : settings?.delivery_mode === "delivery_only" ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Truck size={14} className="text-blue-500" />
                      <span>Solo envíos a domicilio</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Store size={14} className="text-blue-500" />
                      <span>
                        Retiro en el local:{" "}
                        <strong>
                          {settings?.takeaway_address || business?.address || "A coordinar"}
                        </strong>
                      </span>
                    </div>
                  )}

                  {/* Campos si es envío a domicilio */}
                  {deliveryMode === "delivery" && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                          Dirección de entrega (Calle y altura) *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressStreet}
                          onChange={(e) => setAddressStreet(e.target.value)}
                          placeholder="Ej: Av. San Martín 1420"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                          Piso, Depto, Barrio o Referencias (Opcional)
                        </label>
                        <input
                          type="text"
                          value={addressNotes}
                          onChange={(e) => setAddressNotes(e.target.value)}
                          placeholder="Ej: Piso 2 B / Portón negro frente a la plaza"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>

                      {isDeliveryFreeByThreshold ? (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ ¡Tu pedido califica para envío gratis!
                        </p>
                      ) : deliveryCost > 0 ? (
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Costo estimado de envío: <strong>{currency.format(deliveryCost)}</strong>
                        </p>
                      ) : settings?.delivery_zones_notes ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Zona de cobertura: {settings.delivery_zones_notes}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Paso 2: Política de Seña / Pago Previo */}
                {downPaymentRequired > 0 && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/80 dark:bg-blue-950/50 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">
                          {settings?.down_payment_policy === "full_100"
                            ? "Pago Total Obligatorio para Iniciar Preparación"
                            : `Seña Requerida (${settings?.down_payment_percent || 50}%) para Iniciar Preparación`}
                        </span>
                        <p className="text-[11px] text-blue-900/80 dark:text-blue-300 mt-0.5">
                          Para comenzar a armar tu pedido, el comercio solicita una seña previa de{" "}
                          <strong>{currency.format(downPaymentRequired)}</strong>. El resto se abona al entregar.
                        </p>
                      </div>
                    </div>

                    {/* Datos bancarios del comercio para transferir la seña */}
                    {settings?.bank_alias && (
                      <div className="rounded-xl border border-blue-200/90 bg-white p-2.5 dark:border-blue-800 dark:bg-slate-900 flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Alias para transferir seña
                          </span>
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                            {settings.bank_alias}
                          </span>
                          {settings.bank_name && (
                            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block">
                              {settings.bank_name}{" "}
                              {settings.bank_account_holder ? `· Titular: ${settings.bank_account_holder}` : ""}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyAlias(settings.bank_alias)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                        >
                          {copiedAlias ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-600">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Paso 3: Datos de Contacto del Comprador */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Tu Nombre Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Tu Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej: 11 2345-6789"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Aclaraciones o indicaciones (Opcional)
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ej: Si no hay marca X, reemplazá por Y..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
                </div>

                {/* Footer fijo: Desglose de Totales + Botón WhatsApp */}
                <div className="shrink-0 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Subtotal</span>
                      <span>{currency.format(cartSubtotal)}</span>
                    </div>
                    {deliveryMode === "delivery" && (
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Costo de envío</span>
                        <span>{deliveryCost === 0 ? "GRATIS" : currency.format(deliveryCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 dark:text-slate-100 pt-1">
                      <span>Total del Pedido</span>
                      <span>{currency.format(cartTotal)}</span>
                    </div>

                    {downPaymentRequired > 0 && (
                      <div className="flex justify-between text-xs font-bold text-blue-700 dark:text-blue-300 pt-1">
                        <span>Seña para iniciar preparación:</span>
                        <span>{currency.format(downPaymentRequired)}</span>
                      </div>
                    )}
                  </div>

                  {/* Botón de Confirmación por WhatsApp */}
                  <button
                    type="submit"
                    disabled={isSubmitting || cartItems.length === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Phone size={16} />
                    <span>
                      {isSubmitting ? "Generando pedido..." : "Confirmar y Enviar por WhatsApp"}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
