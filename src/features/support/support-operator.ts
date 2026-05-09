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

const hasExplicitAllowList = allowedSupportEmails.size > 0 || allowedSupportUserIds.size > 0;

const isDefaultDevSupportUser = (user: AppUser) =>
  user.id === "user-dev-admin" || user.email?.toLowerCase() === "admin@demo.local";

export const isSupportOperator = (user: AppUser | null | undefined) => {
  if (!user) return false;

  if (!hasExplicitAllowList) {
    return isDefaultDevSupportUser(user);
  }

  if (allowedSupportUserIds.has(user.id)) return true;
  if (!user.email) return false;

  return allowedSupportEmails.has(normalizeEmail(user.email));
};
