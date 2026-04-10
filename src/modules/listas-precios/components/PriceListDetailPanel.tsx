import { useMemo, useState } from "react";
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

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Detalle de lista</h3>
        <p className="text-sm text-slate-600">
          {priceList.name} ({priceList.code})
          {priceList.is_active ? "" : " - Inactiva"}
        </p>
        <p className="text-xs text-slate-500">
          {isPercentageMode
            ? `Modo porcentaje: ${Number(priceList.percentage_adjustment ?? 0).toLocaleString("es-AR")}%`
            : "Modo precio fijo por producto"}
        </p>
      </header>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar producto por nombre, codigo o categoria"
        className="ui-input"
      />

      {!filteredProducts.length ? (
        <div className="ui-empty-state">No hay productos para mostrar en esta lista.</div>
      ) : (
        <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
          {filteredProducts.map((product) => {
            const fixedItem = itemByProductId.get(product.id);
            const fixedInput = fixedInputs[product.id] ?? (fixedItem ? String(fixedItem.fixed_price) : String(product.price));
            const percentageResolved = roundAmount(
              product.price * (1 + Number(priceList.percentage_adjustment ?? 0) / 100)
            );

            return (
              <article key={product.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.code} | {product.category}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">Base: {currency.format(product.price)}</span>
                </div>

                {isPercentageMode ? (
                  <p className="mt-2 text-sm text-slate-700">
                    Precio aplicado: <span className="font-semibold text-slate-900">{currency.format(percentageResolved)}</span>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      className="ui-input w-36"
                      disabled={disabled || !canWrite}
                    />
                    <button
                      type="button"
                      className="ui-btn-primary px-2 py-1 text-xs disabled:opacity-60"
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
                      className="ui-btn-ghost px-2 py-1 text-xs disabled:opacity-60"
                      disabled={disabled || !canWrite || !fixedItem}
                      onClick={() => {
                        void onRemoveFixedPrice(product.id);
                      }}
                    >
                      Quitar fijo
                    </button>
                    <span className="text-xs text-slate-500">
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
    </section>
  );
};
