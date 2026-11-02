const dataProvider =
  import.meta.env.VITE_DATA_PROVIDER === "supabase" ? "supabase" : "mock";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";
const supportConsoleEmails =
  (import.meta.env.VITE_SUPPORT_CONSOLE_EMAILS as string | undefined)?.trim() || "";
const supportConsoleUserIds =
  (import.meta.env.VITE_SUPPORT_CONSOLE_USER_IDS as string | undefined)?.trim() || "";
const supportWhatsappPhone =
  (import.meta.env.VITE_SUPPORT_WHATSAPP_PHONE as string | undefined)?.replace(/\D/g, "") || "";
const hasPlaceholderSupabaseUrl =
  supabaseUrl?.includes("your-project-ref.supabase.co") ||
  supabaseUrl === "TU_URL_DE_SUPABASE";
const hasPlaceholderSupabaseAnonKey =
  supabaseAnonKey === "your-anon-key" ||
  supabaseAnonKey === "TU_CLAVE_PUBLICA";

if (dataProvider === "supabase") {
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

  for (const key of required) {
    if (!import.meta.env[key]) {
      throw new Error(
        `Falta la variable de entorno ${key}. Configura .env con tus credenciales de Supabase.`
      );
    }
  }

  if (hasPlaceholderSupabaseUrl) {
    throw new Error(
      "VITE_SUPABASE_URL sigue con valor de ejemplo. Reemplaza la URL por la de tu proyecto Supabase."
    );
  }

  if (hasPlaceholderSupabaseAnonKey) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY sigue con valor de ejemplo. Reemplaza la anon key por la real de Supabase."
    );
  }
}

export const env = {
  appName: import.meta.env.VITE_APP_NAME || "POS V2",
  dataProvider,
  apiUrl,
  supportConsoleEmails,
  supportConsoleUserIds,
  supportWhatsappPhone,
  // Valores seguros para evitar crash en modo mock.
  supabaseUrl: supabaseUrl || "http://localhost:54321",
  supabaseAnonKey: supabaseAnonKey || "public-anon-key",
};
