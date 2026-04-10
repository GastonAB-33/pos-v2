import { z } from "zod";

export const priceListFormSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  code: z
    .string()
    .min(2, "El codigo es obligatorio")
    .max(40, "Maximo 40 caracteres")
    .regex(/^[a-z0-9_\-]+$/i, "Solo letras, numeros, guion y guion bajo"),
  description: z.string().max(300, "Maximo 300 caracteres").optional().or(z.literal("")),
  priceMode: z.enum(["percentage", "fixed"]),
  percentageAdjustment: z.coerce.number().min(-100, "Minimo -100").max(500, "Maximo 500"),
});

export type PriceListFormValues = z.infer<typeof priceListFormSchema>;
