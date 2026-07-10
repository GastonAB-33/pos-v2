import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import type { Product } from "@/types/entities";

interface PurchaseProductListProps {
  products: Product[];
  search: string;
  disabled?: boolean;
  canWrite: boolean;
  onSearchChange: (value: string) => void;
  onAddProduct: (product: Product) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const stockLabel = (product: Product) =>
  `${product.stock_current.toLocaleString("es-AR")} ${product.sale_mode === "weight" ? "kg" : "u."}`;

export const PurchaseProductList = ({
  products,
  search,
  disabled,
  canWrite,
  onSearchChange,
  onAddProduct,
}: PurchaseProductListProps) => {
  const paginatedProducts = usePagination(products, 10, `${search}|${products.length}`);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Productos</h2>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, codigo o categoria"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="max-h-[480px] space-y-2 overflow-auto pr-1">
        {!products.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No hay productos para mostrar.
          </div>
        ) : null}

        {paginatedProducts.pageItems.map((product) => (
          <article
            key={product.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">{product.category}</p>
              <p className="text-sm text-slate-700">
                Costo: {currency.format(product.cost_price)}
                {product.sale_mode === "weight" ? " / kg" : ""}
              </p>
              <p className="text-xs text-slate-500">
                Stock actual: {stockLabel(product)}
              </p>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onAddProduct(product)}
                disabled={disabled || !canWrite}
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </article>
        ))}
      </div>
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

