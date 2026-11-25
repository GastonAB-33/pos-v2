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

const authLockQueues = new Map<string, Promise<unknown>>();

/**
 * Serializes auth token operations in-memory per lock key, avoiding browser
 * Web Locks API steal/AbortError races across concurrent requests or tabs.
 */
const safeInMemoryAuthLock = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const previous = authLockQueues.get(name) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.catch(() => undefined).then(() => current);
  authLockQueues.set(name, chained);

  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (authLockQueues.get(name) === chained) {
      authLockQueues.delete(name);
    }
  }
};

export const supabase = createClient(runtimeConfig.url, runtimeConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: safeInMemoryAuthLock,
  },
});
