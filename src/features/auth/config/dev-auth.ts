const parseBooleanEnv = (rawValue: unknown): boolean => {
  if (typeof rawValue !== "string") return false;
  return rawValue.trim().toLowerCase() === "true";
};

export const isDevAuthBypassEnabled =
  import.meta.env.DEV && parseBooleanEnv(import.meta.env.VITE_DEV_AUTH_BYPASS);
