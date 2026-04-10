import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

const posCustomerModalSchema = z.object({
  firstName: z.string().min(2, "Nombre obligatorio"),
  lastName: z.string().min(2, "Apellido obligatorio"),
  documentType: z.enum(["dni", "cuit"]),
  documentNumber: z.string().min(6, "Documento invalido").max(20, "Documento invalido"),
  phone: z.string().max(30, "Maximo 30 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  address: z.string().max(200, "Maximo 200 caracteres").optional().or(z.literal("")),
  fiscalBusinessName: z.string().max(120, "Maximo 120 caracteres").optional().or(z.literal("")),
  fiscalAddress: z.string().max(200, "Maximo 200 caracteres").optional().or(z.literal("")),
  fiscalCondition: z.string().max(80, "Maximo 80 caracteres").optional().or(z.literal("")),
  fiscalCuit: z.string().max(20, "Maximo 20 caracteres").optional().or(z.literal("")),
  currentAccountEnabled: z.boolean().default(false),
  currentAccountLimit: z.string().optional().or(z.literal("")),
});

export type PosCustomerModalValues = z.infer<typeof posCustomerModalSchema>;

interface PosCustomerModalProps {
  mode: "create" | "edit";
  initialValues: PosCustomerModalValues;
  currentBalance: number;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PosCustomerModalValues) => Promise<void>;
  onOpenCurrentAccount?: () => void;
}

type PosCustomerModalTab = "personal" | "fiscal" | "account";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const optionalLabel = "(opcional)";

