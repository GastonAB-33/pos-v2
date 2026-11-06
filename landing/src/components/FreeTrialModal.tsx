import React, { useState } from "react";
import { CheckCircle2, Sparkles, X, ArrowRight, ShieldCheck, Store, Mail, Phone, Lock, User, Clock, AlertCircle } from "lucide-react";
import { JirehLogo } from "./brand/JirehLogo";
import { POS_APP_URL, POS_LOGIN_URL, SUPPORT_WHATSAPP_PHONE } from "../config/app-urls";
import { onboardingService } from "../services/onboarding.service";

interface FreeTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlanName?: string;
}

export const FreeTrialModal: React.FC<FreeTrialModalProps> = ({
  isOpen,
  onClose,
  selectedPlanName = 'Plan "Me Estoy Formalizando"',
}) => {
  const [step, setStep] = useState<"form" | "loading" | "success">("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLoginPath, setCreatedLoginPath] = useState<string>("/login");
  const [formData, setFormData] = useState({
    businessName: "",
    category: "Almacén y Kiosco",
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStep("loading");

    const result = await onboardingService.registerTrial({
      businessName: formData.businessName,
      category: formData.category,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      selectedPlanName,
    });

    if (result.success) {
      setCreatedLoginPath(result.loginPath || `/${result.tenantSlug || "demo"}/login`);
      setStep("success");
    } else {
      setErrorMessage(result.error || "Ocurrió un error al procesar el alta.");
      setStep("form");
    }
  };

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);
  const formattedExpiration = expirationDate.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const finalLoginUrl = `${POS_APP_URL}${createdLoginPath}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Barra superior de acento con los 3 colores Jireh (Turquesa, Verde Lima y Naranja) */}
        <div className="h-2.5 w-full bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800]" />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Cerrar modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 md:p-8">
          {step === "form" && (
            <>
              <div className="flex items-center gap-3">
                <JirehLogo size="sm" />
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Prueba Gratis de 7 Días
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                Comienza hoy sin costo con Jireh POS
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Acceso ilimitado a todas las funciones por 7 días. Sin tarjeta de crédito ni compromisos.
              </p>

              {errorMessage && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre de tu Comercio *
                    </label>
                    <div className="relative">
                      <Store className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="businessName"
                        required
                        value={formData.businessName}
                        onChange={handleChange}
                        placeholder="Ej. Autoservicio Central"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rubro del Comercio
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option>Almacén y Kiosco</option>
                      <option>Minimarket / Supermercado</option>
                      <option>Indumentaria y Calzado</option>
                      <option>Gastronomía / Cafetería</option>
                      <option>Ferretería y Corralón</option>
                      <option>Farmacia / Perfumería</option>
                      <option>Distribuidora / Mayorista</option>
                      <option>Otro comercio</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tu Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="fullName"
                        required
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="Ej. Laura González"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Celular *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Ej. +54 9 11 2345-6789"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico (será tu usuario) *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="tunegocio@gmail.com"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Crea una Contraseña Segura *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Configurado con el {selectedPlanName} durante los 7 días gratis.</span>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-6 py-3 text-base font-bold text-white shadow-lg shadow-teal-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>Activar mis 7 días gratis</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </form>
            </>
          )}

          {step === "loading" && (
            <div className="py-12 text-center">
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
              <h3 className="mt-6 text-xl font-bold text-slate-900">
                Aprovisionando tu entorno en Jireh POS...
              </h3>
              <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
                Estamos creando tu comercio en la nube, configurando bases de datos de inventario y asignando tus 7 días de acceso ilimitado para {formData.businessName || "tu comercio"}.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <h3 className="mt-4 text-2xl font-black text-slate-900">
                ¡Bienvenido a Jireh POS!
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Tu período de prueba gratuita de <span className="font-bold text-emerald-600">7 días</span> ha sido activado con éxito.
              </p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Comercio:</span>
                  <span className="font-bold text-slate-800">{formData.businessName || "Comercio Demo"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Usuario / Email:</span>
                  <span className="font-semibold text-slate-800">{formData.email || "demo@jirehpos.com"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Plan activado:</span>
                  <span className="font-semibold text-sky-700">{selectedPlanName} (Prueba completa)</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-2">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Válido sin cargo hasta:
                  </span>
                  <span className="font-bold text-amber-700">{formattedExpiration}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={finalLoginUrl}
                  className="flex-1 flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition"
                >
                  Ingresar a mi sistema ahora
                </a>
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent("Hola Jireh POS! Acabo de activar mi prueba de 7 días para " + (formData.businessName || "mi comercio") + " y quiero soporte inicial.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <span>Pedir ayuda por WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
