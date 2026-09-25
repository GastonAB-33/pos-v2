import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CreditCard,
  DollarSign,
  Landmark,
  Layers,
  Plus,
  Receipt,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import type { BankAccount, CashSession, Supplier } from "@/types/entities";
import type {
  PurchasePaymentMethod,
  PurchasePaymentSplitItem,
  PurchasePaymentValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchasePaymentModalProps {
  open: boolean;
  total: number;
  supplier: Supplier | null;
  documentType: string;
  documentNumber: string;
  bankAccounts: BankAccount[];
  openCashSession: CashSession | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (paymentValues: PurchasePaymentValues) => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getDocumentLabel = (type: string): string => {
  const map: Record<string, string> = {
    FACTURA_A: "Factura A",
    FACTURA_B: "Factura B",
    FACTURA_C: "Factura C",
    REMITO: "Remito",
    TICKET: "Ticket",
    PRESUPUESTO: "Presupuesto",
    OTRO: "Otro",
  };
  return map[type] || type;
};

const getAccountTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    caja_ahorro_pesos: "Caja de Ahorro ($)",
    corriente_pesos: "Cta. Corriente ($)",
    caja_ahorro_dolares: "Caja de Ahorro (USD)",
    corriente_dolares: "Cta. Corriente (USD)",
    otro: "Cuenta bancaria",
  };
  return map[type] || type;
};

const getMethodLabel = (method: PurchasePaymentMethod): string => {
  const map: Record<PurchasePaymentMethod, string> = {
    cash_daily: "Caja Diaria",
    cash_general: "Caja General",
    cash: "Efectivo Directo",
    transfer: "Transferencia Bancaria",
    current_account: "Cuenta Corriente",
    card_debit: "Tarjeta Débito",
    card_credit: "Tarjeta Crédito",
    other: "Otro",
  };
  return map[method] || method;
};

const roundAmount = (val: number): number => Number(val.toFixed(2));

