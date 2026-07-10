import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import type { Product } from "@/types/entities";
import { cn } from "@/utils/cn";

interface PosProductListProps {
  products: Product[];
  favoriteProducts: Product[];
  primaryBarcodes: Record<string, string>;
  checkoutAnchorId?: string;
  onOpenCheckout?: () => void;
  disabled?: boolean;
  canWrite: boolean;
  onAddProduct: (product: Product, quantity: number) => Promise<boolean | void> | boolean | void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const normalizeSearchText = (value: string): string => value.trim().toLowerCase();

const productUnitLabel = (product: Product): string =>
  product.sale_mode === "weight" ? "kg" : "u.";

const productStockLabel = (product: Product): string =>
  `${product.stock_current.toLocaleString("es-AR")} ${productUnitLabel(product)}`;

const gramsToKg = (quantityGrams: number): number => Number((quantityGrams / 1000).toFixed(3));

export const PosProductList = ({
  products,
  favoriteProducts,
  primaryBarcodes,
  checkoutAnchorId,
  onOpenCheckout,
  disabled,
  canWrite,
  onAddProduct,
}: PosProductListProps) => {
  const [activeTab, setActiveTab] = useState<"favorites" | "products">("favorites");
  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [productsSearch, setProductsSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 5),
    [products]
  );

  const filteredFavorites = useMemo(() => {
    const term = normalizeSearchText(favoritesSearch);
    if (!term) return favoriteProducts;

    return favoriteProducts.filter((product) => {
      const barcode = primaryBarcodes[product.id] ?? "";

      return [
        product.name,
        product.code,
        product.brand ?? "",
        product.category,
        product.subcategory ?? "",
        barcode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [favoriteProducts, favoritesSearch, primaryBarcodes]);

  const filteredProducts = useMemo(() => {
    const term = normalizeSearchText(productsSearch);

    return products.filter((product) => {
      const barcode = primaryBarcodes[product.id] ?? "";
      const matchesTerm =
        !term ||
        [
          product.name,
          product.code,
          product.brand ?? "",
          product.category,
          product.subcategory ?? "",
          barcode,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;

      return matchesTerm && matchesCategory;
    });
  }, [primaryBarcodes, products, productsSearch, selectedCategory]);

  const paginatedFavorites = usePagination(
    filteredFavorites,
    10,
    `${favoritesSearch}|${favoriteProducts.length}`
  );
  const paginatedProducts = usePagination(
    filteredProducts,
    10,
    `${productsSearch}|${selectedCategory}|${products.length}`
  );

  const resolveWeightQuantity = (productId: string) => {
    const raw = weightInputs[productId] ?? "500";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? gramsToKg(parsed) : 0;
  };

  const quickAddProduct = async (product: Product) => {
    if (disabled || !canWrite) return;
    const quantity = product.sale_mode === "weight" ? resolveWeightQuantity(product.id) : 1;
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    await onAddProduct(product, quantity);
  };

  const renderAddProductAction = (product: Product, compact = false) => {
    const weightValue = weightInputs[product.id] ?? "500";
    const weightGrams = Number(weightValue);
    const weightQty = Number.isFinite(weightGrams) ? gramsToKg(weightGrams) : 0;

    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          compact ? "max-w-full justify-end" : "justify-end"
        )}
      >
        {product.sale_mode === "weight" ? (
          <input
            type="number"
            step="1"
            min="1"
            value={weightValue}
            onChange={(event) =>
              setWeightInputs((prev) => ({
                ...prev,
                [product.id]: event.target.value,
              }))
            }
            className={
              compact
                ? "w-16 rounded-xl border border-slate-300 px-2 py-1 text-xs"
                : "w-24 rounded-xl border border-slate-300 px-2 py-1 text-sm"
            }
            disabled={disabled || !canWrite}
            title="Cantidad en gramos. Ej: 300 = 300 g"
          />
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (disabled || !canWrite) return;
            if (product.sale_mode === "weight" && (!Number.isFinite(weightQty) || weightQty <= 0)) return;
            void onAddProduct(product, product.sale_mode === "weight" ? weightQty : 1);
          }}
          disabled={disabled || !canWrite}
          className={cn(
            "rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-50",
            compact ? "shrink-0 px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
          )}
        >
          {compact ? "Agregar" : product.sale_mode === "weight" ? "Agregar" : "+"}
        </button>
      </div>
    );
  };

  return (
    <section className="pos-surface space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Catalogo POS</h2>
          <div className="inline-flex rounded-xl bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                activeTab === "favorites" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              Favoritos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                activeTab === "products" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              Productos
            </button>
          </div>
        </div>
      </div>

      {activeTab === "favorites" ? (
        <div className="space-y-3">
        <label className="pos-search-wrap">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            type="search"
              value={favoritesSearch}
              onChange={(event) => setFavoritesSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!filteredFavorites.length) return;
                event.preventDefault();
                void quickAddProduct(filteredFavorites[0]);
              }}
              placeholder="Buscar en favoritos"
            className="pos-search-input"
          />
            <span className="hidden rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
              TOP
            </span>
        </label>

        <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Favoritos</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{filteredFavorites.length} resultados</span>
              {checkoutAnchorId ? (
                <a
                  href={`#${checkoutAnchorId}`}
                  className="ui-btn-primary px-3 py-1.5 text-xs"
                  onClick={() => {
                    onOpenCheckout?.();
                  }}
                >
                  Ir al carrito
                </a>
              ) : null}
            </div>
        </div>

          {!favoriteProducts.length ? (
          <div className="ui-empty-state py-5">No hay productos favoritos configurados.</div>
        ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {paginatedFavorites.pageItems.map((product) => (
                <article key={`fav-${product.id}`} className="pos-favorite-card pos-favorite-card--uniform">
                  <div className="pos-favorite-media">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
                    {product.category}
                  </span>
                </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-semibold text-slate-900" title={product.name}>
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{product.brand ?? product.category}</p>
                  </div>
                  <div className="mt-auto flex min-w-0 flex-wrap items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-brand-700">
                        {currency.format(product.price)}
                        {product.sale_mode === "weight" ? " / kg" : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        Stock: {productStockLabel(product)}
                      </p>
                    </div>
                    <div className="min-w-0 max-w-full">{renderAddProductAction(product, true)}</div>
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
          <label className="pos-search-wrap">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              value={productsSearch}
              onChange={(event) => setProductsSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!filteredProducts.length) return;
                event.preventDefault();
                void quickAddProduct(filteredProducts[0]);
              }}
              placeholder="Buscar en productos"
              className="pos-search-input"
            />
            <span className="hidden rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
              SKU
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition",
                selectedCategory === "all" ? "bg-brand-600 text-white" : "bg-slate-50 text-slate-500"
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
                  "rounded-full px-3 py-1 text-xs transition",
                  selectedCategory === category ? "bg-brand-600 text-white" : "bg-slate-50 text-slate-500"
                )}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="max-h-[480px] space-y-2 overflow-auto pr-1">
            {!filteredProducts.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No hay resultados para la busqueda actual.
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
                      Codigo: {product.code}
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
