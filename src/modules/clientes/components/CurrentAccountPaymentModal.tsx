import { useEffect, useMemo, useState } from "react";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
import {
  getPaymentMethodPosConfig,
  normalizePaymentMethodCode,
  type PaymentMethodPosConfig,
} from "@/services/payment-methods.service";
import type {
  BankAccount,
  InstallmentPlan,
  OriginBank,
  PaymentMethod,
} from "@/types/entities";
import type {
  CurrentAccountSummary,
  RegisterCurrentAccountPaymentValues,
} from "@/modules/clientes/hooks/useCurrentAccount";

interface CurrentAccountPaymentModalProps {
  open: boolean;
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  originBanks: OriginBank[];
  installmentPlans: InstallmentPlan[];
  accountSummary: CurrentAccountSummary;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (values: RegisterCurrentAccountPaymentValues) => Promise<boolean>;
}

interface PaymentDetailsDraft {
  destinationBankAccountId: string;
  couponNumber: string;
  authorizationNumber: string;
  operationNumber: string;
  voucherNumber: string;
  originBankId: string;
  newOriginBankName: string;
  originAccountHolder: string;
  cardBrand: string;
  installmentPlanId: string;
  chequeNumber: string;
  chequeDueDate: string;
}

const getInitialDetailsDraft = (): PaymentDetailsDraft => ({
  destinationBankAccountId: "",
  couponNumber: "",
  authorizationNumber: "",
  operationNumber: "",
  voucherNumber: "",
  originBankId: "",
  newOriginBankName: "",
  originAccountHolder: "",
  cardBrand: "",
  installmentPlanId: "",
  chequeNumber: "",
  chequeDueDate: "",
});

const getPaymentMethodLabel = (paymentMethod: PaymentMethod): string => {
  const code = normalizePaymentMethodCode(paymentMethod.code);
  if (code === "cash") return "Efectivo";
  if (code === "card_debit") return "Tarjeta de debito";
  if (code === "card_credit") return "Tarjeta de credito";
  if (code === "transfer") return "Transferencia bancaria";
  if (code === "mercado_pago") return "Mercado Pago";
  if (code === "cheque") return "Cheque";
  if (code === "current_account") return "Cuenta corriente";
  return paymentMethod.name;
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const roundAmount = (value: number): number => Number(value.toFixed(2));

type PaymentPricingMode = "original" | "update_to_today_price" | "surcharge_percentage" | "surcharge_fixed";

const resolvePreviewBalance = (
  mode: PaymentPricingMode,
  accountSummary: CurrentAccountSummary,
  surchargePercent: string,
  surchargeAmount: string
): number => {
  if (mode === "original") return accountSummary.accountingBalance;
  if (mode === "update_to_today_price") {
    return roundAmount(
      accountSummary.updatedDebtTotal + accountSummary.adjustmentsTotal - accountSummary.paymentsTotal
    );
  }

  if (mode === "surcharge_percentage") {
    const percent = Number(surchargePercent.trim().replace(",", "."));
    if (!Number.isFinite(percent) || percent <= 0) return accountSummary.updatedBalance;
    return roundAmount(
      accountSummary.initialDebtTotal * (1 + percent / 100) +
        accountSummary.adjustmentsTotal -
        accountSummary.paymentsTotal
    );
  }

  const fixedAmount = Number(surchargeAmount.trim().replace(",", "."));
  if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) return accountSummary.updatedBalance;
  return roundAmount(
    accountSummary.initialDebtTotal +
      fixedAmount +
      accountSummary.adjustmentsTotal -
      accountSummary.paymentsTotal
  );
};

