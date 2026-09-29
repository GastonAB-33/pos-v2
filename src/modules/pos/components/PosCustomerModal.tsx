import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import {
  getEditableDocumentNumber,
  useEntityRequirements,
} from "@/modules/configuracion/hooks/useEntityRequirements";
import type { CustomerRequiredFieldsSettings } from "@/types/entities";

export const buildPosCustomerModalSchema = (req?: CustomerRequiredFieldsSettings) => {
  const isDocRequired = req?.document_number ?? true;
  const isPhoneRequired = req?.phone ?? false;
  const isEmailRequired = req?.email ?? false;
  const isAddressRequired = req?.address ?? false;

  return z.object({
    firstName: z.string().min(2, "Nombre obligatorio"),
    lastName: z.string().min(2, "Apellido obligatorio"),
    documentType: z.enum(["dni", "cuit"]),
    documentNumber: isDocRequired
      ? z.string().min(6, "Documento inválido (mínimo 6 caracteres)").max(20, "Documento inválido")
      : z.string().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
    phone: isPhoneRequired
      ? z.string().min(6, "Teléfono obligatorio (mínimo 6 caracteres)").max(30, "Máximo 30 caracteres")
      : z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
    email: isEmailRequired
      ? z.string().min(1, "Email obligatorio").email("Email inválido")
      : z.string().email("Email inválido").optional().or(z.literal("")),
    address: isAddressRequired
      ? z.string().min(3, "Dirección obligatoria (mínimo 3 caracteres)").max(200, "Máximo 200 caracteres")
      : z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
    fiscalBusinessName: z.string().max(120, "Máximo 120 caracteres").optional().or(z.literal("")),
    fiscalAddress: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
    fiscalCondition: z.string().max(80, "Máximo 80 caracteres").optional().or(z.literal("")),
    fiscalCuit: z.string().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
    currentAccountEnabled: z.boolean().default(false),
    currentAccountLimit: z.string().optional().or(z.literal("")),
  });
};

