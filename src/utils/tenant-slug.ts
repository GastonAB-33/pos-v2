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

export const getTenantSlugFromRecord = (input: {
  slug?: string | null;
  trade_name?: string | null;
  tradeName?: string | null;
}): string => normalizeTenantSlug(input.slug ?? input.trade_name ?? input.tradeName ?? "");
