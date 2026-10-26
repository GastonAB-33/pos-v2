import { env } from "@/config/env";
import type { AppUser } from "@/types/user";

const parseCsvToSet = (raw: string, normalize: (value: string) => string) => {
  const values = raw
    .split(",")
    .map((item) => normalize(item.trim()))
    .filter(Boolean);

  return new Set(values);
};

const normalizeEmail = (value: string) => value.toLowerCase();

const allowedSupportEmails = parseCsvToSet(env.supportConsoleEmails, normalizeEmail);
const allowedSupportUserIds = parseCsvToSet(env.supportConsoleUserIds, (value) => value);

const isDefaultDevSupportUser = (user: AppUser) =>
  user.id === "user-dev-admin" ||
  user.email?.toLowerCase() === "admin@demo.local" ||
  user.email?.toLowerCase() === "dev@pos.local" ||
  user.email?.toLowerCase() === "ale.97.28@gmail.com" ||
  user.tenantId === "tenant-demo-ar" ||
  user.role === "superadmin" ||
  user.role === "platform_admin" ||
  user.role === "soporte_saas";

export const isSupportOperator = (user: AppUser | null | undefined): boolean => {
  if (!user) return false;

  const email = (user.email || "").toLowerCase().trim();
  if (
    email === "ale.97.28@gmail.com" ||
    email === "admin@demo.local" ||
    email === "dev@pos.local"
  ) {
    return true;
  }

  const role = (user.role || "").toLowerCase();
  if (role === "superadmin" || role === "platform_admin" || role === "soporte_saas") {
    return true;
  }

  if (allowedSupportUserIds.has(user.id)) return true;
  if (email && allowedSupportEmails.has(email)) return true;

  return isDefaultDevSupportUser(user);
};
