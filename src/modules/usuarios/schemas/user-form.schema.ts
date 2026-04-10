import { z } from "zod";

export const userFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "El nombre es obligatorio"),
    email: z.string().trim().email("Email invalido").or(z.literal("")),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]*$/, "Username invalido")
      .or(z.literal("")),
    permissionProfileId: z.string().trim().min(1, "Debe seleccionar un perfil"),
  })
  .refine((values) => Boolean(values.email.trim() || values.username.trim()), {
    message: "Debe ingresar email o username",
    path: ["email"],
  });

export type UserFormValues = z.infer<typeof userFormSchema>;
