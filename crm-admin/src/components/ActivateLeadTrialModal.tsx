import React, { useState, useEffect } from "react";
import { CrmLead } from "../types/crm.types";
import { X, Sparkles, Store, User, Mail, Lock, CheckCircle2, MessageSquare, ArrowRight } from "lucide-react";

interface ActivateLeadTrialModalProps {
  isOpen: boolean;
  lead: CrmLead | null;
  onClose: () => void;
  onSuccess: (updatedLead: CrmLead, tenantSlug: string, email: string, pass: string) => void;
}

export const ActivateLeadTrialModal: React.FC<ActivateLeadTrialModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState(lead?.clientPassword || "Jireh2026!");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    slug: string;
    email: string;
    passwordText: string;
    loginUrl: string;
  } | null>(null);

  useEffect(() => {
    if (lead?.clientPassword) {
      setPassword(lead.clientPassword);
    } else {
      setPassword("Jireh2026!");
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qfquvyxyodmnyqlchpbf.supabase.co";
    const anonKey =
      import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_NmP-WEg3k_lNF-p005-Teg_p3Hnrn49";
    const posAppUrl = import.meta.env.VITE_POS_APP_URL || "http://localhost:5177";

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/onboard-trial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          businessName: lead.businessName,
          category: lead.category,
          fullName: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          password: password,
          selectedPlanName: lead.selectedPlan,
          leadId: lead.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear el comercio.");
      }

      const slug = data.tenantSlug || lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const loginUrl = `${posAppUrl}/${slug}/login?email=${encodeURIComponent(lead.email)}`;

      // Actualizar el lead a etapa trial
      const updatedLead: CrmLead = {
        ...lead,
        stage: "trial",
        tenantId: data.tenantId || `tenant-${slug}`,
        trialStartedAt: new Date().toISOString(),
        trialEndsAt: data.trialEndsAt || new Date(Date.now() + 7 * 86400000).toISOString(),
        notes: `${lead.notes || ""} [Prueba 7 días activada manualmente desde CRM el ${new Date().toLocaleDateString()}]`,
      };

      // Si existe supabase, actualizar lead en crm_leads
      try {
        await fetch(`${supabaseUrl}/rest/v1/crm_leads?id=eq.${lead.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            stage: "trial",
            tenant_id: data.tenantId || `tenant-${slug}`,
            trial_started_at: updatedLead.trialStartedAt,
            trial_ends_at: updatedLead.trialEndsAt,
          }),
        });
      } catch {
        // Ignorar si falla patch
      }

      setResultData({
        slug,
        email: lead.email,
        passwordText: password,
        loginUrl,
      });

      onSuccess(updatedLead, slug, lead.email, password);
    } catch (err: any) {
      setError(err.message || "Error al activar la prueba.");
    } finally {
      setIsLoading(false);
    }
  };

  const whatsappClientMsg = resultData
    ? encodeURIComponent(
        `¡Hola ${lead.contactName}! Te confirmo que tu período de prueba gratuita de 7 días para "${lead.businessName}" ya está activo en Jireh.\n\n` +
          `• *Enlace de acceso a tu comercio:*\n${resultData.loginUrl}\n\n` +
          `• *Usuario:* ${resultData.email}\n` +
          `• *Contraseña:* ${resultData.passwordText}\n\n` +
          `Cualquier duda que tengas sobre carga de productos, apertura de caja o ventas, escribime por acá que te ayudo con gusto.`
      )
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        {!resultData ? (
          <>
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-lg font-bold text-white">Activar Prueba de 7 Días (Manual)</h3>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              Vas a crear el comercio y usuario en la nube para el prospecto que completó la ficha.
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleActivate} className="mt-4 space-y-3.5">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Comercio:</span>
                  <strong className="text-white">{lead.businessName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Titular:</span>
                  <span className="text-slate-300">{lead.contactName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-300">{lead.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">WhatsApp:</span>
                  <span className="text-emerald-400 font-semibold">{lead.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rubro:</span>
                  <span className="text-slate-300">{lead.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan:</span>
                  <span className="text-sky-400">{lead.selectedPlan}</span>
                </div>
                {lead.clientPassword && (
                  <div className="flex justify-between text-amber-300 border-t border-slate-800 pt-1.5">
                    <span className="text-slate-400">Clave elegida por cliente:</span>
                    <span className="font-mono font-bold">{lead.clientPassword}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña de Acceso para el Cliente *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  {lead.clientPassword
                    ? "Esta es la contraseña que el cliente eligió al completar la ficha."
                    : `Podés dejar la sugerida (${password}) o definir una personalizada.`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 px-5 py-2 text-xs font-bold text-white hover:opacity-95 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Creando comercio en la nube...</span>
                  ) : (
                    <>
                      <span>Activar 7 Días y Generar Accesos</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-2 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">¡Prueba Activada con Éxito!</h3>
              <p className="text-xs text-slate-400 mt-1">
                El comercio <strong className="text-white">{lead.businessName}</strong> ya está
                creado y sus 7 días de acceso ilimitado están corriendo.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Enlace de acceso:</span>
                <span className="text-sky-400 font-mono text-[11px] truncate max-w-[200px]">
                  /{resultData.slug}/login
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Usuario (email):</span>
                <span className="text-white font-semibold">{resultData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contraseña:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {resultData.passwordText}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}?text=${whatsappClientMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Enviar Accesos por WhatsApp al Cliente</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
