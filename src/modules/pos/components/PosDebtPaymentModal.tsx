import { useEffect, useMemo, useState } from "react";
import { Coins, AlertCircle, CheckCircle2, Search, X, Trash2 } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { Customer } from "@/types/entities";
import type { PosCartItem } from "@/modules/pos/hooks/usePosSale";

interface PosDebtPaymentModalProps {
  open: boolean;
  customers: Customer[];
  selectedCustomer: Customer | null;
  existingDebtItem: PosCartItem | null;
  disabled?: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  onConfirm: (payload: { customer: Customer; amount: number; notes: string }) => void;
  onRemoveExisting?: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PosDebtPaymentModal = ({
  open,
  customers,
  selectedCustomer,
  existingDebtItem,
  disabled = false,
  onClose,
  onSelectCustomer,
  onConfirm,
  onRemoveExisting,
}: PosDebtPaymentModalProps) => {
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(selectedCustomer);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [concept, setConcept] = useState<string>("Cancelación parcial de cuenta corriente");
  const [error, setError] = useState<string | null>(null);

  // Sincronizar estado cuando se abre o cambia cliente / ítem existente
  useEffect(() => {
    if (open) {
      const initialCust = selectedCustomer ?? null;
      setActiveCustomer(initialCust);
      setIsSearchingCustomer(!initialCust);
      setCustomerSearch("");
      setError(null);

      if (existingDebtItem) {
        setAmount(existingDebtItem.unit_price > 0 ? String(existingDebtItem.unit_price) : "");
        setConcept("Cancelación parcial de cuenta corriente");
      } else {
        setAmount("");
        setConcept("Cancelación parcial de cuenta corriente");
      }
    }
  }, [open, selectedCustomer, existingDebtItem]);

  // Filtrado de clientes
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) {
      // Mostrar primero los que tienen deuda
      return [...customers].sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0)).slice(0, 30);
    }
    return customers
      .filter((c) => {
        const name = (c.full_name || "").toLowerCase();
        const doc = (c.document_number || "").toLowerCase();
        const code = (c.code || "").toLowerCase();
        return name.includes(q) || doc.includes(q) || code.includes(q);
      })
      .slice(0, 30);
  }, [customers, customerSearch]);

  if (!open) return null;

  const currentDebt = Number(activeCustomer?.current_balance ?? 0);

  const handleSelectCustomer = (customer: Customer) => {
    setActiveCustomer(customer);
    onSelectCustomer(customer);
    setIsSearchingCustomer(false);
    setError(null);

    // Si tiene deuda y el monto está vacío, sugerir la deuda total
    if (currentDebt > 0 && !amount) {
      setAmount(String(currentDebt));
    }
  };

  const handleQuickAmount = (val: number) => {
    if (val <= 0) return;
    setAmount(String(Number(val.toFixed(2))));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) {
      setError("Debes seleccionar un cliente para aplicar el cobro.");
      return;
    }

    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Ingresa un monto válido mayor a $0.");
      return;
    }

    onConfirm({
      customer: activeCustomer,
      amount: Number(parsedAmount.toFixed(2)),
      notes: concept.trim() || "Cancelación de cuenta corriente",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-3 sm:p-4 backdrop-blur-[1px] animate-in fade-in">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-slate-200 p-4 sm:px-5 sm:py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
              <Coins size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cobro de Cuenta Corriente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Agrega al carrito un monto para cancelar deuda del cliente
              </p>
            </div>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={disabled} />
        </header>

        {/* Formulario */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. SECCIÓN CLIENTE */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              1. Cliente de la Cuenta Corriente
            </label>

            {activeCustomer && !isSearchingCustomer ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs">
                    {activeCustomer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {activeCustomer.full_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeCustomer.document_number ? (
                        <span>DNI/CUIT: {activeCustomer.document_number}</span>
                      ) : null}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        • Saldo actual:{" "}
                        <strong
                          className={
                            currentDebt > 0
                              ? "text-rose-600 dark:text-rose-400 font-bold"
                              : "text-emerald-600 dark:text-emerald-400 font-bold"
                          }
                        >
                          {currency.format(currentDebt)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSearchingCustomer(true)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 transition ml-2 shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente por nombre o DNI..."
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  {customerSearch ? (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>

                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800/60">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((c) => {
                      const cDebt = Number(c.current_balance ?? 0);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="flex w-full items-center justify-between p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-lg transition"
                        >
                          <div className="truncate mr-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                              {c.full_name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {c.document_number ? `Doc: ${c.document_number}` : c.code}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-bold shrink-0 ${
                              cDebt > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {cDebt > 0 ? `Debe ${currency.format(cDebt)}` : "Al día ($0)"}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="p-3 text-center text-xs text-slate-400">No se encontraron clientes</p>
                  )}
                </div>

                {activeCustomer && (
                  <button
                    type="button"
                    onClick={() => setIsSearchingCustomer(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
                  >
                    Mantener cliente seleccionado: {activeCustomer.full_name}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. SECCIÓN MONTO A COBRAR */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                2. Monto a Cancelar / Cobrar ($) *
              </label>
              {activeCustomer && currentDebt > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(currentDebt)}
                    className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 transition"
                  >
                    Total: {currency.format(currentDebt)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(currentDebt / 2)}
                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 transition"
                  >
                    50%: {currency.format(currentDebt / 2)}
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500 text-sm">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="0,00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-8 pr-3 text-base font-bold text-slate-900 placeholder:text-slate-400 shadow-xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 font-mono"
              />
            </div>

            {activeCustomer && currentDebt <= 0 && (
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                El cliente está al día. El monto ingresado quedará registrado como saldo a favor en su cuenta corriente.
              </p>
            )}
          </div>

          {/* 3. SECCIÓN CONCEPTO */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Concepto / Observación (Opcional)
            </label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Cancelación parcial de cuenta corriente..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Información Explicativa */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
            <p className="font-semibold">¿Cómo impacta en la venta?</p>
            <p className="mt-0.5 text-[11px] text-indigo-800 dark:text-indigo-300">
              Este importe se sumará al total a cobrar en el punto de venta. Al confirmar la venta con el medio de pago elegido (efectivo, tarjeta, transferencia), se cancelará automáticamente el saldo en la cuenta corriente del cliente.
            </p>
          </div>

          {/* Pie de Acciones */}
          <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div>
              {existingDebtItem && onRemoveExisting ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveExisting();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition"
                  title="Quitar este cobro de cuenta corriente del carrito"
                >
                  <Trash2 size={14} />
                  <span>Quitar del carrito</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={disabled || !activeCustomer || !Number(amount)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Coins size={14} />
                <span>
                  {existingDebtItem ? "Actualizar en carrito" : "Agregar al carrito"}
                  {Number(amount) > 0 ? ` (${currency.format(Number(amount))})` : ""}
                </span>
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};
