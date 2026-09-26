import { z } from "zod";

export const employeeFormSchema = z.object({
  fullName: z.string().min(2, "El nombre completo es obligatorio"),
  documentType: z.enum(["dni", "cuil", "pasaporte"]).default("dni"),
  documentNumber: z.string().min(6, "Documento inválido").max(20, "Documento inválido"),
  phone: z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  position: z.string().min(2, "El puesto o cargo es obligatorio"),
  baseSalary: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "El sueldo base debe ser un número válido positivo",
  }),
  hourlyRate: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "La tarifa por hora debe ser un número válido",
  }).optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
  currentAccountEnabled: z.boolean().default(true),
  currentAccountLimit: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "El límite de cuenta corriente debe ser un número válido",
  }).optional().or(z.literal("")),
  observations: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
