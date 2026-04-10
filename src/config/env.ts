const dataProvider =
  import.meta.env.VITE_DATA_PROVIDER === "supabase" ? "supabase" : "mock";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (dataProvider === "supabase") {
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

  for (const key of required) {
    if (!import.meta.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export const env = {
  appName: import.meta.env.VITE_APP_NAME || "POS V2",
  dataProvider,
  // Valores seguros para evitar crash en modo mock.
  supabaseUrl: supabaseUrl || "http://localhost:54321",
  supabaseAnonKey: supabaseAnonKey || "public-anon-key",
};