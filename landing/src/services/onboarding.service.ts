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

export const onboardingService = {
  async registerTrial(input: OnboardTrialInput): Promise<OnboardTrialResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/onboard-trial`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify(input),
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error || "No se pudo procesar el alta." };
        }

        return {
          success: true,
          tenantSlug: data.tenantSlug,
          loginPath: data.loginPath || `/${data.tenantSlug}/login`,
        };
      } catch (err) {
        console.warn("Fallo conectando con Edge Function, usando fallback:", err);
      }
    }

    // Fallback simulado para entorno de desarrollo / offline
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const fallbackSlug = input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 20);

    return {
      success: true,
      tenantSlug: fallbackSlug || "mi-comercio",
      loginPath: `/${fallbackSlug || "mi-comercio"}/login`,
    };
  },
};
