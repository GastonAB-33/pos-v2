export interface OnboardTrialInput {
  businessName: string;
  category: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  selectedPlanName?: string;
}

export interface OnboardTrialResult {
  success: boolean;
  tenantSlug?: string;
  loginPath?: string;
  error?: string;
}

export interface FichaLeadInput {
  businessName: string;
  category: string;
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  city?: string;
  selectedPlanName?: string;
  notes?: string;
}

export interface FichaLeadResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

export const onboardingService = {
  async submitFichaLead(input: FichaLeadInput): Promise<FichaLeadResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let leadId = `lead-${Date.now()}`;

    // 1. Guardar en Supabase crm_leads en la nube con la contraseña elegida
    if (supabaseUrl && anonKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/crm_leads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            business_name: input.businessName.trim(),
            category: input.category,
            contact_name: input.fullName.trim(),
            phone: input.phone.trim(),
            email: input.email.trim().toLowerCase(),
            client_password: input.password || null,
            city: input.city?.trim() || null,
            selected_plan: input.selectedPlanName || 'Plan "Me Estoy Formalizando"',
            estimated_mrr: 40000,
            notes: input.notes || "Ficha enviada desde Landing para atención de soporte",
            stage: "lead",
            source: "landing_page",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data[0]?.id) {
            leadId = data[0].id;
          }
        }
      } catch (err) {
        console.warn("No se pudo guardar en Supabase crm_leads:", err);
      }
    }

    // 2. Guardar también en localStorage para el CRM
    try {
      const existingRaw = localStorage.getItem("jireh_crm_leads");
      const leads = existingRaw ? JSON.parse(existingRaw) : [];
      leads.unshift({
        id: leadId,
        businessName: input.businessName.trim(),
        contactName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        category: input.category,
        clientPassword: input.password,
        stage: "lead",
        selectedPlan: input.selectedPlanName || 'Plan "Me Estoy Formalizando"',
        estimatedMrr: 40000,
        source: "landing_page",
        notes: input.notes || "Ficha enviada desde Landing para atención de soporte",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("jireh_crm_leads", JSON.stringify(leads));
    } catch {
      // Ignorar error de storage local
    }

    return { success: true, leadId };
  },

  async registerTrial(input: OnboardTrialInput): Promise<OnboardTrialResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return {
        success: false,
        error: "Faltan las credenciales de conexión (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) en la Landing.",
      };
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/onboard-trial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(input),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "No se pudo procesar el alta del comercio." };
      }

      return {
        success: true,
        tenantSlug: data.tenantSlug,
        loginPath: data.loginPath || `/${data.tenantSlug}/login?email=${encodeURIComponent(input.email)}`,
      };
    } catch (err) {
      console.error("Error conectando con Edge Function onboard-trial:", err);
      return {
        success: false,
        error: "Error de red: No se pudo comunicar con el servidor de alta en la nube. Verificá tu conexión e intentá nuevamente.",
      };
    }
  },
};
