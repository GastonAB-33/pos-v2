import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import type { PriceList, PriceListItem, Product } from "@/types/entities";

interface PriceListDetailPanelProps {
  priceList: PriceList;
  products: Product[];
  itemByProductId: Map<string, PriceListItem>;
  canWrite: boolean;
  disabled?: boolean;
  onSetFixedPrice: (productId: string, fixedPrice: number) => Promise<void>;
  onRemoveFixedPrice: (productId: string) => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const roundAmount = (value: number) => Number(value.toFixed(2));

export const PriceListDetailPanel = ({
  priceList,
  products,
  itemByProductId,
  canWrite,
  disabled,
  onSetFixedPrice,
  onRemoveFixedPrice,
}: PriceListDetailPanelProps) => {
  const [search, setSearch] = useState("");
  const [fixedInputs, setFixedInputs] = useState<Record<string, string>>({});

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.code, product.category, product.subcategory ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  const isPercentageMode = priceList.price_mode === "percentage";
  const paginatedProducts = usePagination(filteredProducts, 10, `${search}|${products.length}`);

  return (
    <section className="space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Detalle de lista: {priceList.name}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                priceList.is_active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {priceList.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Código: <span className="font-semibold text-slate-700 dark:text-slate-300">{priceList.code}</span>
            {priceList.description ? ` • ${priceList.description}` : ""}
          </p>
        </div>

        <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
          {isPercentageMode
            ? `Ajuste porcentual: ${Number(priceList.percentage_adjustment ?? 0).toLocaleString("es-AR")}%`
            : "Precios fijos individuales"}
        </div>
      </header>

      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar producto por nombre, código o categoría..."
          className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500"
        />
      </div>

      {!filteredProducts.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          No hay productos para mostrar en esta lista.
        </div>
      ) : (
        <div className="max-h-[520px] space-y-2.5 overflow-auto pr-1">
          {paginatedProducts.pageItems.map((product) => {
            const fixedItem = itemByProductId.get(product.id);
            const fixedInput = fixedInputs[product.id] ?? (fixedItem ? String(fixedItem.fixed_price) : String(product.price));
            const percentageResolved = roundAmount(
              product.price * (1 + Number(priceList.percentage_adjustment ?? 0) / 100)
            );

            return (
              <article
                key={product.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition-all dark:border-slate-800/90 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{product.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cód: <span className="font-semibold text-slate-700 dark:text-slate-300">{product.code}</span> • Cat: {product.category}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    Base: {currency.format(product.price)}
                  </span>
                </div>

                {isPercentageMode ? (
                  <p className="mt-2.5 text-sm text-slate-700 dark:text-slate-300">
                    Precio aplicado:{" "}
                    <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                      {currency.format(percentageResolved)}
                    </span>
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fixedInput}
                      onChange={(event) =>
                        setFixedInputs((prev) => ({
                          ...prev,
                          [product.id]: event.target.value,
                        }))
                      }
                      className="w-36 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:disabled:bg-slate-800/60"
                      disabled={disabled || !canWrite}
                    />
                    <button
                      type="button"
                      className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                      disabled={disabled || !canWrite}
                      onClick={() => {
                        const parsed = Number(fixedInput);
                        if (!Number.isFinite(parsed) || parsed < 0) return;
                        void onSetFixedPrice(product.id, parsed);
                      }}
                    >
                      Guardar fijo
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-100 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                      disabled={disabled || !canWrite || !fixedItem}
                      onClick={() => {
                        void onRemoveFixedPrice(product.id);
                      }}
                    >
                      Quitar fijo
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                      {fixedItem
                        ? `Fijo actual: ${currency.format(fixedItem.fixed_price)}`
                        : "Sin precio fijo (usa base)"}
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <PaginationControls
        currentPage={paginatedProducts.currentPage}
        pageCount={paginatedProducts.pageCount}
        startItem={paginatedProducts.startItem}
        endItem={paginatedProducts.endItem}
        totalItems={paginatedProducts.totalItems}
        onPageChange={paginatedProducts.setCurrentPage}
      />
    </section>
  );
};
