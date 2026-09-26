import { useState, useEffect, useMemo } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { productsService } from "@/services/products.service";
import type { Employee, Product } from "@/types/entities";
import { Search, ShoppingBag, Plus, Minus, Trash2 } from "lucide-react";

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
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const EmployeeProductConsumptionModal = ({
  open,
  tenantId,
  employee,
  onClose,
  onSubmit,
}: EmployeeProductConsumptionModalProps) => {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;

    let isMounted = true;
    setIsLoading(true);
    productsService
      .getAllByTenant(tenantId)
      .then((data) => {
        if (isMounted) {
          setProducts(data.filter((p) => p.is_active));
        }
      })
      .catch(() => {
        toast.error("Error al cargar productos del comercio");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, tenantId, toast]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 15);

    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.code && p.code.toLowerCase().includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term))
      )
      .slice(0, 20);
  }, [products, search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Agregá al menos un producto retirado por el empleado");
      return;
    }

    // Comprobar límite si está configurado
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

    const itemsSummary = cart
      .map(
        (item) =>
          `${item.quantity}x ${item.product.name} (${currency.format(
            item.product.price * item.quantity
          )})`
      )
      .join(", ");

    const notes = customNotes.trim()
      ? `Retiro de mercadería: ${itemsSummary} • Nota: ${customNotes.trim()}`
      : `Retiro de mercadería: ${itemsSummary}`;

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        amount: totalAmount,
        notes,
        category: "product_purchase",
      });

      if (success) {
        toast.success(
          `Retiro de productos registrado por ${currency.format(totalAmount)}. Se cargó a su cuenta corriente.`
        );
        setCart([]);
        setCustomNotes("");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Retiro de Productos
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Empleado: <strong className="text-slate-700 dark:text-slate-300">{employee.full_name}</strong> • Saldo actual adeudado: {currency.format(employee.current_balance ?? 0)}
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
            {/* Columna Izquierda: Buscador y Catálogo de Productos */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Buscar Productos del Catálogo
              </h4>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o marca..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Cargando productos...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No se encontraron productos coincidentes.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate dark:text-slate-100">
                            {product.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {product.code} • Stock: {product.stock_current}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {currency.format(product.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
                          >
                            <Plus size={12} />
                            {inCart ? `(${inCart.quantity})` : "Agregar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna Derecha: Canasta de Productos Retirados */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 dark:border-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Productos Seleccionados
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    {cart.length} {cart.length === 1 ? "artículo" : "artículos"}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Aún no seleccionaste ningún producto. Hacé clic en &quot;Agregar&quot; en la lista de la izquierda.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between rounded-xl bg-white p-2 text-xs shadow-sm dark:bg-slate-800"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate dark:text-slate-200">
                            {item.product.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {currency.format(item.product.price)} c/u
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="p-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-400"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-5 text-center font-bold text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="p-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-400"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          <span className="w-16 text-right font-bold text-slate-900 dark:text-slate-100">
                            {currency.format(item.product.price * item.quantity)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen Total y Notas */}
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700 space-y-3">
                <div>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Nota adicional (ej: consumo almuerzo)..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/40">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                    Total a Cargar a Cuenta Corriente:
                  </span>
                  <span className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {currency.format(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || cart.length === 0}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : "Confirmar Retiro a Cuenta Corriente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