export const CurrentAccountPaymentModal = ({
  open,
  paymentMethods,
  bankAccounts,
  originBanks,
  installmentPlans,
  accountSummary,
  disabled,
  onClose,
  onSubmit,
}: CurrentAccountPaymentModalProps) => {
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [notes, setNotes] = useState("");
  const [applyPricingRule, setApplyPricingRule] = useState(false);
  const [pricingMode, setPricingMode] = useState<PaymentPricingMode>("update_to_today_price");
  const [surchargePercent, setSurchargePercent] = useState("");
  const [surchargeAmount, setSurchargeAmount] = useState("");
  const [detailsDraft, setDetailsDraft] = useState<PaymentDetailsDraft>(getInitialDetailsDraft());
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = Boolean(disabled || isSubmittingLocal);
  const previewUpdatedBalance = useMemo(
    () =>
      applyPricingRule
        ? resolvePreviewBalance(pricingMode, accountSummary, surchargePercent, surchargeAmount)
        : accountSummary.updatedBalance,
    [accountSummary, applyPricingRule, pricingMode, surchargeAmount, surchargePercent]
  );

  useEffect(() => {
    if (!open) return;
    const firstAllowedMethod =
      paymentMethods.find(
        (method) => normalizePaymentMethodCode(method.code) !== "current_account"
      ) ?? paymentMethods[0];
    setSelectedMethodId(firstAllowedMethod?.id ?? "");
    setAmountInput(accountSummary.updatedBalance > 0 ? accountSummary.updatedBalance.toFixed(2) : "");
    setNotes("");
    setApplyPricingRule(false);
    setPricingMode("update_to_today_price");
    setSurchargePercent("");
    setSurchargeAmount("");
    setDetailsDraft(getInitialDetailsDraft());
    setErrorMessage(null);
  }, [accountSummary.updatedBalance, open, paymentMethods]);

  const selectedMethod = useMemo(
    () => paymentMethods.find((method) => method.id === selectedMethodId) ?? null,
    [paymentMethods, selectedMethodId]
  );
  const selectedMethodCode = normalizePaymentMethodCode(selectedMethod?.code);
  const selectedMethodConfig = useMemo<PaymentMethodPosConfig | null>(
    () => (selectedMethod ? getPaymentMethodPosConfig(selectedMethod) : null),
    [selectedMethod]
  );

  const destinationBankAccounts = useMemo(() => {
    if (!selectedMethodConfig?.ask_destination_bank) return bankAccounts;
    if (!selectedMethodConfig.destination_bank_account_ids.length) return bankAccounts;

    const allowedIds = new Set(selectedMethodConfig.destination_bank_account_ids);
    const filtered = bankAccounts.filter((account) => allowedIds.has(account.id));
    return filtered.length ? filtered : bankAccounts;
  }, [bankAccounts, selectedMethodConfig]);

  const selectedDestinationBank = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === detailsDraft.destinationBankAccountId
      ) ?? null,
    [detailsDraft.destinationBankAccountId, destinationBankAccounts]
  );
  const selectedOriginBank = useMemo(
    () => originBanks.find((bank) => bank.id === detailsDraft.originBankId) ?? null,
    [detailsDraft.originBankId, originBanks]
  );
  const selectedInstallmentPlan = useMemo(
    () =>
      installmentPlans.find((plan) => plan.id === detailsDraft.installmentPlanId) ?? null,
    [detailsDraft.installmentPlanId, installmentPlans]
  );

  const availableInstallmentPlans = useMemo(() => {
    const normalizedBrand = detailsDraft.cardBrand.trim().toLowerCase();
    return installmentPlans.filter((plan) => {
      if (!plan.is_active) return false;
      if (!normalizedBrand) return true;
      if (!plan.card_brand) return true;
      return plan.card_brand.trim().toLowerCase() === normalizedBrand;
    });
  }, [detailsDraft.cardBrand, installmentPlans]);

  const patchDetails = (patch: Partial<PaymentDetailsDraft>) => {
    setDetailsDraft((current) => ({
      ...current,
      ...patch,
    }));
    setErrorMessage(null);
  };

  const resolvePaymentDetails = (): {
    ok: boolean;
    details: Record<string, unknown> | null;
    error?: string;
  } => {
    if (!selectedMethod || !selectedMethodConfig) {
      return { ok: false, details: null, error: "Selecciona un medio de pago" };
    }

    if (selectedMethodCode === "current_account") {
      return {
        ok: false,
        details: null,
        error: "Cuenta corriente no se puede usar para cobrar deuda",
      };
    }

    if (selectedMethodConfig.ask_destination_bank && !selectedDestinationBank) {
      return {
        ok: false,
        details: null,
        error: "Selecciona la cuenta bancaria destino",
      };
    }
    if (selectedMethodConfig.ask_coupon_number && !detailsDraft.couponNumber.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa el numero de cupon",
      };
    }
    if (selectedMethodConfig.ask_approval_number && !detailsDraft.authorizationNumber.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa el numero de autorizacion",
      };
    }
    if (selectedMethodConfig.ask_operation_number && !detailsDraft.operationNumber.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa el numero de operacion",
      };
    }
    if (selectedMethodConfig.ask_voucher_number && !detailsDraft.voucherNumber.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa el numero de comprobante",
      };
    }

    if (selectedMethodConfig.ask_origin_bank) {
      if (!detailsDraft.originBankId.trim()) {
        return {
          ok: false,
          details: null,
          error: "Selecciona banco de origen",
        };
      }
      if (detailsDraft.originBankId === "__new__") {
        if (!selectedMethodConfig.allow_new_origin_bank) {
          return {
            ok: false,
            details: null,
            error: "No se permite cargar banco de origen nuevo para este medio",
          };
        }
        if (!detailsDraft.newOriginBankName.trim()) {
          return {
            ok: false,
            details: null,
            error: "Completa el nombre del nuevo banco de origen",
          };
        }
      } else if (!selectedOriginBank) {
        return {
          ok: false,
          details: null,
          error: "Selecciona un banco de origen valido",
        };
      }
    }

    if (
      selectedMethodConfig.ask_origin_account_holder &&
      !detailsDraft.originAccountHolder.trim()
    ) {
      return {
        ok: false,
        details: null,
        error: "Completa titular de la cuenta de origen",
      };
    }
    if (selectedMethodConfig.ask_card_brand && !detailsDraft.cardBrand.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa la marca de tarjeta",
      };
    }
    if (selectedMethodConfig.ask_installment_plan && !selectedInstallmentPlan) {
      return {
        ok: false,
        details: null,
        error: "Selecciona plan de cuotas",
      };
    }
    if (selectedMethodConfig.ask_cheque_number && !detailsDraft.chequeNumber.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa numero de cheque",
      };
    }
    if (selectedMethodConfig.ask_cheque_due_date && !detailsDraft.chequeDueDate.trim()) {
      return {
        ok: false,
        details: null,
        error: "Completa fecha de vencimiento del cheque",
      };
    }

    return {
      ok: true,
      details: {
        payment_method: {
          id: selectedMethod.id,
          code: selectedMethod.code,
          type: selectedMethod.type,
          name: selectedMethod.name,
        },
        destination_bank_account:
          selectedDestinationBank == null
            ? null
            : {
                id: selectedDestinationBank.id,
                bank_name: selectedDestinationBank.bank_name,
                alias: selectedDestinationBank.alias,
                holder_name: selectedDestinationBank.holder_name,
              },
        coupon_number: detailsDraft.couponNumber.trim() || null,
        authorization_number: detailsDraft.authorizationNumber.trim() || null,
        operation_number: detailsDraft.operationNumber.trim() || null,
        voucher_number: detailsDraft.voucherNumber.trim() || null,
        origin_bank:
          detailsDraft.originBankId === "__new__"
            ? {
                is_new: true,
                name: detailsDraft.newOriginBankName.trim(),
              }
            : selectedOriginBank == null
              ? null
              : {
                  is_new: false,
                  id: selectedOriginBank.id,
                  code: selectedOriginBank.code,
                  name: selectedOriginBank.name,
                },
        origin_account_holder: detailsDraft.originAccountHolder.trim() || null,
        card_brand: detailsDraft.cardBrand.trim() || null,
        installment_plan:
          selectedInstallmentPlan == null
            ? null
            : {
                id: selectedInstallmentPlan.id,
                code: selectedInstallmentPlan.code,
                name: selectedInstallmentPlan.name,
                installments: selectedInstallmentPlan.installments,
                interest_percent: selectedInstallmentPlan.interest_percent,
              },
        cheque_number: detailsDraft.chequeNumber.trim() || null,
        cheque_due_date: detailsDraft.chequeDueDate.trim() || null,
      },
    };
  };

  const submit = async () => {
    setErrorMessage(null);

    if (!selectedMethod) {
      setErrorMessage("Selecciona un medio de pago");
      return;
    }

    const parsedAmount = Number(amountInput.trim().replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("El monto debe ser mayor a 0");
      return;
    }

    const resolved = resolvePaymentDetails();
    if (!resolved.ok) {
      setErrorMessage(resolved.error ?? "Faltan datos de cobro");
      return;
    }

    const parsedSurchargePercent = Number(surchargePercent.trim().replace(",", "."));
    const parsedSurchargeAmount = Number(surchargeAmount.trim().replace(",", "."));
    if (applyPricingRule && pricingMode === "surcharge_percentage") {
      if (!Number.isFinite(parsedSurchargePercent) || parsedSurchargePercent <= 0) {
        setErrorMessage("Ingresa un porcentaje de recargo mayor a 0");
        return;
      }
    }
    if (applyPricingRule && pricingMode === "surcharge_fixed") {
      if (!Number.isFinite(parsedSurchargeAmount) || parsedSurchargeAmount <= 0) {
        setErrorMessage("Ingresa un recargo fijo mayor a 0");
        return;
      }
    }

    setIsSubmittingLocal(true);
    try {
      const ok = await onSubmit({
        payment_method_id: selectedMethod.id,
        amount: roundAmount(parsedAmount),
        notes: notes.trim() || undefined,
        payment_details: resolved.details,
        pricing_rule: applyPricingRule
          ? {
              mode: pricingMode,
              surcharge_percent:
                pricingMode === "surcharge_percentage" ? parsedSurchargePercent : undefined,
              surcharge_amount:
                pricingMode === "surcharge_fixed" ? parsedSurchargeAmount : undefined,
              notes: "Regla aplicada antes de registrar pago",
            }
          : null,
      });
      if (!ok) return;
      onClose();
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Registrar pago adeudado</h3>
            <p className="text-xs text-slate-500">
              Selecciona medio de pago y completa los datos contables requeridos.
            </p>
          </div>
          <button
            type="button"
            className="ui-btn-ghost px-2 py-1 text-xs"
            onClick={onClose}
            disabled={busy}
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">Medio de pago</p>
            <PaymentMethodSelector
              paymentMethods={paymentMethods}
              selectedPaymentMethodId={selectedMethodId}
              disabled={busy}
              columns={2}
              isMethodDisabled={(method) => normalizePaymentMethodCode(method.code) === "current_account"}
              getMethodBadges={(method) =>
                normalizePaymentMethodCode(method.code) === "current_account" ? ["No permitido"] : []
              }
              onChange={(methodId) => {
                setSelectedMethodId(methodId);
                setErrorMessage(null);
              }}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Monto</label>
              <input
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(event) => {
                  setAmountInput(event.target.value);
                  setErrorMessage(null);
                }}
                className="ui-input"
                disabled={busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Observacion</label>
              <input
                type="text"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setErrorMessage(null);
                }}
                className="ui-input"
                disabled={busy}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={applyPricingRule}
                onChange={(event) => {
                  setApplyPricingRule(event.target.checked);
                  if (event.target.checked) {
                    const nextPreview = resolvePreviewBalance(
                      pricingMode,
                      accountSummary,
                      surchargePercent,
                      surchargeAmount
                    );
                    if (nextPreview > 0) setAmountInput(nextPreview.toFixed(2));
                  } else if (accountSummary.updatedBalance > 0) {
                    setAmountInput(accountSummary.updatedBalance.toFixed(2));
                  }
                  setErrorMessage(null);
                }}
                disabled={busy}
              />
              <span>Desea aplicar algun recargo o actualizacion antes del pago?</span>
            </label>
            <p className="mt-1 text-xs text-slate-500" title="El recargo o actualizacion vigente reemplaza al anterior; no se suma varias veces.">
              El recargo o actualizacion reemplaza al anterior; no se acumula.
            </p>

            {applyPricingRule ? (
              <div className="mt-3 grid gap-2">
                <select
                  className="ui-input"
                  value={pricingMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as PaymentPricingMode;
                    setPricingMode(nextMode);
                    const nextPreview = resolvePreviewBalance(
                      nextMode,
                      accountSummary,
                      surchargePercent,
                      surchargeAmount
                    );
                    if (nextPreview > 0) setAmountInput(nextPreview.toFixed(2));
                    setErrorMessage(null);
                  }}
                  disabled={busy}
                >
                  <option value="original">Volver a precio original</option>
                  <option value="update_to_today_price">Actualizar a precio de hoy</option>
                  <option value="surcharge_percentage">Recargo porcentual final</option>
                  <option value="surcharge_fixed">Recargo fijo final</option>
                </select>

                {pricingMode === "surcharge_percentage" ? (
                  <input
                    className="ui-input"
                    type="number"
                    step="0.01"
                    value={surchargePercent}
                    onChange={(event) => {
                      setSurchargePercent(event.target.value);
                      const nextPreview = resolvePreviewBalance(
                        "surcharge_percentage",
                        accountSummary,
                        event.target.value,
                        surchargeAmount
                      );
                      if (nextPreview > 0) setAmountInput(nextPreview.toFixed(2));
                      setErrorMessage(null);
                    }}
                    placeholder="Porcentaje de recargo final"
                    disabled={busy}
                  />
                ) : null}

                {pricingMode === "surcharge_fixed" ? (
                  <input
                    className="ui-input"
                    type="number"
                    step="0.01"
                    value={surchargeAmount}
                    onChange={(event) => {
                      setSurchargeAmount(event.target.value);
                      const nextPreview = resolvePreviewBalance(
                        "surcharge_fixed",
                        accountSummary,
                        surchargePercent,
                        event.target.value
                      );
                      if (nextPreview > 0) setAmountInput(nextPreview.toFixed(2));
                      setErrorMessage(null);
                    }}
                    placeholder="Monto fijo de recargo final"
                    disabled={busy}
                  />
                ) : null}

                <p className="text-xs text-slate-500">
                  Saldo actualizado a cobrar: <strong>{currency.format(previewUpdatedBalance)}</strong>
                </p>
              </div>
            ) : null}
          </div>

          {selectedMethod && selectedMethodConfig ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Datos contables del cobro</p>
                <p className="text-xs text-slate-500">
                  Completa los datos de {getPaymentMethodLabel(selectedMethod).toLowerCase()}.
                </p>
              </div>

              {selectedMethodConfig.ask_card_brand ? (
                <input
                  className="ui-input"
                  value={detailsDraft.cardBrand}
                  onChange={(event) => patchDetails({ cardBrand: event.target.value })}
                  placeholder="Tarjeta (Visa, Master, Amex...)"
                  disabled={busy}
                />
              ) : null}

              {selectedMethodConfig.ask_installment_plan ? (
                <select
                  className="ui-input"
                  value={detailsDraft.installmentPlanId}
                  onChange={(event) => patchDetails({ installmentPlanId: event.target.value })}
                  disabled={busy}
                >
                  <option value="">Plan de cuotas</option>
                  {availableInstallmentPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.installments} cuotas)
                    </option>
                  ))}
                </select>
              ) : null}

              {selectedMethodConfig.ask_coupon_number ||
              selectedMethodConfig.ask_approval_number ||
              selectedMethodConfig.ask_operation_number ||
              selectedMethodConfig.ask_voucher_number ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedMethodConfig.ask_coupon_number ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.couponNumber}
                      onChange={(event) => patchDetails({ couponNumber: event.target.value })}
                      placeholder="Numero de cupon"
                      disabled={busy}
                    />
                  ) : null}
                  {selectedMethodConfig.ask_approval_number ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.authorizationNumber}
                      onChange={(event) =>
                        patchDetails({ authorizationNumber: event.target.value })
                      }
                      placeholder="Numero de autorizacion"
                      disabled={busy}
                    />
                  ) : null}
                  {selectedMethodConfig.ask_operation_number ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.operationNumber}
                      onChange={(event) => patchDetails({ operationNumber: event.target.value })}
                      placeholder="Numero de operacion"
                      disabled={busy}
                    />
                  ) : null}
                  {selectedMethodConfig.ask_voucher_number ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.voucherNumber}
                      onChange={(event) => patchDetails({ voucherNumber: event.target.value })}
                      placeholder="Numero de comprobante"
                      disabled={busy}
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedMethodConfig.ask_origin_bank ? (
                <div className="grid gap-2">
                  <select
                    className="ui-input"
                    value={detailsDraft.originBankId}
                    onChange={(event) => patchDetails({ originBankId: event.target.value })}
                    disabled={busy}
                  >
                    <option value="">Banco de origen</option>
                    {originBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                    {selectedMethodConfig.allow_new_origin_bank ? (
                      <option value="__new__">+ Agregar nuevo banco</option>
                    ) : null}
                  </select>

                  {selectedMethodConfig.allow_new_origin_bank &&
                  detailsDraft.originBankId === "__new__" ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.newOriginBankName}
                      onChange={(event) =>
                        patchDetails({ newOriginBankName: event.target.value })
                      }
                      placeholder="Nuevo banco de origen"
                      disabled={busy}
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedMethodConfig.ask_origin_account_holder ? (
                <input
                  className="ui-input"
                  value={detailsDraft.originAccountHolder}
                  onChange={(event) =>
                    patchDetails({ originAccountHolder: event.target.value })
                  }
                  placeholder="Titular cuenta origen"
                  disabled={busy}
                />
              ) : null}

              {selectedMethodConfig.ask_cheque_number ||
              selectedMethodConfig.ask_cheque_due_date ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedMethodConfig.ask_cheque_number ? (
                    <input
                      className="ui-input"
                      value={detailsDraft.chequeNumber}
                      onChange={(event) => patchDetails({ chequeNumber: event.target.value })}
                      placeholder="Numero de cheque"
                      disabled={busy}
                    />
                  ) : null}
                  {selectedMethodConfig.ask_cheque_due_date ? (
                    <input
                      type="date"
                      className="ui-input"
                      value={detailsDraft.chequeDueDate}
                      onChange={(event) =>
                        patchDetails({ chequeDueDate: event.target.value })
                      }
                      disabled={busy}
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedMethodConfig.ask_destination_bank ? (
                <div className="space-y-1">
                  <select
                    className="ui-input"
                    value={detailsDraft.destinationBankAccountId}
                    onChange={(event) =>
                      patchDetails({ destinationBankAccountId: event.target.value })
                    }
                    disabled={busy}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                  {selectedDestinationBank ? (
                    <p className="text-xs text-slate-500">
                      Alias destino: {selectedDestinationBank.alias || "Sin alias"}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => {
                void submit();
              }}
              disabled={busy || !paymentMethods.length}
            >
              {busy ? "Guardando..." : "Guardar pago"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
