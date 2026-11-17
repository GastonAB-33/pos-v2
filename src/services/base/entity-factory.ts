import { generateUuid } from "@/utils/uuid";

export const nowIso = (): string => new Date().toISOString();

export const generateEntityId = (): string => {
  return generateUuid();
};
