import React, { useState } from "react";
import {
  CheckCircle2,
  X,
  Store,
  Mail,
  Phone,
  User,
  Lock,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { JirehLogo } from "./brand/JirehLogo";
import { WhatsAppIcon } from "./brand/WhatsAppIcon";
import { SUPPORT_WHATSAPP_PHONE } from "../config/app-urls";
import { onboardingService } from "../services/onboarding.service";

interface FreeTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlanName?: string;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const FreeTrialModal: React.FC<FreeTrialModalProps> = ({
  isOpen,
  onClose,
  selectedPlanName = 'Plan "Me Estoy Formalizando"',
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const [step, setStep] = useState<"form" | "loading" | "success">("form");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [hpCompany, setHpCompany] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: "",
    category: "Almacén y Kiosco",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    city: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setErrorMessage("Debés aceptar los Términos de Servicio y la Política de Privacidad para continuar.");
      return;
    }
    if (hpCompany) {
      // Bot detectado silenciosamente
      setStep("success");
      return;
    }
    setErrorMessage(null);
    setStep("loading");

    const result = await onboardingService.submitFichaLead({
      businessName: formData.businessName,
      category: formData.category,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      city: formData.city,
      selectedPlanName,
      notes: formData.notes,
    });

    if (result.success) {
      setStep("success");
    } else {
      setErrorMessage(result.error || "Ocurrió un error al enviar la ficha.");
      setStep("form");
    }
  };

  const whatsappMessage = encodeURIComponent(
    `¡Hola equipo de Jireh! Acabo de enviar la ficha para iniciar mi período de prueba gratuita de 7 días.\n\n` +
      `• *Comercio:* ${formData.businessName || "Mi comercio"}\n` +
      `• *Rubro:* ${formData.category}\n` +
      `• *Titular:* ${formData.fullName}\n` +
      `• *WhatsApp:* ${formData.phone}\n` +
      `• *Email:* ${formData.email}\n` +
      `• *Plan de interés:* ${selectedPlanName}\n\n` +
      `¿Podemos coordinar para activar mi cuenta de prueba?`
  );

  const directWhatsAppUrl = `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${whatsappMessage}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Barra superior de acento con gradiente */}
        <div className="h-2.5 w-full bg-gradient-to-r from-[#25D366] via-[#00B5C8] to-[#FF7800]" />

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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
                  Atención Personalizada 1 a 1
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                Ficha de Solicitud de Prueba Gratis (7 Días)
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Completá los datos de tu comercio. Tu <strong>agente personal de soporte</strong> se
                comunicará directamente por WhatsApp para darte la bienvenida, entregarte tus credenciales
                privadas y acompañarte en la puesta en marcha de tu sistema.
              </p>

              {errorMessage && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        placeholder="Ej. Kiosco Belgrano"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rubro del Comercio *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option>Almacén y Kiosco</option>
                      <option>Minimarket / Supermercado</option>
                      <option>Ferretería y Corralón</option>
                      <option>Indumentaria y Calzado</option>
                      <option>Gastronomía / Cafetería</option>
                      <option>Farmacia / Perfumería</option>
                      <option>Distribuidora / Mayorista</option>
                      <option>Otro rubro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tu Nombre y Apellido (Titular) *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="fullName"
                        required
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="Ej. Juan Pérez"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Celular de Contacto *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Ej. +54 9 11 2345-6789"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email de Contacto *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="juan@tunegocio.com"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contraseña para tu cuenta *
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
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ciudad / Localidad
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="Ej. Villa Mercedes, San Luis"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Plan Seleccionado
                    </label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-sky-700 h-[38px] flex items-center">
                      {selectedPlanName}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Comentarios o consultas para tu agente (opcional)
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Ej. Tengo balanza Systel / Quiero importar mis productos desde un Excel..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                
                {/* Trampa anti-bot oculta */}
                <div className="hidden" aria-hidden="true">
                  <input
                    type="text"
                    name="hp_company"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hpCompany}
                    onChange={(e) => setHpCompany(e.target.value)}
                  />
                </div>

                {/* Consentimiento Legal y Términos */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Declaro ser mayor de edad y acepto los{" "}
                      <button
                        type="button"
                        onClick={onOpenTerms}
                        className="text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-800"
                      >
                        Términos de Servicio
                      </button>{" "}
                      y la{" "}
                      <button
                        type="button"
                        onClick={onOpenPrivacy}
                        className="text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-800"
                      >
                        Política de Privacidad
                      </button>
                      . *
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-500 select-none">
                    <input
                      type="checkbox"
                      checked={acceptMarketing}
                      onChange={(e) => setAcceptMarketing(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Acepto recibir novedades, actualizaciones y consejos de gestión por WhatsApp o correo (opcional).
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#25D366] via-[#10B981] to-[#059669] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  <WhatsAppIcon className="h-5 w-5 text-white" />
                  <span>Enviar Ficha a mi Agente de Soporte</span>
                </button>

                <p className="text-[11px] text-center text-slate-500 pt-1">
                  🔒 Tus datos están protegidos. No solicitamos datos de tarjetas ni medios de pago para la prueba.
                </p>
              </form>
            </>
          )}

          {step === "loading" && (
            <div className="py-12 text-center">
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
              <h3 className="mt-6 text-xl font-bold text-slate-900">
                Registrando tu ficha en el CRM de Soporte...
              </h3>
              <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
                Estamos conectando con tu agente personal para coordinar la activación de {formData.businessName || "tu comercio"}.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="py-3 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>

              <h3 className="mt-4 text-2xl font-black text-slate-900">
                ¡Ficha Recibida con Éxito!
              </h3>
              <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
                Tu <strong>agente personal de soporte</strong> ya tiene los datos de tu comercio y se comunicará a la brevedad por WhatsApp para entregarte tus accesos y guiarte en tus 7 días gratis.
              </p>

              {/* Ficha Resumen */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Comercio:</span>
                  <span className="font-bold text-slate-800">{formData.businessName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Titular:</span>
                  <span className="font-semibold text-slate-800">{formData.fullName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">WhatsApp:</span>
                  <span className="font-bold text-emerald-700">{formData.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800">{formData.email}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Plan de Interés:</span>
                  <span className="font-bold text-sky-700">{selectedPlanName}</span>
                </div>
              </div>

              {/* Botón WhatsApp Inmediato */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={directWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:scale-[1.01]"
                >
                  <WhatsAppIcon className="h-5 w-5 text-white" />
                  <span>Chatear con mi Agente por WhatsApp Ahora</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
