import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { Plus, ShoppingCart, X } from "lucide-react";
import type { Product } from "@/types/entities";
import { cn } from "@/utils/cn";
import {
  matchesProductSearch,
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  type ProductSearchScope,
} from "@/utils/search";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";

export interface PosSaleTabItem {
  id: string;
  label: string;
  cart: Array<{ unit_price: number; quantity: number }>;
}

interface PosProductListProps {
  products: Product[];
  favoriteProducts: Product[];
  primaryBarcodes: Record<string, string>;
  saleTabs?: PosSaleTabItem[];
  activeTabId?: string;
  onSwitchSaleTab?: (tabId: string) => void;
  onCreateSaleTab?: () => void;
  onCloseSaleTab?: (tabId: string) => void;
  disabled?: boolean;
  canWrite: boolean;
  onAddProduct: (product: Product, quantity: number) => Promise<boolean | void> | boolean | void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const productUnitLabel = (product: Product): string =>
  product.sale_mode === "weight" ? "kg" : "u.";

const productStockLabel = (product: Product): string =>
  `${product.stock_current.toLocaleString("es-AR")} ${productUnitLabel(product)}`;

const gramsToKg = (quantityGrams: number): number => Number((quantityGrams / 1000).toFixed(3));

export const PosProductList = ({
  products,
  favoriteProducts,
  primaryBarcodes,
  saleTabs,
  activeTabId,
  onSwitchSaleTab,
  onCreateSaleTab,
  onCloseSaleTab,
  disabled,
  canWrite,
  onAddProduct,
}: PosProductListProps) => {
  const [activeTab, setActiveTab] = useState<"favorites" | "products">("favorites");
  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [productsSearch, setProductsSearch] = useState("");
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 5),
    [products]
  );

  const filteredFavorites = useMemo(() => {
    const rawSearch = favoritesSearch.trim();
    if (!rawSearch) return favoriteProducts;

    return favoriteProducts.filter((product) => {
      const barcode = primaryBarcodes[product.id] ?? "";
      return matchesProductSearch(
        {
          name: product.name,
          code: product.code,
          barcode,
          brand: product.brand,
          category: product.category,
          subcategory: product.subcategory,
        },
        rawSearch,
        searchScope
      );
    });
  }, [favoriteProducts, favoritesSearch, primaryBarcodes, searchScope]);

  const filteredProducts = useMemo(() => {
    const rawSearch = productsSearch.trim();

    return products.filter((product) => {
      const barcode = primaryBarcodes[product.id] ?? "";
      const matchesSearch =
        !rawSearch ||
        matchesProductSearch(
          {
            name: product.name,
            code: product.code,
            barcode,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
          },
          rawSearch,
          searchScope
        );

      if (!matchesSearch) return false;

      // Si busca por código o código de barras, no lo bloqueamos por categoría
      if (searchScope === "code" || searchScope === "barcode") return true;

      return selectedCategory === "all" || product.category === selectedCategory;
    });
  }, [primaryBarcodes, products, productsSearch, searchScope, selectedCategory]);

  const paginatedFavorites = usePagination(
    filteredFavorites,
    10,
    `${favoritesSearch}|${searchScope}|${favoriteProducts.length}`
  );
  const paginatedProducts = usePagination(
    filteredProducts,
    10,
    `${productsSearch}|${searchScope}|${selectedCategory}|${products.length}`
  );

  const resolveWeightQuantity = (productId: string) => {
    const raw = weightInputs[productId] ?? "0";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? gramsToKg(parsed) : 0;
  };

  const quickAddProduct = async (product: Product) => {
    if (disabled || !canWrite) return;
    const quantity = product.sale_mode === "weight" ? resolveWeightQuantity(product.id) : 1;
    await onAddProduct(product, quantity);
  };

  const renderAddProductAction = (product: Product, isFavoriteCard = false) => {
    const weightValue = weightInputs[product.id] ?? "0";
    const weightQty = gramsToKg(Number(weightValue));

    if (isFavoriteCard) {
      return (
        <button
          type="button"
          onClick={() => {
            if (disabled || !canWrite) return;
            void onAddProduct(product, 0);
          }}
          disabled={disabled || !canWrite}
          className="ui-btn-primary w-full justify-center py-2 text-xs font-semibold shadow-sm"
        >
          Agregar
        </button>
      );
    }

    return (
      <div className="flex min-w-0 items-center justify-end gap-2">
        {product.sale_mode === "weight" ? (
          <input
            type="number"
            step="1"
            min="0"
            value={weightValue}
            placeholder="0"
            onChange={(event) =>
              setWeightInputs((prev) => ({
                ...prev,
                [product.id]: event.target.value,
              }))
            }
            onFocus={(event) =>
              handleNumericInputFocus(event, {
                isNew: true,
                onClear: () => setWeightInputs((prev) => ({ ...prev, [product.id]: "" })),
              })
            }
            onBlur={(event) =>
              handleNumericInputBlur(event, "0", (def) =>
                setWeightInputs((prev) => ({ ...prev, [product.id]: def }))
              )
            }
            className="w-24 rounded-xl border border-slate-300 px-2 py-1 text-sm text-center"
            disabled={disabled || !canWrite}
            title="Cantidad en gramos"
          />
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (disabled || !canWrite) return;
            void onAddProduct(product, product.sale_mode === "weight" ? weightQty : 1);
          }}
          disabled={disabled || !canWrite}
          className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {product.sale_mode === "weight" ? "Agregar" : "+"}
        </button>
      </div>
    );
  };

  return (
    <section className="pos-surface flex flex-col space-y-3.5">
      {/* 1. Fila de Pestañas de Ventas Múltiples */}
      {saleTabs && saleTabs.length > 0 ? (
        <div className="pos-sale-tabs flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            VENTAS:
          </span>
          {saleTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabTotal = tab.cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
            const itemCount = tab.cart.reduce((acc, item) => acc + item.quantity, 0);

            return (
              <div
                key={tab.id}
                onClick={() => onSwitchSaleTab?.(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none whitespace-nowrap shadow-sm",
                  isActive
                    ? "border-blue-500 bg-blue-50/90 text-blue-900 font-semibold dark:bg-blue-950/60 dark:text-blue-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                )}
                title={`Seleccionar ${tab.label}`}
              >
                <ShoppingCart size={13} className={isActive ? "text-blue-600" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.cart.length > 0 ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                      isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800"
                    )}
                  >
                    {currency.format(tabTotal)} ({itemCount})
                  </span>
                ) : null}
                {saleTabs.length > 1 ? (
                  <button
                    type="button"
                    className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tab.cart.length > 0) {
                        const ok = window.confirm(`¿Cerrar ${tab.label}? Se perderán los productos de esta venta.`);
                        if (!ok) return;
                      }
                      onCloseSaleTab?.(tab.id);
                    }}
                    title="Cerrar esta venta"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onCreateSaleTab}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            title="Abrir otra venta simultánea"
          >
            <Plus size={14} />
            <span>Nueva venta</span>
          </button>
        </div>
      ) : null}

      {/* 2. Barra de Búsqueda */}
      <div className="pos-search-wrap flex items-center gap-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="text"
          value={activeTab === "favorites" ? favoritesSearch : productsSearch}
          onChange={(event) =>
            activeTab === "favorites"
              ? setFavoritesSearch(event.target.value)
              : setProductsSearch(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (activeTab === "favorites") {
              if (!filteredFavorites.length) return;
              event.preventDefault();
              void quickAddProduct(filteredFavorites[0]);
            } else {
              if (!filteredProducts.length) return;
              event.preventDefault();
              void quickAddProduct(filteredProducts[0]);
            }
          }}
          placeholder={getSearchPlaceholder(searchScope)}
          className="pos-search-input flex-1 min-w-0"
          aria-label="Buscar productos en venta"
        />
        {(activeTab === "favorites" ? favoritesSearch : productsSearch) ? (
          <button
            type="button"
            onClick={() =>
              activeTab === "favorites" ? setFavoritesSearch("") : setProductsSearch("")
            }
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        ) : null}
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
        <select
          value={searchScope}
          onChange={(e) => setSearchScope(e.target.value as ProductSearchScope)}
          className="bg-transparent text-xs font-medium text-slate-600 focus:outline-none dark:text-slate-300 cursor-pointer py-1 px-1 shrink-0"
          aria-label="Tipo de búsqueda"
        >
          {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Encabezado de Sección: Título + Toggle Favoritos/Productos */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {activeTab === "favorites" ? "Favoritos" : "Productos"}
          </h2>
          <span className="text-xs text-slate-400">
            ({activeTab === "favorites" ? filteredFavorites.length : filteredProducts.length})
          </span>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-semibold transition",
              activeTab === "favorites"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            )}
            onClick={() => setActiveTab("favorites")}
          >
            Favoritos
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-semibold transition",
              activeTab === "products"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            )}
            onClick={() => setActiveTab("products")}
          >
            Productos
          </button>
        </div>
      </div>

      {/* 4. Contenido del Catálogo */}
      {activeTab === "favorites" ? (
        <div className="space-y-3">
          {!favoriteProducts.length ? (
            <div className="ui-empty-state py-8">No hay productos favoritos configurados.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {paginatedFavorites.pageItems.map((product) => (
                <article
                  key={`fav-${product.id}`}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Imagen y badges */}
                  <div className="relative mb-2.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                        {product.brand ?? product.category}
                      </span>
                    )}
                    {product.sale_mode === "weight" ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        Balanza (kg)
                      </span>
                    ) : null}
                  </div>

                  {/* Nombre y categoría */}
                  <div className="mb-2 min-w-0">
                    <p
                      className="line-clamp-1 text-sm font-bold leading-snug text-slate-900 dark:text-slate-100"
                      title={product.name}
                    >
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {product.brand ?? product.category}
                    </p>
                  </div>

                  {/* Precios y Botón de Agregar */}
                  <div className="mt-auto space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800/80">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                        {currency.format(product.price)}
                        {product.sale_mode === "weight" ? <span className="text-xs font-normal"> / kg</span> : ""}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Stock: {productStockLabel(product)}
                      </span>
                    </div>

                    <div className="w-full">
                      {renderAddProductAction(product, true)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <PaginationControls
            currentPage={paginatedFavorites.currentPage}
            pageCount={paginatedFavorites.pageCount}
            startItem={paginatedFavorites.startItem}
            endItem={paginatedFavorites.endItem}
            totalItems={paginatedFavorites.totalItems}
            onPageChange={paginatedFavorites.setCurrentPage}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                selectedCategory === "all"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  selectedCategory === category
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {!filteredProducts.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No hay resultados para la búsqueda actual.
              </div>
            ) : null}

            {paginatedProducts.pageItems.map((product) => {
              const barcode = primaryBarcodes[product.id] ?? null;

              return (
                <article key={product.id} className="pos-product-row">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.category}
                      {product.subcategory ? ` / ${product.subcategory}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Código: {product.code}
                      {barcode ? ` | Barcode: ${barcode}` : ""}
                      {product.brand ? ` | Marca: ${product.brand}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-semibold text-slate-900">
                        {currency.format(product.price)}
                        {product.sale_mode === "weight" ? " / kg" : ""}
                      </p>
                      <p className="text-xs text-brand-700">
                        {productStockLabel(product)} en stock
                      </p>
                    </div>
                    {renderAddProductAction(product)}
                  </div>
                </article>
              );
            })}
          </div>

          <PaginationControls
            currentPage={paginatedProducts.currentPage}
            pageCount={paginatedProducts.pageCount}
            startItem={paginatedProducts.startItem}
            endItem={paginatedProducts.endItem}
            totalItems={paginatedProducts.totalItems}
            onPageChange={paginatedProducts.setCurrentPage}
          />
        </div>
      )}
    </section>
  );
};
