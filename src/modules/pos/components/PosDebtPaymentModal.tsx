import { useEffect, useMemo, useState } from "react";
import {
  Coins,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Trash2,
  Package,
  Banknote,
  UserCheck,
  Minus,
  Plus,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { cn } from "@/utils/cn";
import type { Customer, ReturnablePackageType } from "@/types/entities";
import type { PosCartItem } from "@/modules/pos/hooks/usePosSale";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { auditService } from "@/services/audit.service";
import {
  parseCustomerPackageDebts,
  serializeCustomerPackageDebts,
  useTenantReturnablePackages,
  COMMON_RETURNABLE_PACKAGES,
} from "@/utils/returnable-packages";

interface PosDebtPaymentModalProps {
  open: boolean;
  customers: Customer[];
  selectedCustomer: Customer | null;
  existingDebtItem: PosCartItem | null;
  disabled?: boolean;
  tenantId?: string;
  userId?: string | null;
  openCashSessionId?: string | null;
  configuredPackages?: ReturnablePackageType[];
  onClose: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  onConfirm: (payload: { customer: Customer; amount: number; notes: string }) => void;
  onAddPackageRefund?: (payload: {
    packageName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    customer?: Customer | null;
  }) => void;
  onRemoveExisting?: () => void;
  onCustomerUpdated?: (customer: Customer) => void;
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
  tenantId = "",
  userId = null,
  openCashSessionId = null,
  configuredPackages = [],
  onClose,
  onSelectCustomer,
  onConfirm,
  onAddPackageRefund,
  onRemoveExisting,
  onCustomerUpdated,
}: PosDebtPaymentModalProps) => {
  const { success: toastSuccess, error: toastError } = useToast();

  // Pestaña principal: "debt" (Cobro de saldo $) o "returnables" (Devolución de envases 📦)
  const [activeTab, setActiveTab] = useState<"debt" | "returnables">("debt");

  // Sub-destino en devolución de envases: "account" (Descontar de Cta. Cte.) o "cash_refund" (Devolver vale en caja)
  const [returnDestination, setReturnDestination] = useState<"account" | "cash_refund">("account");

  // Estado del cliente
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(selectedCustomer);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Estado pestaña Cobro de Deuda ($)
  const [amount, setAmount] = useState<string>("");
  const [concept, setConcept] = useState<string>("Cancelación parcial de cuenta corriente");

  // Estado pestaña Devolución de Envases (📦)
  const [selectedReturnPackage, setSelectedReturnPackage] = useState<string>("");
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [refundUnitPrice, setRefundUnitPrice] = useState<string>("");
  const [returnNotes, setReturnNotes] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);

  // Envases configurados del comercio
  const { packages: tenantPackagesHook } = useTenantReturnablePackages(tenantId || null);
  const availablePackages = useMemo(() => {
    if (configuredPackages.length > 0) return configuredPackages;
    if (tenantPackagesHook.length > 0) return tenantPackagesHook;
    return COMMON_RETURNABLE_PACKAGES;
  }, [configuredPackages, tenantPackagesHook]);

  // Sincronizar estado cuando se abre o cambia cliente / ítem existente
  useEffect(() => {
    if (open) {
      const initialCust = selectedCustomer ?? null;
      setActiveCustomer(initialCust);
      setIsSearchingCustomer(!initialCust);
      setCustomerSearch("");
      setError(null);
      setIsSubmittingInternal(false);

      if (existingDebtItem) {
        setActiveTab("debt");
        setAmount(existingDebtItem.unit_price > 0 ? String(existingDebtItem.unit_price) : "");
        setConcept("Cancelación parcial de cuenta corriente");
      } else {
        setAmount("");
        setConcept("Cancelación parcial de cuenta corriente");
      }

      // Inicializar selección de envase con el primer envase disponible
      if (availablePackages.length > 0) {
        setSelectedReturnPackage(availablePackages[0].name);
        setRefundUnitPrice(String(availablePackages[0].suggestedPrice || 0));
      } else {
        setSelectedReturnPackage("Botella Cerveza 1L");
        setRefundUnitPrice("1500");
      }
      setReturnQuantity(1);
      setReturnNotes("");
    }
  }, [open, selectedCustomer, existingDebtItem, availablePackages]);

  // Filtrado de clientes para el buscador
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

  // Deudas de envases del cliente activo
  const activeCustomerPackageDebts = useMemo(() => {
    if (!activeCustomer?.observations) return {};
    return parseCustomerPackageDebts(activeCustomer.observations);
  }, [activeCustomer]);

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

    // Si el cliente adeuda envases, preseleccionar el primer envase adeudado
    const debts = parseCustomerPackageDebts(customer.observations);
    const owedKeys = Object.keys(debts);
    if (owedKeys.length > 0) {
      setSelectedReturnPackage(owedKeys[0]);
      setReturnQuantity(Math.min(debts[owedKeys[0]], 1));
    }
  };

  const handleQuickAmount = (val: number) => {
    if (val <= 0) return;
    setAmount(String(Number(val.toFixed(2))));
    setError(null);
  };

  // 1. Manejo del formulario de Cobro de Deuda ($)
  const handleSubmitDebtPayment = (e: React.FormEvent) => {
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

  // 2. Manejo de Devolución de Envases: Descontar de Cuenta Corriente
  const handleConfirmAccountPackageReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) {
      setError("Debes seleccionar un cliente para descontar los envases de su cuenta corriente.");
      return;
    }
    if (!selectedReturnPackage.trim()) {
      setError("Selecciona el tipo de envase devuelto.");
      return;
    }
    if (!returnQuantity || returnQuantity <= 0) {
      setError("La cantidad de envases a devolver debe ser al menos 1.");
      return;
    }

    setIsSubmittingInternal(true);
    setError(null);
    try {
      const currentDebts = { ...activeCustomerPackageDebts };
      const currentQty = currentDebts[selectedReturnPackage] || 0;
      const newQty = Math.max(0, currentQty - returnQuantity);

      if (newQty <= 0) {
        delete currentDebts[selectedReturnPackage];
      } else {
        currentDebts[selectedReturnPackage] = newQty;
      }

      const updatedObservations = serializeCustomerPackageDebts(
        activeCustomer.observations,
        currentDebts
      );

      const updated = await customersService.update(tenantId, activeCustomer.id, {
        observations: updatedObservations,
      });

      if (userId) {
        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "pos",
          action: "package_return_account",
          entity_type: "customer",
          entity_id: activeCustomer.id,
          description: `Devolución de envase asentada en Cta. Cte.: ${returnQuantity}x ${selectedReturnPackage}`,
          metadata: {
            package_name: selectedReturnPackage,
            returned_quantity: returnQuantity,
            previous_debt: currentQty,
            remaining_debt: newQty,
            notes: returnNotes.trim() || null,
          },
        });
      }

      const resolvedUpdatedCustomer = updated || {
        ...activeCustomer,
        observations: updatedObservations,
      };
      setActiveCustomer(resolvedUpdatedCustomer);
      onCustomerUpdated?.(resolvedUpdatedCustomer);

      toastSuccess(
        `Se devolvieron ${returnQuantity}x ${selectedReturnPackage} a la cuenta corriente de ${activeCustomer.full_name}.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la cuenta corriente del cliente.");
      toastError("No se pudo asentar la devolución del envase.");
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  // 3. Manejo de Devolución de Envases: Devolver Vale Cobrado (Reintegro de Caja)
  const handleConfirmCashVoucherRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnPackage.trim()) {
      setError("Selecciona el tipo de envase devuelto.");
      return;
    }
    if (!returnQuantity || returnQuantity <= 0) {
      setError("La cantidad de envases devueltos debe ser al menos 1.");
      return;
    }

    const unitPriceNum = Number(refundUnitPrice.replace(",", "."));
    if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
      setError("Ingresa un valor unitario de envase válido mayor a $0.");
      return;
    }

    const totalRefund = Number((returnQuantity * unitPriceNum).toFixed(2));
    if (totalRefund <= 0) {
      setError("El importe a reintegrar debe ser mayor a $0.");
      return;
    }

    if (onAddPackageRefund) {
      onAddPackageRefund({
        packageName: selectedReturnPackage,
        quantity: returnQuantity,
        unitPrice: unitPriceNum,
        notes: returnNotes.trim() || undefined,
        customer: activeCustomer,
      });
      onClose();
      return;
    }

    // Fallback directo si no se proveyó handler del carrito
    if (!tenantId || !openCashSessionId) {
      setError("Se requiere sesión de caja abierta.");
      return;
    }

    setIsSubmittingInternal(true);
    setError(null);
    try {
      const movementNotes = `Reintegro por devolución de vale de envase: ${returnQuantity}x ${selectedReturnPackage}${
        returnNotes.trim() ? ` (${returnNotes.trim()})` : ""
      }${activeCustomer ? ` - Cliente: ${activeCustomer.full_name}` : ""}`;

      const movement = await cashService.createMovement(tenantId, {
        cash_session_id: openCashSessionId,
        movement_type: "expense",
        amount: totalRefund,
        currency_code: "ARS",
        reference_type: "cash",
        reference_id: null,
        notes: movementNotes,
        created_by: userId,
      });

      if (userId) {
        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "pos",
          action: "package_voucher_cash_refund",
          entity_type: "cash_movement",
          entity_id: movement?.id,
          description: `Egreso de caja por devolución de envase: ${returnQuantity}x ${selectedReturnPackage} (${currency.format(totalRefund)})`,
          metadata: {
            package_name: selectedReturnPackage,
            quantity: returnQuantity,
            unit_price: unitPriceNum,
            total_refund: totalRefund,
            cash_session_id: openCashSessionId,
            customer_id: activeCustomer?.id ?? null,
          },
        });
      }

      toastSuccess(
        `Se reintegraron ${currency.format(totalRefund)} de la caja física por devolución de ${returnQuantity}x ${selectedReturnPackage}.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asentar el egreso de efectivo en la caja.");
      toastError("No se pudo registrar el egreso de caja.");
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  const parsedUnitPriceNum = Number(refundUnitPrice.replace(",", ".")) || 0;
  const totalRefundAmount = Number((returnQuantity * parsedUnitPriceNum).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-3 sm:p-4 backdrop-blur-[1px] animate-in fade-in">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white shadow-2xl dark:bg-slate-900">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4 sm:px-5 sm:py-3.5 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeTab === "debt" ? <Coins size={18} /> : <Package size={18} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {activeTab === "debt"
                  ? "Cobro de Cuenta Corriente"
                  : "Devolución de Envases Retornables"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeTab === "debt"
                  ? "Agrega al carrito un monto para cancelar deuda del cliente"
                  : "Descontar de cuenta corriente o reintegrar vale en efectivo de caja"}
              </p>
            </div>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={disabled || isSubmittingInternal} />
        </header>

        {/* Pestañas de Modo Superior */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/90 px-4 py-2">
          <div className="flex gap-1 rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800 dark:border dark:border-slate-700/80 w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("debt");
                setError(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                activeTab === "debt"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
            >
              <Coins size={15} />
              <span>Cobro de Deuda ($)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("returnables");
                setError(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                activeTab === "returnables"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
            >
              <Package size={15} />
              <span>Devolución de Envases (📦)</span>
            </button>
          </div>
        </div>

        {/* Contenido según la pestaña activa */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 1: COBRO DE SALDO EN DINERO ($)                        */}
          {/* ============================================================== */}
          {activeTab === "debt" && (
            <form onSubmit={handleSubmitDebtPayment} autoComplete="off" className="space-y-4">
              {/* 1. SECCIÓN CLIENTE */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  1. Cliente de la Cuenta Corriente
                </label>

                {activeCustomer && !isSearchingCustomer ? (
                  <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-slate-50/80 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
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
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 transition ml-2 shrink-0 cursor-pointer"
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
                              className="flex w-full items-center justify-between p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-lg transition cursor-pointer"
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
                        className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
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
                        className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 transition cursor-pointer"
                      >
                        Total: {currency.format(currentDebt)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(currentDebt / 2)}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 transition cursor-pointer"
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
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition cursor-pointer"
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
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={disabled || !activeCustomer || !Number(amount)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
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
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: DEVOLUCIÓN DE ENVASES (📦)                         */}
          {/* ============================================================== */}
          {activeTab === "returnables" && (
            <div className="space-y-4">
              {/* SELECTOR DE MODALIDAD / DESTINO */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  ¿Cómo se registra la devolución del envase?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnDestination("account");
                      setError(null);
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer select-none",
                      returnDestination === "account"
                        ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 dark:border-purple-600 shadow-xs ring-1 ring-purple-500"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold",
                        returnDestination === "account"
                          ? "bg-purple-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <UserCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Descontar de Cta. Cte.
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        El cliente devuelve envases adeudados. Se descuentan de su ficha.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnDestination("cash_refund");
                      setError(null);
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer select-none",
                      returnDestination === "cash_refund"
                        ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-600 shadow-xs ring-1 ring-amber-500"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold",
                        returnDestination === "cash_refund"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <Banknote size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Devolver Vale Cobrado (Caja)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Devolver el dinero al cliente y descontar el equivalente de la caja.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* CASO A: DESCONTAR DE CUENTA CORRIENTE                        */}
              {/* ------------------------------------------------------------ */}
              {returnDestination === "account" && (
                <form onSubmit={handleConfirmAccountPackageReturn} autoComplete="off" className="space-y-4">
                  {/* SELECCIÓN DE CLIENTE */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      1. Cliente de la Cuenta Corriente
                    </label>

                    {activeCustomer && !isSearchingCustomer ? (
                      <div className="rounded-xl border border-slate-300 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-xs">
                              {activeCustomer.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {activeCustomer.full_name}
                              </p>
                              {activeCustomer.document_number ? (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  DNI/CUIT: {activeCustomer.document_number}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsSearchingCustomer(true)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shrink-0 cursor-pointer"
                          >
                            Cambiar
                          </button>
                        </div>

                        {/* Listado de Envases que debe este cliente */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Envases adeudados por el cliente actualmente:
                          </span>
                          {Object.keys(activeCustomerPackageDebts).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(activeCustomerPackageDebts).map(([pkgName, qty]) => (
                                <button
                                  key={pkgName}
                                  type="button"
                                  onClick={() => {
                                    setSelectedReturnPackage(pkgName);
                                    setReturnQuantity(Math.min(qty, 1));
                                  }}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition cursor-pointer select-none",
                                    selectedReturnPackage === pkgName
                                      ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                      : "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700 hover:bg-purple-200"
                                  )}
                                  title="Hacé clic para seleccionar este envase devuelto"
                                >
                                  <span>📦 {pkgName}:</span>
                                  <span className="underline font-extrabold">{qty} adeudados</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 size={13} className="shrink-0" />
                              El cliente está al día (no registra deuda de envases).
                            </p>
                          )}
                        </div>
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
                            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                          />
                        </div>

                        <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800/60">
                          {filteredCustomers.length ? (
                            filteredCustomers.map((c) => {
                              const cDebts = parseCustomerPackageDebts(c.observations);
                              const totalEnvases = Object.values(cDebts).reduce((acc, v) => acc + v, 0);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(c)}
                                  className="flex w-full items-center justify-between p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-lg transition cursor-pointer"
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
                                      totalEnvases > 0
                                        ? "text-purple-600 dark:text-purple-400"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {totalEnvases > 0 ? `Debe ${totalEnvases} envases` : "Sin deuda de envases"}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="p-3 text-center text-xs text-slate-400">No se encontraron clientes</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. ENVASE Y CANTIDAD A DEVOLVER */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      2. Tipo de envase que devuelve
                    </label>

                    {/* Grilla de envases disponibles */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {availablePackages.map((pkg) => {
                        const isOwed = (activeCustomerPackageDebts[pkg.name] || 0) > 0;
                        const isSelected = selectedReturnPackage === pkg.name;
                        return (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() => {
                              setSelectedReturnPackage(pkg.name);
                              setError(null);
                            }}
                            className={cn(
                              "p-2 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex flex-col justify-between",
                              isSelected
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-950 dark:text-purple-100 font-bold ring-1 ring-purple-500"
                                : isOwed
                                ? "border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 hover:border-purple-400 text-purple-900 dark:text-purple-300"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <span className="truncate">{pkg.name}</span>
                            {isOwed ? (
                              <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold mt-1">
                                Debe: {activeCustomerPackageDebts[pkg.name]} u.
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cantidad devuelta con stepper */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Cantidad de envases devueltos
                      </label>
                      {activeCustomer && selectedReturnPackage && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Adeuda actualmente:{" "}
                          <strong className="text-purple-600 dark:text-purple-400">
                            {activeCustomerPackageDebts[selectedReturnPackage] || 0} u.
                          </strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setReturnQuantity((prev) => Math.max(1, prev - 1))}
                          className="h-full w-10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none cursor-pointer border-r border-slate-200 dark:border-slate-800"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={returnQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setReturnQuantity(Number.isFinite(val) && val > 0 ? val : 1);
                          }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          className="h-full w-14 text-center font-bold text-sm text-slate-900 dark:text-slate-100 bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setReturnQuantity((prev) => prev + 1)}
                          className="h-full w-10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none cursor-pointer border-l border-slate-200 dark:border-slate-800"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Botones de acceso rápido para cancelar deuda exacta */}
                      {activeCustomer && (activeCustomerPackageDebts[selectedReturnPackage] || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setReturnQuantity(activeCustomerPackageDebts[selectedReturnPackage])}
                          className="px-2.5 py-2 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold transition cursor-pointer"
                        >
                          Devolver todo ({activeCustomerPackageDebts[selectedReturnPackage]} u.)
                        </button>
                      )}
                    </div>

                    {/* Previsualización del saldo posterior */}
                    {activeCustomer && selectedReturnPackage && (
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Nuevo saldo: quedarán{" "}
                        <strong className="text-purple-600 dark:text-purple-400">
                          {Math.max(
                            0,
                            (activeCustomerPackageDebts[selectedReturnPackage] || 0) - returnQuantity
                          )}{" "}
                          envases adeudados
                        </strong>{" "}
                        en su cuenta corriente.
                      </p>
                    )}
                  </div>

                  {/* Observación opcional */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Observación / Motivo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Ej: Devolución de envases vacíos en mostrador..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  {/* Pie de Acciones */}
                  <footer className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmittingInternal}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={disabled || isSubmittingInternal || !activeCustomer || !selectedReturnPackage}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isSubmittingInternal ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Actualizando...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={14} />
                          <span>
                            Descontar {returnQuantity} {returnQuantity === 1 ? "envase" : "envases"} de Cta. Cte.
                          </span>
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              )}

              {/* ------------------------------------------------------------ */}
              {/* CASO B: DEVOLVER VALE COBRADO (REINTEGRO DE CAJA)            */}
              {/* ------------------------------------------------------------ */}
              {returnDestination === "cash_refund" && (
                <form onSubmit={handleConfirmCashVoucherRefund} autoComplete="off" className="space-y-4">
                  {/* SELECCIÓN DEL ENVASE DEVUELTO */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      1. Tipo de envase devuelto
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {availablePackages.map((pkg) => {
                        const isSelected = selectedReturnPackage === pkg.name;
                        return (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() => {
                              setSelectedReturnPackage(pkg.name);
                              if (pkg.suggestedPrice) {
                                setRefundUnitPrice(String(pkg.suggestedPrice));
                              }
                              setError(null);
                            }}
                            className={cn(
                              "p-2 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex flex-col justify-between",
                              isSelected
                                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 font-bold ring-1 ring-amber-500 shadow-2xs"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <span className="truncate">{pkg.name}</span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono mt-1 font-bold">
                              {currency.format(pkg.suggestedPrice || 0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. CANTIDAD Y PRECIO UNITARIO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Cantidad devuelta
                      </label>
                      <div className="flex items-center h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setReturnQuantity((prev) => Math.max(1, prev - 1))}
                          className="h-full w-10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none cursor-pointer border-r border-slate-200 dark:border-slate-800"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={returnQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setReturnQuantity(Number.isFinite(val) && val > 0 ? val : 1);
                          }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          className="h-full flex-1 text-center font-bold text-sm text-slate-900 dark:text-slate-100 bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setReturnQuantity((prev) => prev + 1)}
                          className="h-full w-10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none cursor-pointer border-l border-slate-200 dark:border-slate-800"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Valor unitario del envase ($)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          required
                          value={refundUnitPrice}
                          onChange={(e) => {
                            setRefundUnitPrice(e.target.value);
                            setError(null);
                          }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          className="w-full h-10 rounded-xl border border-slate-300 bg-white pl-7 pr-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumen del total a devolver */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                        Total a reintegrar al cliente:
                      </span>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300">
                        {returnQuantity} {returnQuantity === 1 ? "envase" : "envases"} x {currency.format(parsedUnitPriceNum)}
                      </span>
                    </div>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono tracking-tight">
                      {currency.format(totalRefundAmount)}
                    </span>
                  </div>

                  {/* Aviso de Impacto en Carrito y Caja */}
                  <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                      <Banknote size={15} />
                      <span>Impacto en la venta y carrito:</span>
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      Se agregará un artículo <strong>Devolución de envase: {selectedReturnPackage || "Envase"}</strong> con valor en <strong>negativo (-{currency.format(totalRefundAmount)})</strong>.
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      • Si el cliente lleva productos, se <strong>descontará automáticamente</strong> del total de la compra.<br />
                      • Si no lleva productos o queda saldo a favor, figurará como un <strong>egreso de efectivo</strong> de la caja física.
                    </p>
                  </div>

                  {/* Observación opcional */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Concepto / Observación (Opcional)
                    </label>
                    <input
                      type="text"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Ej: Devolución de seña de envase / Vale #..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  {/* Pie de Acciones */}
                  <footer className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmittingInternal}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={
                        disabled ||
                        isSubmittingInternal ||
                        !selectedReturnPackage ||
                        totalRefundAmount <= 0
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isSubmittingInternal ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Agregando al carrito...</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={14} />
                          <span>
                            Agregar Devolución al Carrito (-{currency.format(totalRefundAmount)})
                          </span>
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
