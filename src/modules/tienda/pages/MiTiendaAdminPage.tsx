import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  ExternalLink,
  FolderPlus,
  ImagePlus,
  ListFilter,
  Plus,
  QrCode,
  Save,
  Search,
  Share2,
  ShoppingBag,
  Square,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProductsStore } from "@/features/products/store/products.store";
import { settingsService } from "@/services/settings.service";
import { storeOrdersService } from "@/services/store-orders.service";
import { r2StorageService } from "@/services/r2-storage.service";
import { productsService } from "@/services/products.service";
import type { StoreCatalogList, StoreOrder, StoreSettings } from "@/types/entities";
import { cn } from "@/utils/cn";
import { getTenantSlugFromRecord } from "@/utils/tenant-slug";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const MiTiendaAdminPage = () => {
  const tenant = useAuthStore((state) => state.tenant);
  const tenantId = useAuthStore((state) => state.tenantId);
  const products = useProductsStore((state) => state.products);
  const loadCatalog = useProductsStore((state) => state.loadCatalog);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "tabs" | "delivery" | "payment" | "orders">("general");

  // Formulario de Settings
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  // Pedidos Web
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Modal QR
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Gestor de Listas Personalizadas de Tienda
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listModalMode, setListModalMode] = useState<"products" | "categories">("categories");
  const [listModalSearch, setListModalSearch] = useState("");
  const [listModalFilter, setListModalFilter] = useState<"all" | "in_list" | "not_in_list">("all");
  const [catModalSearch, setCatModalSearch] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState<"logo" | "banner" | null>(null);

  // Cargar catálogo de productos si no está en memoria
  useEffect(() => {
    if (tenantId && products.length === 0) {
      void loadCatalog(tenantId);
    }
  }, [tenantId, products.length, loadCatalog]);

  // Cargar settings y pedidos
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!tenantId) return;
      setLoading(true);
      try {
        const tenantSettings = await settingsService.getByTenant(tenantId);
        if (isMounted) {
          setSettings(tenantSettings.tienda);
        }
      } catch (err) {
        console.error("Error al cargar configuración de Mi Tienda:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // Cargar pedidos web
  useEffect(() => {
    let isMounted = true;
    async function fetchOrders() {
      if (!tenantId) return;
      setOrdersLoading(true);
      try {
        const list = await storeOrdersService.getByTenant(tenantId);
        if (isMounted) {
          setOrders(list);
        }
      } finally {
        if (isMounted) setOrdersLoading(false);
      }
    }

    if (activeTab === "orders") {
      void fetchOrders();
    }
    return () => {
      isMounted = false;
    };
  }, [tenantId, activeTab]);

  const tenantSlug = useMemo(() => {
    if (!tenant) return "";
    return getTenantSlugFromRecord(tenant);
  }, [tenant]);

  const publicStoreUrl = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/tienda/${tenantSlug}`;
  }, [tenantSlug]);

  // Métricas
  const publishedCount = useMemo(() => {
    return products.filter((p) => p.is_published_web !== false && p.is_active).length;
  }, [products]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();
  }, [products]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of products) {
      if (p.is_active === false || p.is_published_web === false) continue;
      const cat = p.category || "General";
      const arr = map.get(cat) || [];
      arr.push(p.id);
      map.set(cat, arr);
    }
    return Array.from(map.entries())
      .map(([name, productIds]) => ({ name, productIds }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const customLists = useMemo(() => settings?.custom_lists || [], [settings]);

  const editingList = useMemo(
    () => customLists.find((l) => l.id === editingListId) || null,
    [customLists, editingListId]
  );

  const handleCreateList = (nameInput?: string) => {
    if (!settings) return;
    const trimmed = (nameInput ?? newListName).trim();
    if (!trimmed) return;
    const exists = customLists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    const nextList: StoreCatalogList = {
      id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      product_ids: [],
    };
    setSettings({
      ...settings,
      navigation_mode: "lists",
      custom_lists: [...customLists, nextList],
    });
    if (!nameInput) setNewListName("");
  };

  const handleDeleteList = (listId: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      custom_lists: customLists.filter((l) => l.id !== listId),
    });
    if (editingListId === listId) setEditingListId(null);
  };

  const handleMoveList = (index: number, direction: -1 | 1) => {
    if (!settings) return;
    const target = index + direction;
    if (target < 0 || target >= customLists.length) return;
    const copy = [...customLists];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setSettings({ ...settings, custom_lists: copy });
  };

  const handleToggleProductInList = (listId: string, productId: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      custom_lists: customLists.map((l) => {
        if (l.id !== listId) return l;
        const has = l.product_ids.includes(productId);
        return {
          ...l,
          product_ids: has
            ? l.product_ids.filter((id) => id !== productId)
            : [...l.product_ids, productId],
        };
      }),
    });
  };

  const handleBulkSetProductsInList = (listId: string, productIds: string[], action: "add" | "remove") => {
    if (!settings) return;
    setSettings({
      ...settings,
      custom_lists: customLists.map((l) => {
        if (l.id !== listId) return l;
        const currentSet = new Set(l.product_ids);
        if (action === "add") {
          productIds.forEach((id) => currentSet.add(id));
        } else {
          productIds.forEach((id) => currentSet.delete(id));
        }
        return { ...l, product_ids: Array.from(currentSet) };
      }),
    });
  };

  // Copiar enlace
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicStoreUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Guardar configuración
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !settings || saving) return;

    setSaving(true);
    setFeedback(null);
    try {
      await settingsService.updateSection(tenantId, "tienda", settings);
      setFeedback({ type: "success", message: "Configuración de Mi Tienda guardada con éxito." });
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar la configuración. Intentá nuevamente." });
    } finally {
      setSaving(false);
    }
  };

  // Subir Logo o Banner de Mi Tienda a Cloudflare R2 (con fallback a Supabase Storage)
  const handleStoreAssetUpload = async (
    kind: "logo" | "banner",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !tenantId || !settings) return;

    setUploadingAsset(kind);
    setFeedback(null);
    try {
      let url = await r2StorageService.uploadImage("tienda", file);
      if (!url) {
        url = await productsService.uploadProductImage(tenantId, `store-${kind}`, file);
      }
      setSettings({
        ...settings,
        [kind === "logo" ? "logo_url" : "banner_url"]: url,
      });
      setFeedback({
        type: "success",
        message: `${kind === "logo" ? "Logo" : "Banner"} subido. Recordá presionar "Guardar configuración".`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: `No se pudo subir el ${kind === "logo" ? "logo" : "banner"}.`,
      });
    } finally {
      setUploadingAsset(null);
    }
  };

  // Cambiar estado de pedido
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: StoreOrder["order_status"]
  ) => {
    if (!tenantId) return;
    const ok = await storeOrdersService.updateStatus(tenantId, orderId, status);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, order_status: status } : o))
      );
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Cargando panel de Mi Tienda...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header con Estado y Enlace Público */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Store size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Mi Tienda Online
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                    settings.is_enabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      settings.is_enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    )}
                  />
                  <span>{settings.is_enabled ? "Activa y pública" : "Pausada"}</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                Catálogo web interactivo con pedidos directos al WhatsApp de tu negocio.
              </p>
            </div>
          </div>

          {/* Botones de acción del enlace */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
            >
              {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copiedLink ? "Enlace copiado" : "Copiar enlace"}</span>
            </button>

            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <span>Ver mi tienda</span>
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              title="Cartel QR para el mostrador"
            >
              <QrCode size={14} />
              <span className="hidden sm:inline">Cartel QR</span>
            </button>
          </div>
        </div>

        {/* Caja del link compartido */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Share2 size={14} className="text-blue-500 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 shrink-0">Tu link público:</span>
            <code className="font-mono font-bold text-blue-600 dark:text-sky-400 truncate">
              {publicStoreUrl}
            </code>
          </div>
        </div>
      </section>

      {/* 2. Métricas Rápidas */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Productos Publicados
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {publishedCount}{" "}
            <span className="text-xs font-normal text-slate-400">/ {products.length}</span>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Rubros / Categorías
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {availableCategories.length}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Pedidos Recibidos
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {orders.length}
          </span>
        </div>
      </section>

      {/* 3. Pestañas de Configuración */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Barra de pestañas */}
        <div className="flex border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar p-1.5 sm:p-2 gap-1 bg-slate-50/60 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "general"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            1. Marca y Contacto
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tabs")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "tabs"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            2. Pestañas / Rubros
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivery")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "delivery"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            3. Entregas y Envíos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payment")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "payment"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            4. Seña y Pagos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              activeTab === "orders"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <span>5. Pedidos Web</span>
            {orders.filter((o) => o.order_status === "new").length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-black">
                {orders.filter((o) => o.order_status === "new").length}
              </span>
            )}
          </button>
        </div>

        {/* Formulario de Configuración */}
        {activeTab !== "orders" ? (
          <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 space-y-6">
            {feedback && (
              <div
                className={cn(
                  "p-3 rounded-xl text-xs font-semibold flex items-center gap-2",
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900"
                    : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900"
                )}
              >
                {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* TAB 1: General & Marca */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                      Activar Tienda Online
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Permite que tus clientes vean tu catálogo y hagan pedidos por la web.
                    </span>
                  </div>
                  <label className="relative inline-flex h-6 w-11 shrink-0 items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_enabled}
                      onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 dark:bg-slate-700" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Nombre público de tu tienda
                    </label>
                    <input
                      type="text"
                      value={settings.store_name}
                      onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                      placeholder={tenant?.tradeName || tenant?.legalName || "Mi Negocio"}
                      className="ui-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Número de WhatsApp para recibir pedidos *
                    </label>
                    <input
                      type="tel"
                      value={settings.whatsapp_phone}
                      onChange={(e) => setSettings({ ...settings, whatsapp_phone: e.target.value })}
                      placeholder="Ej: 5491123456789"
                      className="ui-input w-full text-xs"
                      required
                    />
                    <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                      Con código de país y área (ej: 549 + código sin 0 ni 15).
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Descripción corta o slogan
                  </label>
                  <input
                    type="text"
                    value={settings.store_description}
                    onChange={(e) => setSettings({ ...settings, store_description: e.target.value })}
                    placeholder="Ej: Ferretería, bazar y corralón con envíos en el día"
                    className="ui-input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Horario de atención al público
                    </label>
                    <input
                      type="text"
                      value={settings.schedule_text}
                      onChange={(e) => setSettings({ ...settings, schedule_text: e.target.value })}
                      placeholder="Ej: Lunes a Sábados de 08:30 a 20:30 hs"
                      className="ui-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Instagram comercial (Opcional)
                    </label>
                    <input
                      type="text"
                      value={settings.social_instagram}
                      onChange={(e) => setSettings({ ...settings, social_instagram: e.target.value })}
                      placeholder="Ej: @la25ferreteria"
                      className="ui-input w-full text-xs"
                    />
                  </div>
                </div>

                {/* Logo y Banner de Portada (Alojados en CDN R2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden flex items-center justify-center p-1">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <Store size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Logo de tu tienda
                      </span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <label className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50">
                          <ImagePlus size={12} />
                          <span>{uploadingAsset === "logo" ? "Subiendo..." : "Subir logo"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingAsset !== null}
                            onChange={(e) => handleStoreAssetUpload("logo", e)}
                          />
                        </label>
                        {settings.logo_url && (
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, logo_url: null })}
                            className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 flex items-center gap-3">
                    <div className="h-14 w-24 shrink-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                      {settings.banner_url ? (
                        <img src={settings.banner_url} alt="Banner" className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Banner de portada (Opcional)
                      </span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <label className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50">
                          <ImagePlus size={12} />
                          <span>{uploadingAsset === "banner" ? "Subiendo..." : "Subir banner"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingAsset !== null}
                            onChange={(e) => handleStoreAssetUpload("banner", e)}
                          />
                        </label>
                        {settings.banner_url && (
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, banner_url: null })}
                            className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Pestañas y Rubros / Listas Personalizadas */}
            {activeTab === "tabs" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Navegación superior de la tienda
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Elegí si querés mostrar las categorías automáticas de tu inventario o crear tus propias Listas Personalizadas (ej: Mercadería, Ferretería, Fiambres, Corralón, Comidas).
                  </p>
                </div>

                {/* Selector de Modo Principal */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <label
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition",
                      (settings.navigation_mode ?? "categories") === "categories"
                        ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    )}
                  >
                    <input
                      type="radio"
                      name="navigation_mode"
                      checked={(settings.navigation_mode ?? "categories") === "categories"}
                      onChange={() => setSettings({ ...settings, navigation_mode: "categories" })}
                      className="mt-1 accent-blue-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Usar Categorías del Inventario
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Muestra en la barra superior las categorías que ya tienen cargadas tus productos.
                      </span>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition",
                      settings.navigation_mode === "lists"
                        ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    )}
                  >
                    <input
                      type="radio"
                      name="navigation_mode"
                      checked={settings.navigation_mode === "lists"}
                      onChange={() => setSettings({ ...settings, navigation_mode: "lists" })}
                      className="mt-1 accent-blue-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Usar Listas Personalizadas (Recomendado)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Creá tus propias pestañas limpias y agrupá productos o categorías internas dentro de cada una.
                      </span>
                    </div>
                  </label>
                </div>

                {/* MODO A: Categorías del Inventario */}
                {(settings.navigation_mode ?? "categories") === "categories" && (
                  <div className="space-y-3 pt-1">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition",
                          settings.categories_mode === "all"
                            ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        )}
                      >
                        <input
                          type="radio"
                          name="categories_mode"
                          checked={settings.categories_mode === "all"}
                          onChange={() => setSettings({ ...settings, categories_mode: "all" })}
                          className="mt-1 accent-blue-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                            Mostrar todas automáticamente
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Crea una pestaña por cada categoría que tenga productos publicados.
                          </span>
                        </div>
                      </label>

                      <label
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition",
                          settings.categories_mode === "custom"
                            ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/80 dark:bg-blue-950/30"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        )}
                      >
                        <input
                          type="radio"
                          name="categories_mode"
                          checked={settings.categories_mode === "custom"}
                          onChange={() => setSettings({ ...settings, categories_mode: "custom" })}
                          className="mt-1 accent-blue-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                            Seleccionar categorías específicas
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Elegí exactamente qué rubros querés que aparezcan arriba.
                          </span>
                        </div>
                      </label>
                    </div>

                    {settings.categories_mode === "custom" && (
                      <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 space-y-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-2">
                          Seleccioná las categorías visibles:
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-1">
                          {availableCategories.map((cat) => {
                            const isSelected = settings.featured_categories?.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  const current = settings.featured_categories || [];
                                  const next = isSelected
                                    ? current.filter((c) => c !== cat)
                                    : [...current, cat];
                                  setSettings({ ...settings, featured_categories: next });
                                }}
                                className={cn(
                                  "rounded-full px-3 py-1.5 text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5",
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                    : "bg-white text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                )}
                              >
                                {isSelected && <Check size={12} />}
                                <span>{cat}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODO B: Listas Personalizadas */}
                {settings.navigation_mode === "lists" && (
                  <div className="space-y-4">
                    {/* Crear Nueva Lista */}
                    <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                        Crear nueva lista de productos
                      </span>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateList();
                            }
                          }}
                          placeholder="Ej: Mercadería, Ferretería, Fiambres, Corralón, Comidas..."
                          className="ui-input flex-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateList()}
                          disabled={!newListName.trim()}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                        >
                          <Plus size={14} />
                          <span>Crear lista</span>
                        </button>
                      </div>

                      {/* Sugerencias rápidas 1-clic */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">
                          Sugerencias rápidas:
                        </span>
                        {["Mercadería", "Bebidas", "Fiambres", "Ferretería", "Corralón", "Comidas", "Bazar", "Regalería"].map(
                          (preset) => {
                            const already = customLists.some(
                              (l) => l.name.toLowerCase() === preset.toLowerCase()
                            );
                            if (already) return null;
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleCreateList(preset)}
                                className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                              >
                                + {preset}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Switch de visibilidad en "Todos" */}
                    <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                          En la pestaña "Todos", mostrar solo productos incluidos en alguna lista
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Ideal si tenés miles de productos internos y querés que tu tienda online muestre únicamente lo que organizaste en tus listas.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.only_show_listed_products)}
                        onChange={(e) =>
                          setSettings({ ...settings, only_show_listed_products: e.target.checked })
                        }
                        className="h-4 w-4 accent-blue-600 rounded shrink-0"
                      />
                    </label>

                    {/* Listado de Listas Creadas */}
                    {customLists.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <FolderPlus size={28} className="mx-auto text-slate-400 mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Todavía no creaste ninguna lista
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Escribí un nombre arriba o tocá una sugerencia rápida para empezar.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {customLists.map((list, idx) => (
                          <div
                            key={list.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMoveList(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                                  title="Subir orden"
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveList(idx, 1)}
                                  disabled={idx === customLists.length - 1}
                                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                                  title="Bajar orden"
                                >
                                  <ArrowDown size={13} />
                                </button>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {list.name}
                                  </span>
                                  <span className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 px-2 py-0.5 text-[10.5px] font-bold">
                                    {list.product_ids.length} productos
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingListId(list.id);
                                  setListModalMode("categories");
                                  setListModalSearch("");
                                  setCatModalSearch("");
                                }}
                                className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                              >
                                <ListFilter size={13} />
                                <span>Seleccionar productos</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteList(list.id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Eliminar lista"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Entregas y Envíos */}
            {activeTab === "delivery" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Modalidad de entrega permitida
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Definí si trabajás con retiro en mostrador, envíos a domicilio o ambos.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <label
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition text-xs font-bold",
                      settings.delivery_mode === "takeaway_only"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery_mode"
                      checked={settings.delivery_mode === "takeaway_only"}
                      onChange={() => setSettings({ ...settings, delivery_mode: "takeaway_only" })}
                      className="accent-blue-600"
                    />
                    <span>Solo retiro en local</span>
                  </label>

                  <label
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition text-xs font-bold",
                      settings.delivery_mode === "delivery_only"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery_mode"
                      checked={settings.delivery_mode === "delivery_only"}
                      onChange={() => setSettings({ ...settings, delivery_mode: "delivery_only" })}
                      className="accent-blue-600"
                    />
                    <span>Solo envíos a domicilio</span>
                  </label>

                  <label
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition text-xs font-bold",
                      settings.delivery_mode === "both"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery_mode"
                      checked={settings.delivery_mode === "both"}
                      onChange={() => setSettings({ ...settings, delivery_mode: "both" })}
                      className="accent-blue-600"
                    />
                    <span>Ambas modalidades</span>
                  </label>
                </div>

                {/* Opciones si incluye retiro */}
                {settings.delivery_mode !== "delivery_only" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Dirección del local para retiros
                    </label>
                    <input
                      type="text"
                      value={settings.takeaway_address}
                      onChange={(e) => setSettings({ ...settings, takeaway_address: e.target.value })}
                      placeholder="Ej: Av. San Martín 1234, Ramos Mejía"
                      className="ui-input w-full text-xs"
                    />
                  </div>
                )}

                {/* Opciones si incluye envíos a domicilio */}
                {settings.delivery_mode !== "takeaway_only" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Costo de envío fijo ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.delivery_cost_amount}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_cost_amount: Number(e.target.value) })
                        }
                        placeholder="0"
                        className="ui-input w-full text-xs"
                      />
                      <span className="text-[10.5px] text-slate-400 mt-0.5 block">0 = Gratis</span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Envío gratis a partir de ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.delivery_free_threshold}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_free_threshold: Number(e.target.value) })
                        }
                        placeholder="Ej: 35000"
                        className="ui-input w-full text-xs"
                      />
                      <span className="text-[10.5px] text-slate-400 mt-0.5 block">0 = Desactivado</span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Monto mínimo de compra ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.delivery_min_order}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_min_order: Number(e.target.value) })
                        }
                        placeholder="Ej: 10000"
                        className="ui-input w-full text-xs"
                      />
                      <span className="text-[10.5px] text-slate-400 mt-0.5 block">0 = Sin mínimo</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Seña y Pagos */}
            {activeTab === "payment" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Política de Seña / Pago Previo
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Evitá pérdidas por pedidos falsos exigiendo un adelanto antes de comenzar a preparar.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <label
                    className={cn(
                      "flex flex-col p-3 rounded-2xl border cursor-pointer transition text-xs",
                      settings.down_payment_policy === "none"
                        ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="down_payment_policy"
                        checked={settings.down_payment_policy === "none"}
                        onChange={() => setSettings({ ...settings, down_payment_policy: "none" })}
                        className="accent-blue-600"
                      />
                      <span className="font-bold">Sin adelanto previo</span>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400 pl-5">
                      El cliente paga el 100% al retirar o recibir.
                    </span>
                  </label>

                  <label
                    className={cn(
                      "flex flex-col p-3 rounded-2xl border cursor-pointer transition text-xs",
                      settings.down_payment_policy === "partial_percent"
                        ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="down_payment_policy"
                        checked={settings.down_payment_policy === "partial_percent"}
                        onChange={() => setSettings({ ...settings, down_payment_policy: "partial_percent" })}
                        className="accent-blue-600"
                      />
                      <span className="font-bold">Seña previa obligatoria</span>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400 pl-5">
                      Paga un adelanto (%) y el resto contra entrega.
                    </span>
                  </label>

                  <label
                    className={cn(
                      "flex flex-col p-3 rounded-2xl border cursor-pointer transition text-xs",
                      settings.down_payment_policy === "full_100"
                        ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="down_payment_policy"
                        checked={settings.down_payment_policy === "full_100"}
                        onChange={() => setSettings({ ...settings, down_payment_policy: "full_100" })}
                        className="accent-blue-600"
                      />
                      <span className="font-bold">Pago 100% por adelantado</span>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400 pl-5">
                      No se prepara hasta confirmar el pago total.
                    </span>
                  </label>
                </div>

                {settings.down_payment_policy === "partial_percent" && (
                  <div className="max-w-xs">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Porcentaje de seña (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={settings.down_payment_percent}
                      onChange={(e) =>
                        setSettings({ ...settings, down_payment_percent: Number(e.target.value) })
                      }
                      className="ui-input w-full text-xs"
                    />
                  </div>
                )}

                {/* Datos Bancarios para Transferencia */}
                <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Datos bancarios visibles para recibir transferencias / señas:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Alias bancario / CVU *
                      </label>
                      <input
                        type="text"
                        value={settings.bank_alias}
                        onChange={(e) => setSettings({ ...settings, bank_alias: e.target.value.toUpperCase() })}
                        placeholder="Ej: CORRALON.LA25"
                        className="ui-input w-full text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Banco o Billetera
                      </label>
                      <input
                        type="text"
                        value={settings.bank_name}
                        onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                        placeholder="Ej: Santander / Mercado Pago"
                        className="ui-input w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Titular de la cuenta
                      </label>
                      <input
                        type="text"
                        value={settings.bank_account_holder}
                        onChange={(e) => setSettings({ ...settings, bank_account_holder: e.target.value })}
                        placeholder="Ej: Juan Pérez"
                        className="ui-input w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        CBU o CVU (Opcional)
                      </label>
                      <input
                        type="text"
                        value={settings.bank_cbu}
                        onChange={(e) => setSettings({ ...settings, bank_cbu: e.target.value })}
                        placeholder="00000031000..."
                        className="ui-input w-full text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botón de Guardado Sticky en footer */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save size={16} />
                <span>{saving ? "Guardando..." : "Guardar Configuración de Mi Tienda"}</span>
              </button>
            </div>
          </form>
        ) : (
          /* TAB 5: Pedidos Web Recibidos */
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Bandeja de Pedidos Web
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pedidos generados por clientes desde tu catálogo digital.
                </p>
              </div>
            </div>

            {ordersLoading ? (
              <div className="text-center py-8 text-xs text-slate-500">Cargando pedidos...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">Aún no recibiste pedidos web.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Compartí tu enlace por WhatsApp o redes sociales para empezar a vender.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <article
                    key={ord.id}
                    className="p-4 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          Pedido #{ord.order_number}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase",
                            ord.order_status === "new"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : ord.order_status === "confirmed"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              : ord.order_status === "preparing"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : ord.order_status === "ready"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                              : ord.order_status === "delivered"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          )}
                        >
                          {ord.order_status === "new"
                            ? "Nuevo"
                            : ord.order_status === "confirmed"
                            ? "Confirmado"
                            : ord.order_status === "preparing"
                            ? "Preparando"
                            : ord.order_status === "ready"
                            ? "Listo"
                            : ord.order_status === "delivered"
                            ? "Entregado"
                            : "Cancelado"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(ord.created_at).toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {ord.customer_name} · Tel: {ord.customer_phone}
                      </p>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ord.delivery_mode === "takeaway" ? "Retiro en local" : `Envío: ${ord.customer_address}`}
                      </p>

                      {/* Resumen de productos */}
                      <p className="text-[11px] text-slate-400 truncate">
                        {Array.isArray(ord.items)
                          ? ord.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 dark:text-slate-100 block">
                          {currency.format(ord.total)}
                        </span>
                        {ord.down_payment_required > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-bold">
                            Seña requerida: {currency.format(ord.down_payment_required)}
                          </span>
                        )}
                      </div>

                      {/* Selector de estado */}
                      <select
                        value={ord.order_status}
                        onChange={(e) =>
                          handleUpdateOrderStatus(ord.id, e.target.value as StoreOrder["order_status"])
                        }
                        className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                      >
                        <option value="new">Nuevo</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="preparing">Preparando</option>
                        <option value="ready">Listo p/ entrega</option>
                        <option value="delivered">Entregado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal de Cartel QR para Mostrador */}
      {isQrModalOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cartel QR de tu Tienda
              </h3>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Colocá este código en tu mostrador o vidriera para que tus clientes escaneen y vean tu catálogo.
            </p>

            {/* Código QR generado mediante API pública segura de QR */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-md border border-slate-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  publicStoreUrl
                )}`}
                alt="Código QR de Mi Tienda"
                className="h-full w-full object-contain"
              />
            </div>

            <p className="text-xs font-mono font-bold text-blue-600 dark:text-sky-400 break-all">
              {publicStoreUrl}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
              >
                Imprimir cartel
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Asignación de Productos a Lista Personalizada */}
      {editingList && (() => {
        const listSet = new Set(editingList.product_ids);
        const query = listModalSearch.trim().toLowerCase();
        const matchingProducts = products.filter((p) => {
          if (p.is_active === false || p.is_published_web === false) return false;
          if (listModalFilter === "in_list" && !listSet.has(p.id)) return false;
          if (listModalFilter === "not_in_list" && listSet.has(p.id)) return false;
          if (!query) return true;
          return (
            p.name.toLowerCase().includes(query) ||
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.category && p.category.toLowerCase().includes(query))
          );
        });
        const visibleProducts = matchingProducts.slice(0, 80);

        const catQuery = catModalSearch.trim().toLowerCase();
        const matchingCategories = categoryStats.filter((c) =>
          !catQuery ? true : c.name.toLowerCase().includes(catQuery)
        );

        return (
          <section className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    Productos en "{editingList.name}"
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingList.product_ids.length} productos asignados a esta lista. Recordá presionar "Guardar configuración" al terminar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingListId(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-tabs: Importar por Categoría primero, luego Por Producto en Particular */}
              <div className="flex items-center gap-2 pt-3 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setListModalMode("categories")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                    listModalMode === "categories"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  Por Categorías del POS (Rápido)
                </button>
                <button
                  type="button"
                  onClick={() => setListModalMode("products")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                    listModalMode === "products"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  Por Producto en Particular
                </button>
              </div>

              {/* MODO: POR PRODUCTOS */}
              {listModalMode === "products" && (
                <>
                  <div className="space-y-2 pb-3 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={listModalSearch}
                        onChange={(e) => setListModalSearch(e.target.value)}
                        placeholder="Buscar producto por nombre, código o categoría..."
                        className="ui-input w-full pl-9 text-xs"
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            { id: "all", label: "Todos" },
                            { id: "in_list", label: `En esta lista (${editingList.product_ids.length})` },
                            { id: "not_in_list", label: "Sin asignar" },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setListModalFilter(f.id)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer",
                              listModalFilter === f.id
                                ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                                : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {matchingProducts.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleBulkSetProductsInList(
                                editingList.id,
                                matchingProducts.map((p) => p.id),
                                "add"
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px] font-bold cursor-pointer"
                          >
                            + Sumar filtrados ({matchingProducts.length})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleBulkSetProductsInList(
                                editingList.id,
                                matchingProducts.map((p) => p.id),
                                "remove"
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
                          >
                            Quitar filtrados
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
                    {visibleProducts.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-500">
                        No se encontraron productos con ese filtro.
                      </p>
                    ) : (
                      visibleProducts.map((prod) => {
                        const checked = listSet.has(prod.id);
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleToggleProductInList(editingList.id, prod.id)}
                            className={cn(
                              "w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition cursor-pointer",
                              checked
                                ? "border-blue-400 bg-blue-50/60 dark:border-blue-600/80 dark:bg-blue-950/30"
                                : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={cn("shrink-0", checked ? "text-blue-600" : "text-slate-400")}>
                                {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                              </span>
                              {prod.image_url ? (
                                <div className="h-9 w-9 shrink-0 rounded-lg border border-slate-200/80 bg-white p-0.5 overflow-hidden">
                                  <img
                                    src={prod.image_url}
                                    alt=""
                                    className="h-full w-full object-contain"
                                    loading="lazy"
                                  />
                                </div>
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {prod.name}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {prod.category || "General"} {prod.code ? `· ${prod.code}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 shrink-0">
                              {currency.format(prod.price)}
                            </span>
                          </button>
                        );
                      })
                    )}
                    {matchingProducts.length > 80 && (
                      <p className="text-center py-2 text-[11px] text-slate-400">
                        Mostrando los primeros 80 de {matchingProducts.length} resultados. Usá el buscador para filtrar mejor.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* MODO: IMPORTAR POR CATEGORÍA */}
              {listModalMode === "categories" && (
                <>
                  <div className="pb-3 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={catModalSearch}
                        onChange={(e) => setCatModalSearch(e.target.value)}
                        placeholder="Buscar categoría del POS (ej: 7UP, 9 DE ORO, FERNET...)"
                        className="ui-input w-full pl-9 text-xs"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
                    {matchingCategories.map((cat) => {
                      const assignedInCat = cat.productIds.filter((id) => listSet.has(id)).length;
                      const allAssigned = assignedInCat === cat.productIds.length && cat.productIds.length > 0;
                      return (
                        <div
                          key={cat.name}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {cat.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {assignedInCat} de {cat.productIds.length} productos en "{editingList.name}"
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {allAssigned ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleBulkSetProductsInList(editingList.id, cat.productIds, "remove")
                                }
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-bold cursor-pointer"
                              >
                                Quitar ({cat.productIds.length})
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleBulkSetProductsInList(editingList.id, cat.productIds, "add")
                                }
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                              >
                                + Sumar todos ({cat.productIds.length})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Footer Modal */}
              <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingListId(null)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-xs cursor-pointer"
                >
                  Listo ({editingList.product_ids.length} productos)
                </button>
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
};
