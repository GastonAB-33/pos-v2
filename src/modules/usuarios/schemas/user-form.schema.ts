import { z } from "zod";

export interface UserFormValues {
  fullName: string;
  username: string;
  email: string;
  permissionProfileId: string;
  password: string;
  confirmPassword: string;
}

const baseUserFormSchema = z.object({
  fullName: z.string().trim().min(2, "El nombre completo es obligatorio"),
  username: z
    .string()
    .trim()
    .min(2, "El nombre de perfil es obligatorio")
    .regex(/^[a-zA-Z0-9._-]+$/, "El nombre de perfil solo admite letras, numeros, punto, guion y guion bajo"),
  email: z.string().trim().email("Correo electronico invalido"),
  permissionProfileId: z.string().trim().min(1, "Debe seleccionar un nivel de permisos"),
  password: z.string(),
  confirmPassword: z.string(),
});

export const createUserFormSchema = (mode: "create" | "edit") =>
  baseUserFormSchema.superRefine((values, ctx) => {
    const password = values.password.trim();
    const confirmPassword = values.confirmPassword.trim();

    if (mode === "create" && password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "La contrasena debe tener al menos 8 caracteres",
      });
    }

    if (mode === "create" && confirmPassword.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Debe repetir la contrasena",
      });
    }

    if (mode === "edit" && password.length > 0 && password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "La contrasena debe tener al menos 8 caracteres",
      });
    }

    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contrasenas no coinciden",
      });
    }
  });
