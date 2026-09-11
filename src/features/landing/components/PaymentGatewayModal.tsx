import React, { useState } from "react";
import {
  CreditCard,
  Building,
  CheckCircle2,
  X,
  ArrowRight,
  Lock,
  Download,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Receipt,
  FileCheck,
} from "lucide-react";
import { JirehLogo } from "@/components/brand/JirehLogo";
import { useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";

export interface PlanDetails {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPricePerMonth: number;
  period: "monthly" | "annual";
}

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDetails;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  plan,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<"checkout" | "processing" | "success">("checkout");
  const [paymentMethod, setPaymentMethod] = useState<"mercadopago" | "card" | "transfer">("mercadopago");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">(plan.period);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCbu, setCopiedCbu] = useState(false);

  // Datos de facturación
  const [billingData, setBillingData] = useState({
    businessName: "",
    taxId: "", // CUIT/DNI
    fullName: "",
    email: "",
    phone: "",
  });

  // Datos de tarjeta
  const [cardData, setCardData] = useState({
    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",
    installments: "1",
  });

  if (!isOpen) return null;

  const finalMonthlyPrice = billingPeriod === "annual" ? plan.annualPricePerMonth : plan.monthlyPrice;
  const totalToPay = billingPeriod === "annual" ? finalMonthlyPrice * 12 : finalMonthlyPrice;
  const savings = billingPeriod === "annual" ? (plan.monthlyPrice - plan.annualPricePerMonth) * 12 : 0;

  const handleCopy = (text: string, type: "alias" | "cbu") => {
    navigator.clipboard.writeText(text);
    if (type === "alias") {
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    } else {
      setCopiedCbu(true);
      setTimeout(() => setCopiedCbu(false), 2000);
    }
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep("processing");
    setTimeout(() => {
      setCurrentStep("success");
    }, 1800);
  };

  const transactionCode = `JIREH-TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const formattedToday = new Date().toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl my-6 overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Barra superior con gradiente de la marca Jireh (Turquesa, Verde Lima y Naranja) */}
        <div className="h-2.5 w-full bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800]" />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Cerrar pasarela de pago"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-5 sm:p-7">
          {currentStep === "checkout" && (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <JirehLogo size="sm" />
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    Pasarela Segura SSL 256-bit
                  </span>
                </div>
                <div className="text-right pr-6 sm:pr-0">
                  <span className="text-xs text-slate-400 block">Total a pagar:</span>
                  <span className="text-xl font-extrabold text-slate-900">
                    ${totalToPay.toLocaleString("es-AR")}
                    <span className="text-xs font-medium text-slate-500 ml-1">
                      {billingPeriod === "annual" ? "ARS /año (por sucursal)" : "ARS /mes (por sucursal)"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Selector de frecuencia */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-2 border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 pl-2">
                  Plan seleccionado: <span className="text-sky-700 font-bold">{plan.name}</span>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("monthly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      billingPeriod === "monthly"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("annual")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition ${
                      billingPeriod === "annual"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Anual</span>
                    <span className="rounded bg-amber-400/30 text-amber-800 text-[10px] font-extrabold">
                      -20%
                    </span>
                  </button>
                </div>
              </div>

              {billingPeriod === "annual" && savings > 0 && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-200 flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span>¡Genial! Con la suscripción anual estás ahorrando <strong>${savings.toLocaleString("es-AR")} ARS al año por sucursal</strong>.</span>
                </div>
              )}

              <form onSubmit={handleProcessPayment} className="mt-5 space-y-4">
                {/* 1. Datos de Facturación */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    1. Datos de Titular y Facturación
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nombre o Comercio *</label>
                      <input
                        type="text"
                        required
                        value={billingData.businessName}
                        onChange={(e) => setBillingData({ ...billingData, businessName: e.target.value })}
                        placeholder="Ej. Tienda Central"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">CUIT / DNI *</label>
                      <input
                        type="text"
                        required
                        value={billingData.taxId}
                        onChange={(e) => setBillingData({ ...billingData, taxId: e.target.value })}
                        placeholder="20-12345678-9"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Email de facturación y acceso *</label>
                      <input
                        type="email"
                        required
                        value={billingData.email}
                        onChange={(e) => setBillingData({ ...billingData, email: e.target.value })}
                        placeholder="cuenta@comercio.com"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp / Teléfono *</label>
                      <input
                        type="tel"
                        required
                        value={billingData.phone}
                        onChange={(e) => setBillingData({ ...billingData, phone: e.target.value })}
                        placeholder="+54 9 11 9876-5432"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Selector de Pasarela / Medio de Pago */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    2. Selecciona la Pasarela de Pago
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Mercado Pago */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("mercadopago")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        paymentMethod === "mercadopago"
                          ? "border-sky-600 bg-sky-50/80 text-sky-900 ring-2 ring-sky-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 mb-1">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">Mercado Pago</span>
                      <span className="text-[10px] text-slate-500">Saldo, Débito o QR</span>
                    </button>

                    {/* Tarjeta de Crédito / Débito */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        paymentMethod === "card"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">Tarjetas</span>
                      <span className="text-[10px] text-slate-500">Crédito y Débito</span>
                    </button>

                    {/* Transferencia Bancaria Directa */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transfer")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        paymentMethod === "transfer"
                          ? "border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
                        <Building className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">Transferencia</span>
                      <span className="text-[10px] text-slate-500">CBU / Alias</span>
                    </button>
                  </div>
                </div>

                {/* Sub-formulario según método elegido */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  {paymentMethod === "mercadopago" && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sky-700 font-bold text-sm">
                          <QrCode className="h-5 w-5" />
                          <span>Pagar con Mercado Pago Checkout</span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Acreditación instantánea
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Al hacer clic en "Procesar Pago", se conectará de manera segura con Mercado Pago para abonar con tu dinero en cuenta, tarjeta guardada o escaneando el código QR oficial.
                      </p>
                      <div className="rounded-lg bg-white p-3 border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-600">Comercio receptor:</span>
                        <span className="font-bold text-slate-800">Jireh POS Solutions</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "card" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Número de Tarjeta</label>
                        <input
                          type="text"
                          required
                          value={cardData.cardNumber}
                          onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })}
                          placeholder="4500 0000 0000 0000"
                          maxLength={19}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Nombre en la Tarjeta</label>
                          <input
                            type="text"
                            required
                            value={cardData.cardHolder}
                            onChange={(e) => setCardData({ ...cardData, cardHolder: e.target.value })}
                            placeholder="TAL CUAL FIGURA"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white focus:border-emerald-500 focus:outline-none uppercase"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Vto (MM/AA)</label>
                            <input
                              type="text"
                              required
                              value={cardData.expiry}
                              onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                              placeholder="12/28"
                              maxLength={5}
                              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-900 bg-white text-center focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                            <input
                              type="password"
                              required
                              value={cardData.cvv}
                              onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                              placeholder="123"
                              maxLength={4}
                              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-900 bg-white text-center focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "transfer" && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-600">
                        Realiza la transferencia por el total exacto de <strong className="text-slate-900">${totalToPay.toLocaleString("es-AR")}</strong> a la cuenta corporativa oficial de Jireh:
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Titular:</span>
                          <span className="font-bold text-slate-800">Jireh Sistemas Cloud S.A.S.</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">CUIT:</span>
                          <span className="font-semibold text-slate-800">30-71689234-8</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                          <span className="text-slate-500">Alias CBU:</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-sky-700">
                            <span>JIREH.POS.PAGO</span>
                            <button
                              type="button"
                              onClick={() => handleCopy("JIREH.POS.PAGO", "alias")}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copiar Alias"
                            >
                              {copiedAlias ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">CBU:</span>
                          <div className="flex items-center gap-1.5 font-mono text-slate-700">
                            <span>0000003100049281726301</span>
                            <button
                              type="button"
                              onClick={() => handleCopy("0000003100049281726301", "cbu")}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copiar CBU"
                            >
                              {copiedCbu ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        La confirmación se realiza de forma automática al registrar la transferencia.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Transacción protegida y cifrada</span>
                  </div>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-600/20 hover:scale-[1.01] active:scale-[0.99] transition"
                  >
                    <span>Confirmar y Pagar ${totalToPay.toLocaleString("es-AR")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          )}

          {currentStep === "processing" && (
            <div className="py-14 text-center">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-slate-100 border-t-sky-600" />
              <h3 className="mt-6 text-xl font-extrabold text-slate-900">
                Conectando con la pasarela de pago...
              </h3>
              <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
                Estamos validando la operación de suscripción para {plan.name}. Por favor, no cierres esta ventana.
              </p>
            </div>
          )}

          {currentStep === "success" && (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <h3 className="mt-4 text-2xl font-black text-slate-900">
                ¡Pago Aprobado con Éxito!
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Tu suscripción a <strong className="text-slate-900">Jireh POS ({plan.name})</strong> se encuentra activa y habilitada para operar.
              </p>

              {/* Recibo de pago digital */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider flex items-center gap-1">
                  <FileCheck className="h-3 w-3" />
                  Pagado
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Comprobante Electrónico Digital
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Comercio:</span>
                    <span className="font-bold text-slate-800">{billingData.businessName || "Comercio Afiliado"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fecha:</span>
                    <span className="font-medium text-slate-700">{formattedToday}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Plan:</span>
                    <span className="font-semibold text-sky-700">{plan.name} ({billingPeriod === "annual" ? "Anual" : "Mensual"})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Monto Abonado:</span>
                    <span className="font-extrabold text-emerald-600">${totalToPay.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                    <span className="text-slate-400">ID de Transacción:</span>
                    <span className="font-mono font-bold text-slate-600">{transactionCode}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(routePaths.login);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/25 hover:scale-[1.01] transition"
                >
                  Acceder a mi panel Jireh POS
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Descargando comprobante oficial ${transactionCode}...`)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Download className="h-4 w-4" />
                  <span>Descargar Recibo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
