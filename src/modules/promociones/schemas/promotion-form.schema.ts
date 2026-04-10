import { z } from "zod";
import type { PromotionScope, PromotionType } from "@/types/entities";

export const promotionTypeOptions: PromotionType[] = [
  "percentage_discount",
  "fixed_discount",
  "combo_price",
];

export const promotionScopeOptions: PromotionScope[] = ["product", "cart"];

const optionalText = z.string().optional().or(z.literal(""));
const optionalNumber = z.union([z.literal(""), z.coerce.number().min(0)]);

export const promotionFormSchema = z
  .object({
    name: z.string().min(2, "El nombre es obligatorio"),
    code: z
      .string()
      .min(2, "El codigo es obligatorio")
      .max(60, "Maximo 60 caracteres")
      .regex(/^[a-z0-9_\-]+$/i, "Solo letras, numeros, guion y guion bajo"),
    description: optionalText,
    type: z.enum(promotionTypeOptions as [PromotionType, ...PromotionType[]]),
    scope: z.enum(promotionScopeOptions as [PromotionScope, ...PromotionScope[]]),
    productId: optionalText,
    minQuantity: z.union([z.literal(""), z.coerce.number().min(1, "Minimo 1")]),
    discountPercent: optionalNumber,
    discountAmount: optionalNumber,
    comboPrice: optionalNumber,
    startsAt: optionalText,
    endsAt: optionalText,
  })
  .superRefine((value, context) => {
    if (value.scope === "product" && !value.productId?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message: "Selecciona un producto para promocion por producto",
      });
    }

    if (value.type === "percentage_discount") {
      if (value.discountPercent === "" || value.discountPercent <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountPercent"],
          message: "Ingresa porcentaje mayor a 0",
        });
      }
    }

    if (value.type === "fixed_discount") {
      if (value.discountAmount === "" || value.discountAmount <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountAmount"],
          message: "Ingresa descuento fijo mayor a 0",
        });
      }
    }

    if (value.type === "combo_price") {
      if (value.comboPrice === "" || value.comboPrice < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["comboPrice"],
          message: "Ingresa precio combo valido",
        });
      }

      if (value.minQuantity === "" || value.minQuantity < 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minQuantity"],
          message: "La cantidad minima debe ser al menos 1",
        });
      }
    }

    if (value.startsAt && value.endsAt) {
      const startsAt = new Date(value.startsAt).getTime();
      const endsAt = new Date(value.endsAt).getTime();

      if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt) && startsAt > endsAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "La fecha fin debe ser posterior al inicio",
        });
      }
    }
  });

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

