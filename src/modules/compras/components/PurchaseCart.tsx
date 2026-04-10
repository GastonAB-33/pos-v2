interface PurchaseCartItemView {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
}

interface PurchaseCartProps {
  items: PurchaseCartItemView[];
  total: number;
  canWrite: boolean;
  disabled?: boolean;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetUnitCost: (productId: string, unitCost: number) => void;
  onRemove: (productId: string) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PurchaseCart = ({
  items,
  total,
  canWrite,
  disabled,
  onSetQuantity,
  onSetUnitCost,
  onRemove,
}: PurchaseCartProps) => {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Items de compra</h2>

      {!items.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Aun no agregaste items.
        </div>
      ) : (
        <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
          {items.map((item) => (
            <article key={item.product_id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    Total linea: {currency.format(item.quantity * item.unit_cost)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.product_id)}
                  disabled={disabled || !canWrite}
                  className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Cantidad</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={item.quantity}
                    onChange={(event) =>
                      onSetQuantity(item.product_id, Number(event.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    disabled={disabled || !canWrite}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Costo unitario</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_cost}
                    onChange={(event) =>
                      onSetUnitCost(item.product_id, Number(event.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    disabled={disabled || !canWrite}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">Total compra</span>
          <span className="text-base font-semibold text-slate-900">{currency.format(total)}</span>
        </div>
      </div>
    </section>
  );
};