export const posCustomerModalSchema = buildPosCustomerModalSchema({
  document_number: true,
  phone: false,
  email: false,
  address: false,
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
  requirements?: CustomerRequiredFieldsSettings;
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
  requirements,
}: PosCustomerModalProps) => {
  const { tenantId } = useTenant();
  const { customerRequirements } = useEntityRequirements(tenantId);
  const activeReq = requirements ?? customerRequirements;

  const schema = useMemo(() => buildPosCustomerModalSchema(activeReq), [activeReq]);

  const [tab, setTab] = useState<PosCustomerModalTab>("personal");
  const [highlightedTab, setHighlightedTab] = useState<PosCustomerModalTab | null>(null);

  useBodyScrollLock(true);

  const cleanInitialValues = useMemo((): PosCustomerModalValues => {
    return {
      ...initialValues,
      documentNumber: getEditableDocumentNumber(initialValues.documentNumber),
      fiscalCuit: getEditableDocumentNumber(initialValues.fiscalCuit),
    };
  }, [initialValues]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PosCustomerModalValues>({
    resolver: zodResolver(schema),
    defaultValues: cleanInitialValues,
  });

  useEffect(() => {
    reset(cleanInitialValues);
    setTab("personal");
    setHighlightedTab(null);
  }, [cleanInitialValues, reset]);

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

  const hasPersonalErrors = Boolean(
    errors.firstName ||
    errors.lastName ||
    errors.documentNumber ||
    errors.phone ||
    errors.email ||
    errors.address
  );
  const hasFiscalErrors = Boolean(
    errors.fiscalAddress || errors.fiscalBusinessName || errors.fiscalCondition || errors.fiscalCuit
  );
  const hasAccountErrors = Boolean(errors.currentAccountLimit || errors.currentAccountEnabled);

  const onInvalid = (formErrors: FieldErrors<PosCustomerModalValues>) => {
    const personalError =
      formErrors.firstName ||
      formErrors.lastName ||
      formErrors.documentNumber ||
      formErrors.phone ||
      formErrors.email ||
      formErrors.address;
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
        return "rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm ring-1 ring-red-300 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800";
      }
      return "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100 dark:shadow-none";
    }

    if (highlightedTab === tabKey || hasErrors) {
      return "rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400";
    }

    return "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";
  };

  const sectionClass =
    highlightedTab === tab || (tab === "personal" && hasPersonalErrors) || (tab === "fiscal" && hasFiscalErrors) || (tab === "account" && hasAccountErrors)
      ? "rounded-xl border border-red-300 bg-red-50/60 p-3.5 dark:border-red-900/70 dark:bg-red-950/30"
      : "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50";

  return (
    <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <button
        type="button"
        aria-label="Cerrar modal cliente"
        className="absolute inset-0"
        onClick={onCancel}
      />

      <form
        autoComplete="off"
        className="relative z-10 w-full max-w-3xl space-y-4 rounded-2xl bg-white p-4 shadow-panel dark:bg-slate-900 dark:border dark:border-slate-800"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <ModalCloseButton label="Cerrar cliente" onClick={onCancel} disabled={disabled} />
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 dark:border dark:border-slate-700/60">
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
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nombre <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  {...register("firstName")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.firstName ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.firstName.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Apellido <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  {...register("lastName")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.lastName ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.lastName.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tipo documento <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <select {...register("documentType")} className="ui-input" disabled={disabled}>
                  <option value="dni">DNI</option>
                  <option value="cuit">CUIT</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Numero documento{" "}
                  {activeReq.document_number ? (
                    <span className="text-red-500 dark:text-red-400">*</span>
                  ) : (
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                  )}
                </label>
                <input
                  {...register("documentNumber")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.documentNumber ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.documentNumber.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Telefono{" "}
                  {activeReq.phone ? (
                    <span className="text-red-500 dark:text-red-400">*</span>
                  ) : (
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                  )}
                </label>
                <input
                  {...register("phone")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.phone ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email{" "}
                  {activeReq.email ? (
                    <span className="text-red-500 dark:text-red-400">*</span>
                  ) : (
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                  )}
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.email ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Direccion{" "}
                  {activeReq.address ? (
                    <span className="text-red-500 dark:text-red-400">*</span>
                  ) : (
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                  )}
                </label>
                <input
                  {...register("address")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.address ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.address.message}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "fiscal" ? (
          <div className={sectionClass}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Razon social <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalBusinessName")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Domicilio fiscal <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalAddress")}
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Condicion fiscal <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalCondition")}
                  placeholder="Consumidor final, RI, Monotributo..."
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  CUIT fiscal (ARCA) <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <input
                  {...register("fiscalCuit")}
                  placeholder="Si se completa, se usa como doc fiscal"
                  className="ui-input"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "account" ? (
          <div className={sectionClass}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  {...register("currentAccountEnabled")}
                  className="h-4 w-4"
                  disabled={disabled}
                />
                Habilitar cuenta corriente para este cliente
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Limite autorizado <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{optionalLabel}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("currentAccountLimit")}
                  className="ui-input"
                  disabled={disabled || !currentAccountEnabled}
                  placeholder="Sin limite si se deja vacio"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Estado</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {currentAccountEnabled ? "Habilitada" : "Deshabilitada"}
                  </span>
                </p>
                <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Limite autorizado</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {accountLimit == null ? "Sin limite" : currency.format(accountLimit)}
                  </span>
                </p>
                <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Deuda actual</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{currency.format(currentBalance)}</span>
                </p>
                <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Disponible</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {currentAccountEnabled
                      ? accountAvailable == null
                        ? "Sin tope"
                        : currency.format(accountAvailable)
                      : "-"}
                  </span>
                </p>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Este limite se aplica en POS cuando se cobra con cuenta corriente.
              </p>

              {onOpenCurrentAccount ? (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    className="ui-btn-ghost px-3 py-1.5 text-xs"
                    onClick={onOpenCurrentAccount}
                    disabled={disabled}
                  >
                    Ver cuenta corriente
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
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
