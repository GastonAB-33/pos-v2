import { z } from "zod";

const paymentMethodConfigSchema = z.object({
  ask_destination_bank: z.boolean(),
  destination_bank_account_ids: z.array(z.string()).default([]),
  ask_coupon_number: z.boolean(),
  ask_approval_number: z.boolean(),
  ask_operation_number: z.boolean(),
  ask_voucher_number: z.boolean(),
  ask_origin_bank: z.boolean(),
  allow_new_origin_bank: z.boolean(),
  ask_origin_account_holder: z.boolean(),
  ask_card_brand: z.boolean(),
  ask_installment_plan: z.boolean(),
  ask_cheque_number: z.boolean(),
  ask_cheque_due_date: z.boolean(),
});

export const paymentMethodFormSchema = z.object({
  surcharge_percent: z.coerce.number().min(0, "Minimo 0").max(100, "Maximo 100"),
  discount_percent: z.coerce.number().min(0, "Minimo 0").max(100, "Maximo 100"),
  notes: z.string().max(500, "Maximo 500 caracteres").optional().or(z.literal("")),
  config: paymentMethodConfigSchema,
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;
