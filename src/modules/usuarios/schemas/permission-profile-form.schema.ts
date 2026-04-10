import { z } from "zod";

export const permissionProfileFormSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  description: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

export type PermissionProfileFormValues = z.infer<typeof permissionProfileFormSchema>;
