import { z } from "zod";
import type { PaymentMethodType } from "@/types/entities";

export const paymentMethodTypeOptions: PaymentMethodType[] = [
  "cash",
  "transfer",
  "card",
  "mercado_pago",
  "current_account",
  "other",
];

export const paymentMethodFormSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  code: z
    .string()
    .min(2, "El codigo es obligatorio")
    .max(40, "Maximo 40 caracteres")
    .regex(/^[a-z0-9_\-]+$/i, "Solo letras, numeros, guion y guion bajo"),
  type: z.enum(paymentMethodTypeOptions as [PaymentMethodType, ...PaymentMethodType[]]),
  affects_cash: z.boolean(),
  surcharge_percent: z.coerce.number().min(0, "Minimo 0").max(100, "Maximo 100"),
  discount_percent: z.coerce.number().min(0, "Minimo 0").max(100, "Maximo 100"),
  notes: z.string().max(500, "Maximo 500 caracteres").optional().or(z.literal("")),
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;