export const PurchasePaymentModal = ({
  open,
  total,
  supplier,
  documentType,
  documentNumber,
  bankAccounts,
  openCashSession,
  isSubmitting = false,
  onClose,
  onConfirm,
}: PurchasePaymentModalProps) => {
  // Modo de pago: "single" (por defecto, ágil 1-clic) o "split" (combinado)
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");

  // Estado para pago único
  const [selectedMethod, setSelectedMethod] = useState<PurchasePaymentMethod>("cash_daily");
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    const firstActive = bankAccounts.find((a) => a.is_active);
    return firstActive?.id || bankAccounts[0]?.id || "";
  });
  const [transferVoucher, setTransferVoucher] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Estado para pagos combinados
  const [splitPayments, setSplitPayments] = useState<PurchasePaymentSplitItem[]>([]);
  const [splitMethod, setSplitMethod] = useState<PurchasePaymentMethod>("cash_daily");
  const [splitAmountInput, setSplitAmountInput] = useState<string>(() => total.toFixed(2));
  const [splitBankId, setSplitBankId] = useState<string>(() => {
    const firstActive = bankAccounts.find((a) => a.is_active);
    return firstActive?.id || bankAccounts[0]?.id || "";
  });
  const [splitVoucher, setSplitVoucher] = useState("");
  const [splitDueDate, setSplitDueDate] = useState("");
  const [splitNotes, setSplitNotes] = useState("");
  const [splitError, setSplitError] = useState<string | null>(null);

  if (!open) return null;

  const activeBankAccounts = bankAccounts.filter((a) => a.is_active);

  // Cálculos para modo combinado
  const paidTotal = roundAmount(splitPayments.reduce((acc, p) => acc + p.amount, 0));
  const remainingTotal = roundAmount(Math.max(0, total - paidTotal));
  const isFullyCovered = Math.abs(paidTotal - total) <= 0.01;

  const handleAddSplitPayment = () => {
    setSplitError(null);
    const parsedAmount = parseFloat(splitAmountInput.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setSplitError("Ingresá un monto válido mayor a 0.");
      return;
    }

    if (parsedAmount > remainingTotal + 0.01) {
      setSplitError(
        `El monto ($${parsedAmount.toFixed(2)}) supera el saldo restante ($${remainingTotal.toFixed(2)}).`
      );
      return;
    }

    const newItem: PurchasePaymentSplitItem = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      paymentMethod: splitMethod,
      amount: roundAmount(parsedAmount),
      bankAccountId: splitMethod === "transfer" ? splitBankId : undefined,
      voucherNumber: splitMethod === "transfer" ? splitVoucher.trim() : undefined,
      dueDate: splitMethod === "current_account" ? splitDueDate : undefined,
      paymentNotes: splitNotes.trim() || undefined,
    };

    const nextPayments = [...splitPayments, newItem];
    setSplitPayments(nextPayments);

    const nextPaid = roundAmount(nextPayments.reduce((acc, p) => acc + p.amount, 0));
    const nextRemaining = roundAmount(Math.max(0, total - nextPaid));
    setSplitAmountInput(nextRemaining > 0 ? nextRemaining.toFixed(2) : "");
    setSplitVoucher("");
    setSplitNotes("");
  };

  const handleRemoveSplitPayment = (id: string) => {
    const nextPayments = splitPayments.filter((p) => p.id !== id);
    setSplitPayments(nextPayments);
    const nextPaid = roundAmount(nextPayments.reduce((acc, p) => acc + p.amount, 0));
    const nextRemaining = roundAmount(Math.max(0, total - nextPaid));
    setSplitAmountInput(nextRemaining.toFixed(2));
    setSplitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (paymentMode === "split") {
      if (splitPayments.length === 0) {
        setSplitError("Debes agregar al menos un pago en el detalle.");
        return;
      }
      if (!isFullyCovered) {
        setSplitError(`Resta cubrir ${currency.format(remainingTotal)} para completar el total.`);
        return;
      }

      await onConfirm({
        paymentMethod: splitPayments[0]?.paymentMethod || "cash_daily",
        isSplitPayment: true,
        payments: splitPayments,
        paymentNotes: paymentNotes.trim() || undefined,
      });
      return;
    }

    // Modo Único
    await onConfirm({
      paymentMethod: selectedMethod,
      bankAccountId: selectedMethod === "transfer" ? selectedBankId : undefined,
      voucherNumber: selectedMethod === "transfer" ? transferVoucher.trim() : undefined,
      dueDate: selectedMethod === "current_account" ? dueDate : undefined,
      paymentNotes: paymentNotes.trim() || undefined,
      isSplitPayment: false,
    });
  };

  const paymentOptions: Array<{
    id: PurchasePaymentMethod;
    label: string;
    description: string;
    icon: typeof Wallet;
    badge?: { text: string; variant: "success" | "warning" | "neutral" };
  }> = [
    {
      id: "cash_daily",
      label: "Caja Diaria",
      description: "Efectivo con egreso en la sesión de mostrador",
      icon: Wallet,
      badge: openCashSession
        ? { text: "Caja abierta", variant: "success" }
        : { text: "Sin caja abierta", variant: "warning" },
    },
    {
      id: "cash_general",
      label: "Caja General",
      description: "Fondos de caja fuerte o administración",
      icon: Building2,
      badge: { text: "Fondos grales.", variant: "neutral" },
    },
    {
      id: "cash",
      label: "Efectivo Directo",
      description: "Pago directo sin impactar sesión de turno",
      icon: DollarSign,
    },
    {
      id: "transfer",
      label: "Transferencia Bancaria",
      description: "Desde cuenta bancaria propia del negocio",
      icon: Landmark,
      badge:
        activeBankAccounts.length > 0
          ? { text: `${activeBankAccounts.length} cuenta(s)`, variant: "neutral" }
          : undefined,
    },
    {
      id: "current_account",
      label: "Cuenta Corriente",
      description: "Deuda a pagar registrada con el proveedor",
      icon: CreditCard,
      badge: { text: "A crédito", variant: "neutral" },
    },
  ];

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-payment-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header con monto destacado y botón de cierre */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 p-4.5 sm:p-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
              Confirmar y Registrar Compra
            </span>
            <h2 id="purchase-payment-title" className="text-xl font-black text-slate-900">
              {paymentMode === "single" ? "Método de Pago" : "Pago Combinado / Dividido"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {paymentMode === "single"
                ? "Seleccioná cómo se abona la compra para asentar los movimientos correspondientes"
                : "Distribuí el total entre múltiples medios de pago (efectivo, bancos, cta. cte.)"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total compra
              </span>
              <span className="text-xl font-black text-brand-700 sm:text-2xl">
                {currency.format(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition disabled:opacity-50"
              title="Cerrar ventana"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumen del comprobante y proveedor */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-brand-50/30 px-5 py-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 truncate">
            <User className="h-3.5 w-3.5 text-brand-600 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">
              {supplier?.name || "Sin proveedor"}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 truncate text-right">
            <Receipt className="h-3.5 w-3.5 text-brand-600 shrink-0" />
            <span className="font-medium text-slate-600 truncate">
              {getDocumentLabel(documentType)} {documentNumber ? `Nº ${documentNumber}` : ""}
            </span>
          </div>
        </div>

        {/* Selector de modo: Pago Único vs Pago Combinado */}
        <div className="border-b border-slate-200/80 bg-slate-50 px-5 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode("single")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                paymentMode === "single"
                  ? "bg-white text-brand-700 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Pago Único (Rápido)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMode("split");
                if (splitPayments.length === 0) {
                  setSplitAmountInput(total.toFixed(2));
                }
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                paymentMode === "split"
                  ? "bg-white text-brand-700 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Pago Combinado
              {splitPayments.length > 0 && (
                <span className="ml-1 rounded-full bg-brand-100 text-brand-800 px-1.5 py-0.2 text-[10px]">
                  {splitPayments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cuerpo del formulario scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* MODO 1: PAGO ÚNICO */}
          {paymentMode === "single" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Elegí la forma de pago:
                </label>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {paymentOptions.map((option) => {
                    const isSelected = selectedMethod === option.id;
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedMethod(option.id)}
                        className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-brand-600 bg-brand-50/60 shadow-xs ring-2 ring-brand-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-brand-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-bold ${
                                isSelected ? "text-brand-900" : "text-slate-800"
                              }`}
                            >
                              {option.label}
                            </span>
                            {option.badge ? (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                  option.badge.variant === "success"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : option.badge.variant === "warning"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {option.badge.text}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                            {option.description}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 text-brand-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Panel Condicional: Detalles según el método elegido */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 text-xs">
                {/* 1. Caja Diaria */}
                {selectedMethod === "cash_daily" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <Wallet className="h-4 w-4 text-brand-600" />
                      <span>Pago con efectivo de Caja Diaria</span>
                    </div>
                    {openCashSession ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-800">
                        <p className="font-semibold text-xs flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Sesión de caja activa (ID #{openCashSession.id.slice(-6)})
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-700">
                          Al confirmar la compra, se generará automáticamente un movimiento de egreso
                          por <strong>{currency.format(total)}</strong> en esta caja diaria.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-800">
                        <p className="font-semibold text-xs flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                          No tenés una caja diaria abierta en este momento
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          La compra se registrará como pago en efectivo pero no podrá asentarse como
                          egreso en ninguna sesión abierta.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Caja General */}
                {selectedMethod === "cash_general" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <Building2 className="h-4 w-4 text-brand-600" />
                      <span>Fondos de Caja General / Caja Fuerte</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      El pago de <strong>{currency.format(total)}</strong> se asienta como abonado en
                      efectivo con dinero de administración central. <strong>No descuenta</strong> del
                      arqueo de la caja diaria de ventas del mostrador.
                    </p>
                  </div>
                )}

                {/* 3. Efectivo Directo */}
                {selectedMethod === "cash" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <DollarSign className="h-4 w-4 text-brand-600" />
                      <span>Efectivo directo</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Pago en efectivo general. No altera sesiones de caja del turno actual.
                    </p>
                  </div>
                )}

                {/* 4. Transferencia Bancaria */}
                {selectedMethod === "transfer" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <Landmark className="h-4 w-4 text-brand-600" />
                      <span>Transferencia desde Cuenta Bancaria Propia</span>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-semibold text-slate-700">
                        Seleccioná tu cuenta bancaria de origen *:
                      </label>
                      {activeBankAccounts.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                          No hay cuentas bancarias activas registradas en el sistema.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {activeBankAccounts.map((account) => {
                            const isAccSelected = selectedBankId === account.id;
                            return (
                              <label
                                key={account.id}
                                className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition ${
                                  isAccSelected
                                    ? "border-brand-500 bg-white shadow-xs ring-1 ring-brand-500"
                                    : "border-slate-200 bg-white/70 hover:bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="radio"
                                    name="bankAccount"
                                    value={account.id}
                                    checked={isAccSelected}
                                    onChange={() => setSelectedBankId(account.id)}
                                    className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                                  />
                                  <div>
                                    <span className="font-bold text-slate-900">
                                      {account.bank_name}
                                    </span>
                                    <span className="ml-1.5 text-[10px] text-slate-500">
                                      ({getAccountTypeLabel(account.account_type)})
                                    </span>
                                  </div>
                                </div>
                                <span className="font-mono text-[10px] font-semibold text-slate-500">
                                  {account.currency_code}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        Nº de Comprobante / Referencia (opcional):
                      </label>
                      <input
                        type="text"
                        value={transferVoucher}
                        onChange={(e) => setTransferVoucher(e.target.value)}
                        placeholder="Ej: 00938472 / Ref: PAGO-PROV"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}

                {/* 5. Cuenta Corriente Proveedor */}
                {selectedMethod === "current_account" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <CreditCard className="h-4 w-4 text-brand-600" />
                      <span>Compra a Crédito en Cuenta Corriente del Proveedor</span>
                    </div>

                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-blue-900">
                      <p className="font-semibold text-xs">
                        Proveedor: {supplier?.name || "Proveedor seleccionado"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-blue-700">
                        Se generará automáticamente un saldo deudor por{" "}
                        <strong>{currency.format(total)}</strong> en Cuentas Corrientes Proveedores.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        Fecha acordada de vencimiento / pago (opcional):
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* MODO 2: PAGO COMBINADO */}
          {paymentMode === "split" && (
            <div className="space-y-4">
              {/* Barra de progreso / Estado de pagos */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{currency.format(total)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Abonado
                  </span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {currency.format(paidTotal)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Resta abonar
                  </span>
                  <span
                    className={`font-black text-sm ${
                      isFullyCovered ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {isFullyCovered ? "¡Completado!" : currency.format(remainingTotal)}
                  </span>
                </div>
              </div>

              {/* Detalle de pagos registrados (Live list) */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
                  <span>Detalle de pagos agregados:</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {splitPayments.length} método(s)
                  </span>
                </label>

                {splitPayments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                    Todavía no agregaste pagos. Usá el formulario inferior para agregar el primer
                    pago parcial.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {splitPayments.map((item, idx) => {
                      const bank =
                        item.bankAccountId && item.paymentMethod === "transfer"
                          ? bankAccounts.find((b) => b.id === item.bankAccountId)
                          : null;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/60 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">
                                {getMethodLabel(item.paymentMethod)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {bank ? `Banco: ${bank.bank_name}` : ""}
                                {item.voucherNumber ? ` • Comp: ${item.voucherNumber}` : ""}
                                {item.dueDate ? ` • Vence: ${item.dueDate}` : ""}
                                {item.paymentNotes ? ` • ${item.paymentNotes}` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-900 text-sm">
                              {currency.format(item.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitPayment(item.id)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Quitar este método de pago"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subformulario: Agregar nuevo método de pago */}
              {!isFullyCovered && (
                <div className="rounded-xl border border-brand-200/80 bg-brand-50/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-900">
                      + Agregar medio de pago a la compra
                    </span>
                    <span className="text-[11px] text-brand-700">
                      Pendiente: <strong>{currency.format(remainingTotal)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Medio de pago *:
                      </label>
                      <select
                        value={splitMethod}
                        onChange={(e) => setSplitMethod(e.target.value as PurchasePaymentMethod)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="cash_daily">Caja Diaria (Efectivo mostrador)</option>
                        <option value="cash_general">Caja General (Caja fuerte)</option>
                        <option value="cash">Efectivo Directo</option>
                        <option value="transfer">Transferencia Bancaria</option>
                        <option value="current_account">Cuenta Corriente Proveedor</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Monto a abonar *:
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remainingTotal}
                          value={splitAmountInput}
                          onChange={(e) => setSplitAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-6 pr-2.5 text-xs font-bold text-slate-900 focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Campos condicionales para el método split elegido */}
                  {splitMethod === "transfer" && (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 border-t border-brand-100 text-xs">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          Cuenta bancaria propia:
                        </label>
                        <select
                          value={splitBankId}
                          onChange={(e) => setSplitBankId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                        >
                          {activeBankAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.bank_name} ({acc.currency_code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          Nº Comprobante / Ref. (opcional):
                        </label>
                        <input
                          type="text"
                          value={splitVoucher}
                          onChange={(e) => setSplitVoucher(e.target.value)}
                          placeholder="Ej: 098483"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {splitMethod === "current_account" && (
                    <div className="pt-1 border-t border-brand-100 text-xs">
                      <label className="mb-1 block font-semibold text-slate-700">
                        Fecha acordada de vencimiento (opcional):
                      </label>
                      <input
                        type="date"
                        value={splitDueDate}
                        onChange={(e) => setSplitDueDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {splitError && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {splitError}
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddSplitPayment}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar este pago
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observaciones generales de pago */}
          <div className="pt-2 border-t border-slate-200/80">
            <label className="mb-1 block font-medium text-slate-600 text-xs">
              Observación o nota adicional del pago (opcional):
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Notas sobre el pago o entrega de dinero..."
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Footer con botones de acción */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Volver a la compra
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                (paymentMode === "split" && (!isFullyCovered || splitPayments.length === 0))
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting
                ? "Registrando compra..."
                : paymentMode === "split"
                ? `Confirmar compra combinada (${currency.format(total)})`
                : `Confirmar y pagar ${currency.format(total)}`}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
