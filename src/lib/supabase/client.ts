import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { dataProvider } from "@/services/config/data-provider";

const runtimeConfig =
  dataProvider === "supabase"
    ? {
        url: env.supabaseUrl,
        anonKey: env.supabaseAnonKey,
      }
    : {
        // En modo mock no usamos Supabase, pero necesitamos un cliente valido
        // para no romper el boot si .env conserva placeholders.
        url: "http://127.0.0.1:54321",
        anonKey: "public-anon-key",
      };

/**
 * Bypasses browser Web Locks API (`navigator.locks`) and avoids re-entrant
 * queue deadlocks when `onAuthStateChange` callbacks run during `signInWithPassword`.
 */
const noOpAuthLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => await fn();

export const supabase = createClient(runtimeConfig.url, runtimeConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: noOpAuthLock,
  },
});
