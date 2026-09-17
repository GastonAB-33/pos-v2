export const normalizeTenantSlug = (value: string | null | undefined): string => {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized;
};

export const normalizeTenantSlugAlphanumeric = (value: string | null | undefined): string => {
  return normalizeTenantSlug(value).replace(/[^a-z0-9]/g, "");
};

export const areTenantSlugsMatching = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => {
  const normA = normalizeTenantSlug(a);
  const normB = normalizeTenantSlug(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Permisivo para variaciones de espacios/guiones (ej: "la-25" vs "la25")
  return normA.replace(/[^a-z0-9]/g, "") === normB.replace(/[^a-z0-9]/g, "");
};

export const isTenantMatchingInput = (
  tenant: {
    slug?: string | null;
    trade_name?: string | null;
    tradeName?: string | null;
    legal_name?: string | null;
    legalName?: string | null;
    id?: string | null;
  } | null | undefined,
  expectedInput: string | null | undefined
): boolean => {
  if (!tenant || !expectedInput) return false;
  const target = expectedInput.trim();
  if (!target) return false;

  const candidates = [
    tenant.slug,
    tenant.trade_name,
    tenant.tradeName,
    tenant.legal_name,
    tenant.legalName,
    tenant.id,
  ].filter(Boolean) as string[];

  return candidates.some((candidate) => areTenantSlugsMatching(candidate, target));
};

export const getTenantSlugFromRecord = (input: {
  slug?: string | null;
  trade_name?: string | null;
  tradeName?: string | null;
}): string => normalizeTenantSlug(input.slug ?? input.trade_name ?? input.tradeName ?? "");

