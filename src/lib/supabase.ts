import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";

type SupabaseConnectionTestResult = {
  ok: true;
  provider: "supabase";
  checkedTable: string;
  message: string;
};

const ensureSupabaseRuntimeConfig = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (dataProvider !== "supabase") {
    throw new Error(
      "Supabase no esta activo. Define VITE_DATA_PROVIDER=supabase para ejecutar la prueba de conexion."
    );
  }

  if (!url || url.includes("your-project-ref.supabase.co")) {
    throw new Error(
      "VITE_SUPABASE_URL no esta configurada correctamente. Usa la URL real de tu proyecto Supabase."
    );
  }

  if (!anonKey || anonKey === "your-anon-key") {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY no esta configurada correctamente. Usa la anon key real del proyecto."
    );
  }
};

export const testConnection = async (): Promise<SupabaseConnectionTestResult> => {
  ensureSupabaseRuntimeConfig();

  const { error } = await supabase
    .from(dbTables.tenants)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(
      `No se pudo validar la conexion con Supabase (tabla: ${dbTables.tenants}): ${error.message}`
    );
  }

  return {
    ok: true,
    provider: "supabase",
    checkedTable: dbTables.tenants,
    message: "Conexion a Supabase validada correctamente.",
  };
};

export { supabase };