export const PosCustomerModal = ({
  mode,
  initialValues,
  currentBalance,
  disabled,
  onCancel,
  onSubmit,
  onOpenCurrentAccount,
}: PosCustomerModalProps) => {
  const [tab, setTab] = useState<PosCustomerModalTab>("personal");
  const [highlightedTab, setHighlightedTab] = useState<PosCustomerModalTab | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PosCustomerModalValues>({
    resolver: zodResolver(posCustomerModalSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
    setTab("personal");
    setHighlightedTab(null);
  }, [initialValues, reset]);

  useEffect(() => {
    if (!highlightedTab) return;

    const timer = window.setTimeout(() => {
      setHighlightedTab((current) => (current === highlightedTab ? null : current));
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedTab]);

  const currentAccountEnabled = watch("currentAccountEnabled");
  const currentAccountLimitRaw = watch("currentAccountLimit") ?? "";

  const accountLimit = useMemo(() => {
    const parsed = Number(currentAccountLimitRaw);
    if (!currentAccountLimitRaw.trim() || !Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Number(parsed.toFixed(2));
  }, [currentAccountLimitRaw]);

  const accountAvailable = useMemo(() => {
    if (!currentAccountEnabled) return null;
    if (accountLimit == null) return null;
    return Number((accountLimit - currentBalance).toFixed(2));
  }, [accountLimit, currentAccountEnabled, currentBalance]);

  const title = useMemo(
    () => (mode === "create" ? "Nuevo cliente" : "Editar cliente"),
    [mode]
  );

  const hasPersonalErrors = Boolean(errors.firstName || errors.lastName || errors.documentNumber);
  const hasFiscalErrors = Boolean(
    errors.fiscalAddress || errors.fiscalBusinessName || errors.fiscalCondition || errors.fiscalCuit
  );
  const hasAccountErrors = Boolean(errors.currentAccountLimit || errors.currentAccountEnabled);

  const onInvalid = (formErrors: FieldErrors<PosCustomerModalValues>) => {
    const personalError = formErrors.firstName || formErrors.lastName || formErrors.documentNumber;
    const fiscalError =
      formErrors.fiscalAddress ||
      formErrors.fiscalBusinessName ||
      formErrors.fiscalCondition ||
      formErrors.fiscalCuit;
    const accountError = formErrors.currentAccountEnabled || formErrors.currentAccountLimit;

    const firstInvalidTab: PosCustomerModalTab = personalError
      ? "personal"
      : fiscalError
        ? "fiscal"
        : accountError
          ? "account"
          : "personal";

    setTab(firstInvalidTab);
    setHighlightedTab(firstInvalidTab);
  };

  const getTabButtonClass = (tabKey: PosCustomerModalTab, hasErrors: boolean) => {
    if (tab === tabKey) {
      if (highlightedTab === tabKey || hasErrors) {
        return "rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm ring-1 ring-red-300";
      }
      return "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm";
    }

    if (highlightedTab === tabKey || hasErrors) {
      return "rounded-lg px-3 py-1.5 text-sm font-medium text-red-600";
    }

    return "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500";
  };

  const sectionClass =
    highlightedTab === tab || (tab === "personal" && hasPersonalErrors) || (tab === "fiscal" && hasFiscalErrors) || (tab === "account" && hasAccountErrors)
      ? "rounded-xl border border-red-200 bg-red-50/40 p-3"
      : "rounded-xl bg-slate-50/40 p-3";

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <button
        type="button"
        aria-label="Cerrar modal cliente"
        className="absolute inset-0"
        onClick={onCancel}
      />

      <form
        className="relative z-10 w-full max-w-3xl space-y-4 rounded-2xl bg-white p-4 shadow-panel"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" className="ui-btn-ghost px-2.5 py-1.5 text-xs" onClick={onCancel} disabled={disabled}>
            Cerrar
          </button>
        </div>

        <div className="inline-flex rounded-xl bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setTab("personal")}
            className={getTabButtonClass("personal", hasPersonalErrors)}
          >
            Datos personales
          </button>
          <button
            type="button"
            onClick={() => setTab("fiscal")}
            className={getTabButtonClass("fiscal", hasFiscalErrors)}
          >
            Datos fiscales
          </button>
          <button
            type="button"
            onClick={() => setTab("account")}
            className={getTabButtonClass("account", hasAccountErrors)}
          >
            Cuenta corriente
          </button>
        </div>

        {tab === "personal" ? (
          <div className={sectionClass}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input {...register("firstName")} className="ui-input" disabled={disabled} />
                {errors.firstName ? <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Apellido <span className="text-red-500">*</span>
                </label>
                <input {...register("lastName")} className="ui-input" disabled={disabled} />
                {errors.lastName ? <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tipo documento <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <select {...register("documentType")} className="ui-input" disabled={disabled}>
                  <option value="dni">DNI</option>
                  <option value="cuit">CUIT</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Numero documento <span className="text-red-500">*</span>
                </label>
                <input {...register("documentNumber")} className="ui-input" disabled={disabled} />
                {errors.documentNumber ? (
                  <p className="mt-1 text-xs text-red-600">{errors.documentNumber.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Telefono <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input {...register("phone")} className="ui-input" disabled={disabled} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input type="email" {...register("email")} className="ui-input" disabled={disabled} />
                {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Direccion <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input {...register("address")} className="ui-input" disabled={disabled} />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "fiscal" ? (
          <div className={sectionClass}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Razon social <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input {...register("fiscalBusinessName")} className="ui-input" disabled={disabled} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Domicilio fiscal <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input {...register("fiscalAddress")} className="ui-input" disabled={disabled} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Condicion fiscal <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalCondition")}
                  placeholder="Consumidor final, RI, Monotributo..."
                  className="ui-input"
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  CUIT fiscal (ARCA) <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalCuit")}
                  placeholder="Si se completa, se usa como doc fiscal"
                  className="ui-input"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "account" ? (
          <div className={sectionClass}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  {...register("currentAccountEnabled")}
                  className="h-4 w-4"
                  disabled={disabled}
                />
                Habilitar cuenta corriente para este cliente
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Limite autorizado <span className="text-[11px] font-normal text-slate-500">{optionalLabel}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("currentAccountLimit")}
                  className="ui-input"
                  disabled={disabled || !currentAccountEnabled}
                  placeholder="Sin limite si se deja vacio"
                />
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                  <span className="block text-[11px] text-slate-500">Estado</span>
                  <span className="font-medium text-slate-900">
                    {currentAccountEnabled ? "Habilitada" : "Deshabilitada"}
                  </span>
                </p>
                <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                  <span className="block text-[11px] text-slate-500">Limite autorizado</span>
                  <span className="font-medium text-slate-900">
                    {accountLimit == null ? "Sin limite" : currency.format(accountLimit)}
                  </span>
                </p>
                <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                  <span className="block text-[11px] text-slate-500">Deuda actual</span>
                  <span className="font-medium text-slate-900">{currency.format(currentBalance)}</span>
                </p>
                <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                  <span className="block text-[11px] text-slate-500">Disponible</span>
                  <span className="font-medium text-slate-900">
                    {currentAccountEnabled
                      ? accountAvailable == null
                        ? "Sin tope"
                        : currency.format(accountAvailable)
                      : "-"}
                  </span>
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Este limite se aplica en POS cuando se cobra con cuenta corriente.
              </p>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="ui-btn-ghost px-3 py-1.5 text-xs"
                  onClick={onOpenCurrentAccount}
                  disabled={disabled || !onOpenCurrentAccount}
                >
                  Ver cuenta corriente
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="ui-btn-ghost" onClick={onCancel} disabled={disabled}>
            Cancelar
          </button>
          <button type="submit" className="ui-btn-primary disabled:opacity-60" disabled={disabled}>
            {mode === "create" ? "Crear cliente" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </section>
  );
};
