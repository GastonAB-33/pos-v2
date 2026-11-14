import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building,
  Check,
  Landmark,
  Plus,
  RefreshCw,
  Truck,
  Users,
  Vault,
  X,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { generalCashService } from "@/services/general-cash.service";
import type { BankAccount, GeneralCashOriginType } from "@/types/entities";
import { cn } from "@/utils/cn";

export interface GeneralCashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "income" | "expense";
  currentBalance: number;
  onSuccess?: () => void;
  canWrite: boolean;
}

interface GeneralCashOption {
  id: string;
  name: string;
  subtitle: string;
  originType: GeneralCashOriginType;
  icon: typeof Banknote;
  bankAccountId?: string;
  bankName?: string;
  defaultConcept: string;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const formatMoney = (amount: number | null | undefined): string => {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return currency.format(num);
};

export const GeneralCashMovementModal = ({
  isOpen,
  onClose,
  defaultMode = "income",
  currentBalance,
  onSuccess,
  canWrite,
}: GeneralCashMovementModalProps) => {
  const { tenantId } = useTenant();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const [mode, setMode] = useState<"income" | "expense">(defaultMode);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form values
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [lockedOptionIds, setLockedOptionIds] = useState<Record<string, boolean>>({});
  const [concept, setConcept] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [notes, setNotes] = useState("");

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const voucherRef = useRef<HTMLInputElement | null>(null);
  const conceptRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  // Sincronizar modo inicial al abrir modal
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setConcept("");
      setVoucherNumber("");
      setNotes("");
      setAmountInputs({});
      setLockedOptionIds({});
    }
  }, [isOpen, defaultMode]);

  // Cargar cuentas bancarias activas del comercio
  useEffect(() => {
    if (!isOpen || !tenantId) return;
    let isMounted = true;
    bankAccountsService
      .getActiveByTenant(tenantId)
      .then((accs) => {
        if (isMounted) setBankAccounts(accs);
      })
      .catch((err) => {
        console.error("Error al cargar cuentas bancarias para caja general:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId]);

  // Construir opciones dinámicas según el modo (Ingreso o Egreso)
  const options = useMemo<GeneralCashOption[]>(() => {
    const list: GeneralCashOption[] = [];

    if (mode === "income") {
      // 1. Aporte de capital / Fondos propios
      list.push({
        id: "opt-manual-income",
        name: "Aporte de Capital / Fondos Propios",
        subtitle: "Inyección de efectivo resguardado por socios o tesorería",
        originType: "manual_income",
        icon: Plus,
        defaultConcept: "Aporte de capital a caja fuerte",
      });

      // 2. Extracciones bancarias (desglosadas por cada cuenta activa del comercio)
      if (bankAccounts.length > 0) {
        for (const acc of bankAccounts) {
          const holder = acc.holder_name ? ` (${acc.holder_name})` : "";
          const details = [
            acc.alias ? `Alias: ${acc.alias}` : null,
            acc.cbu ? `CBU: ...${acc.cbu.slice(-6)}` : null,
          ]
            .filter(Boolean)
            .join(" • ");

          list.push({
            id: `opt-bank-in-${acc.id}`,
            name: `Extracción Bancaria ${acc.bank_name}${holder}`,
            subtitle: details || acc.account_type?.replace("_", " ") || "Cuenta bancaria propia",
            originType: "manual_income",
            icon: Landmark,
            bankAccountId: acc.id,
            bankName: acc.bank_name,
            defaultConcept: `Extracción bancaria ${acc.bank_name} para caja fuerte`,
          });
        }
      }

      // 3. Cierre de Caja diaria / Recaudación
      list.push({
        id: "opt-daily-cash-close",
        name: "Cierre de Caja Diaria / Recaudación",
        subtitle: "Traspaso de efectivo recaudado al cerrar turno del POS",
        originType: "daily_cash_close",
        icon: ArrowDownLeft,
        defaultConcept: "Recaudación por cierre de caja diaria",
      });
    } else {
      // MODO EGRESO:
      // 1. Depósito en cuentas bancarias (desglosado por bancos activos)
      if (bankAccounts.length > 0) {
        for (const acc of bankAccounts) {
          const holder = acc.holder_name ? ` (${acc.holder_name})` : "";
          const details = [
            acc.alias ? `Alias: ${acc.alias}` : null,
            acc.cbu ? `CBU: ...${acc.cbu.slice(-6)}` : null,
          ]
            .filter(Boolean)
            .join(" • ");

          list.push({
            id: `opt-bank-out-${acc.id}`,
            name: `Depósito en ${acc.bank_name}${holder}`,
            subtitle: details || acc.account_type?.replace("_", " ") || "Depósito a cuenta bancaria",
            originType: "bank_deposit",
            icon: Building,
            bankAccountId: acc.id,
            bankName: acc.bank_name,
            defaultConcept: `Depósito en cuenta ${acc.bank_name}`,
          });
        }
      } else {
        // Fallback genérico si no hay cuentas configuradas en módulo bancos
        list.push({
          id: "opt-bank-generic",
          name: "Depósito en Cuenta Bancaria",
          subtitle: "Sin cuentas configuradas en módulo Bancos",
          originType: "bank_deposit",
          icon: Building,
          defaultConcept: "Depósito en cuenta bancaria",
        });
      }

      // 2. Fondo para apertura de Caja diaria
      list.push({
        id: "opt-daily-cash-open",
        name: "Fondo Apertura Caja Diaria",
        subtitle: "Entrega de cambio inicial para apertura de turno POS",
        originType: "daily_cash_open",
        icon: ArrowUpRight,
        defaultConcept: "Fondo inicial apertura caja diaria",
      });

      // 3. Pago a proveedor en efectivo
      list.push({
        id: "opt-supplier-payment",
        name: "Pago a Proveedor en Efectivo",
        subtitle: "Egreso de caja fuerte para pago a proveedores o mercadería",
        originType: "supplier_payment",
        icon: Truck,
        defaultConcept: "Pago a proveedor en efectivo",
      });

      // 4. Retiro de socios / Gastos varios
      list.push({
        id: "opt-manual-expense",
        name: "Retiro de Socios / Ganancias / Gastos",
        subtitle: "Retiro de utilidades, adelantos o egresos de administración",
        originType: "manual_expense",
        icon: Users,
        defaultConcept: "Retiro de socios / Ganancias",
      });
    }

    return list;
  }, [mode, bankAccounts]);

  // Selección por defecto cuando cambian las opciones
  useEffect(() => {
    if (options.length > 0) {
      if (!options.some((o) => o.id === selectedOptionId)) {
        const first = options[0];
        setSelectedOptionId(first.id);
        if (!concept) {
          setConcept(first.defaultConcept);
        }
      }
    }
  }, [options, selectedOptionId, concept]);

  // Obtener opción activa
  const activeOption = useMemo(
    () => options.find((o) => o.id === selectedOptionId) || options[0],
    [options, selectedOptionId]
  );

  // Monto numérico asignado
  const currentRawAmount = activeOption ? (amountInputs[activeOption.id] ?? "") : "";
  const numericAmount = parseFloat(currentRawAmount.replace(",", ".")) || 0;
  const isAssigned = numericAmount > 0;
  const isOverBalance = mode === "expense" && numericAmount > currentBalance;

  // Autofocus inmediato on mount al primer input numérico
  useEffect(() => {
    if (isOpen && options.length > 0) {
      const timer = window.setTimeout(() => {
        const firstId = options[0]?.id;
        const input = inputRefs.current[firstId];
        if (input) {
          input.focus();
          input.select();
        }
      }, 70);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, mode]);

  // Alternar entre modo Ingreso y Egreso
  const handleModeToggle = (nextMode: "income" | "expense") => {
    setMode(nextMode);
    setAmountInputs({});
    setLockedOptionIds({});
    setSelectedOptionId("");
    setConcept("");
    setVoucherNumber("");
    setNotes("");
  };

  // Manejar hotkeys globales: Escape (cerrar) y F2 (alternar modo)
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleModeToggle(mode === "income" ? "expense" : "income");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, mode, onClose]);

  // Seleccionar una opción de la lista
  const handleSelectOption = useCallback(
    (option: GeneralCashOption) => {
      setSelectedOptionId(option.id);
      // Trasladar monto si ya se había escrito alguno
      if (numericAmount > 0) {
        setAmountInputs({ [option.id]: numericAmount.toString() });
        setLockedOptionIds({});
      }
      // Actualizar concepto sugerido si el usuario no escribió uno personalizado
      setConcept(option.defaultConcept);

      // Enfocar input numérico
      window.setTimeout(() => {
        const input = inputRefs.current[option.id];
        if (input) {
          input.focus();
          input.select();
        }
      }, 30);
    },
    [numericAmount]
  );

  // Manejar edición del monto numérico
  const handleAmountChange = (optionId: string, val: string) => {
    setLockedOptionIds((prev) => {
      if (!prev[optionId]) return prev;
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
    setAmountInputs({ [optionId]: val });
  };

  // Confirmar monto de la opción (pasa a verde)
  const handleConfirmOption = (option: GeneralCashOption) => {
    const raw = amountInputs[option.id] ?? "";
    const clean = raw.replace(",", ".");
    const num = parseFloat(clean);

    if (!isNaN(num) && num > 0) {
      setLockedOptionIds({ [option.id]: true });
      setAmountInputs({ [option.id]: num.toFixed(2) });

      // Avanzar el foco
      if (option.bankAccountId) {
        window.setTimeout(() => {
          voucherRef.current?.focus();
          voucherRef.current?.select();
        }, 30);
      } else {
        window.setTimeout(() => {
          conceptRef.current?.focus();
          conceptRef.current?.select();
        }, 30);
      }
    }
  };

  // Limpiar monto
  const handleClearOption = (optionId: string) => {
    setLockedOptionIds((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
    setAmountInputs((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
  };

  // Navegación ágil por teclado en las opciones
  const handleKeyDownOnOption = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    option: GeneralCashOption
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < options.length) {
        handleSelectOption(options[nextIndex]);
      } else {
        if (activeOption?.bankAccountId && voucherRef.current) {
          voucherRef.current.focus();
          voucherRef.current.select();
        } else if (conceptRef.current) {
          conceptRef.current.focus();
          conceptRef.current.select();
        }
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        handleSelectOption(options[prevIndex]);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const raw = amountInputs[option.id] ?? "";
      const clean = raw.replace(",", ".");
      const num = parseFloat(clean);
      if (!isNaN(num) && num > 0) {
        handleConfirmOption(option);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
  };

  const handleKeyDownOnVoucher = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      conceptRef.current?.focus();
      conceptRef.current?.select();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "Escape") {
      e.preventDefault();
      if (activeOption) {
        const input = inputRefs.current[activeOption.id];
        input?.focus();
        input?.select();
      }
    }
  };

  const handleKeyDownOnConcept = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      notesRef.current?.focus();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeOption?.bankAccountId && voucherRef.current) {
        voucherRef.current.focus();
        voucherRef.current.select();
      } else if (activeOption) {
        const input = inputRefs.current[activeOption.id];
        input?.focus();
        input?.select();
      }
    }
  };

  const handleKeyDownOnNotes = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (numericAmount > 0) {
        void handleSubmit();
      }
    }
  };

  // Enviar formulario
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canWrite) {
      toast.error("No posees permisos para operar en Caja General");
      return;
    }
    if (!tenantId) {
      toast.error("No hay un comercio activo");
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0");
      return;
    }
    if (!concept.trim()) {
      toast.error("El concepto o motivo es obligatorio");
      return;
    }

    const currentOpt = activeOption;
    if (!currentOpt) return;

    setIsSubmitting(true);
    try {
      // 1. Armar notas con nro de comprobante si corresponde
      const cleanVoucher = voucherNumber.trim();
      const cleanNotes = notes.trim();
      const combinedNotes = [
        cleanVoucher ? `Comprobante / Nro Ref: ${cleanVoucher}` : null,
        currentOpt.bankName ? `Banco: ${currentOpt.bankName}` : null,
        cleanNotes || null,
      ]
        .filter(Boolean)
        .join(" • ");

      // 2. Registrar movimiento en Caja General
      await generalCashService.createMovement(tenantId, {
        type: mode,
        amount: numericAmount,
        origin_type: currentOpt.originType,
        concept: concept.trim(),
        notes: combinedNotes || null,
        reference_id: currentOpt.bankAccountId || cleanVoucher || null,
        created_by: user?.id ?? null,
      });

      // 3. Si se vinculó a una cuenta bancaria propia, registrar también en el módulo Bancos
      if (currentOpt.bankAccountId) {
        try {
          await bankAccountMovementsService.createMovement(tenantId, {
            bank_account_id: currentOpt.bankAccountId,
            // En egreso de caja fuerte para depósito bancario -> es ingreso al banco
            // En ingreso a caja fuerte desde extracción bancaria -> es egreso del banco
            type: mode === "expense" ? "income" : "expense",
            origin_type: mode === "expense" ? "manual_income" : "manual_expense",
            concept:
              mode === "expense"
                ? `Depósito desde Caja Fuerte - ${concept.trim()}`
                : `Extracción para Caja Fuerte - ${concept.trim()}`,
            amount: numericAmount,
            voucher_number: cleanVoucher || null,
            notes: cleanNotes || null,
            created_by: user?.id ?? null,
          });
        } catch (bankErr) {
          console.warn("Aviso: no se pudo sincronizar movimiento bancario secundario:", bankErr);
        }
      }

      toast.success(
        mode === "income"
          ? "Ingreso a Caja Fuerte registrado correctamente"
          : "Egreso de Caja Fuerte registrado correctamente"
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error al registrar movimiento en Caja General:", err);
      toast.error("Error al registrar el movimiento en Caja General");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Encabezado Principal */}
        <header className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "p-2 rounded-xl border shrink-0 transition-colors",
                mode === "income"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80"
              )}
            >
              <Vault className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Caja Fuerte Central
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {mode === "income" ? "Registrar Ingreso de Efectivo" : "Retiro / Egreso de Efectivo"}
              </h3>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </header>

        {/* Pestañas de Alternancia Rápida (F2) */}
        <div className="shrink-0 px-5 pt-3 pb-1">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => handleModeToggle("income")}
              className={cn(
                "h-8 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                mode === "income"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>+ Registrar Ingreso</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                F2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle("expense")}
              className={cn(
                "h-8 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                mode === "expense"
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>- Retiro / Egreso</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                F2
              </kbd>
            </button>
          </div>
        </div>

        {/* Dual KPI Header: Saldo en Caja Fuerte vs Importe Asignado */}
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-2 shrink-0">
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Saldo Caja Fuerte
              </span>
              <Vault className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate mt-0.5">
              {formatMoney(currentBalance)}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-2.5 transition-colors",
              isOverBalance
                ? "border-amber-300 dark:border-amber-700/80 bg-amber-50/60 dark:bg-amber-950/30"
                : isAssigned
                ? mode === "income"
                  ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "border-rose-300 dark:border-rose-700/80 bg-rose-50/60 dark:bg-rose-950/30"
                : "border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {mode === "income" ? "Importe Ingreso" : "Importe Egreso"}
              </span>
              {isOverBalance && <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
            </div>
            <p
              className={cn(
                "text-sm sm:text-base font-bold tabular-nums truncate mt-0.5",
                isOverBalance
                  ? "text-amber-600 dark:text-amber-400"
                  : isAssigned
                  ? mode === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {isAssigned
                ? mode === "income"
                  ? `+ ${formatMoney(numericAmount)}`
                  : `- ${formatMoney(numericAmount)}`
                : "$ 0,00"}
            </p>
          </div>
        </div>

        {/* Notificación si supera saldo */}
        {isOverBalance && (
          <div className="mx-5 mt-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Aviso: El egreso ({formatMoney(numericAmount)}) supera el saldo disponible en caja fuerte.
            </span>
          </div>
        )}

        {/* Formulario y Contenido Desplazable */}
        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3"
        >
          {/* Encabezado de columnas: Origen/Destino vs Importe Asignado ($) */}
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            <span>{mode === "income" ? "Origen / Concepto" : "Destino del Dinero"}</span>
            <span>Importe Asignado ($)</span>
          </div>

          {/* Lista Unificada e Inteligente de Opciones (Idéntica al checkout POS) */}
          <div className="space-y-1.5">
            {options.map((option, index) => {
              const isHighlighted = selectedOptionId === option.id;
              const rawAmount = amountInputs[option.id] ?? "";
              const hasAmount = Boolean(rawAmount && parseFloat(rawAmount.replace(",", ".")) > 0);
              const isConfirmed = Boolean(lockedOptionIds[option.id] && hasAmount);
              const Icon = option.icon;

              return (
                <div
                  key={option.id}
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    "group flex items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border transition-all cursor-pointer",
                    isConfirmed
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/60 shadow-xs"
                      : isHighlighted
                      ? "border-amber-400 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-500/20 ring-2 ring-amber-400 dark:ring-amber-400/90 shadow-sm"
                      : hasAmount
                      ? "border-slate-300 dark:border-slate-600 bg-slate-100/70 dark:bg-slate-800/80 hover:border-slate-400"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  )}
                >
                  {/* Lado izquierdo: Icono y Nombre */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isConfirmed
                          ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs"
                          : isHighlighted
                          ? "bg-amber-400 dark:bg-amber-400 text-slate-950 font-black shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <Icon size={14} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "font-bold text-xs truncate",
                            isConfirmed
                              ? "text-slate-900 dark:text-white"
                              : isHighlighted
                              ? "text-slate-950 dark:text-amber-100"
                              : "text-slate-800 dark:text-slate-200"
                          )}
                        >
                          {option.name}
                        </span>
                        {isConfirmed && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check size={8} strokeWidth={3} />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/90 px-1 py-0 rounded border border-emerald-300 dark:border-emerald-700">
                              Confirmado
                            </span>
                          </div>
                        )}
                      </div>
                      {option.subtitle && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                          {option.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lado derecho: Input de Importe ($) y Botones */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative w-28 sm:w-32">
                      <span
                        className={cn(
                          "absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-black pointer-events-none transition",
                          isConfirmed
                            ? "text-emerald-700 dark:text-emerald-300"
                            : isHighlighted
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        $
                      </span>
                      <input
                        ref={(el) => {
                          inputRefs.current[option.id] = el;
                        }}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={amountInputs[option.id] ?? ""}
                        onChange={(e) => handleAmountChange(option.id, e.target.value)}
                        onFocus={(e) => {
                          e.target.select();
                          setSelectedOptionId(option.id);
                          if (!concept) setConcept(option.defaultConcept);
                        }}
                        onClick={(e) => {
                          (e.target as HTMLInputElement).select();
                        }}
                        onKeyDown={(e) => handleKeyDownOnOption(e, index, option)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        disabled={isSubmitting || !canWrite}
                        className={cn(
                          "w-full rounded-lg border py-1 pl-5 pr-2 text-right font-mono text-xs outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          isConfirmed
                            ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 font-black ring-2 ring-emerald-500/50 shadow-xs"
                            : isHighlighted
                            ? "border-amber-400 dark:border-amber-400 bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-100 font-bold ring-2 ring-amber-400/60 shadow-xs"
                            : hasAmount
                            ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                            : "border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-amber-400"
                        )}
                      />
                    </div>

                    {/* Botón OK para confirmar monto */}
                    {!isConfirmed && hasAmount && isHighlighted && (
                      <button
                        type="button"
                        onClick={() => handleConfirmOption(option)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-300 text-slate-950 font-bold text-[11px] shadow-xs transition cursor-pointer"
                        title="Confirmar monto asignado (Enter)"
                      >
                        <Check size={11} strokeWidth={3} />
                        <span>OK</span>
                      </button>
                    )}

                    {/* Botón Limpiar Monto */}
                    {hasAmount && (
                      <button
                        type="button"
                        onClick={() => handleClearOption(option.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="Limpiar monto"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subpanel Contextual: N° de Comprobante / Transferencia si se eligió un banco */}
          {activeOption?.bankAccountId && (
            <div className="p-3 rounded-xl border border-blue-200/90 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  N° de Comprobante / Referencia de transferencia{" "}
                  <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  Sincronización Bancaria Automática
                </span>
              </div>
              <input
                ref={voucherRef}
                type="text"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                onKeyDown={handleKeyDownOnVoucher}
                placeholder="Ej: Transf. 984321 / Código de operación..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                disabled={isSubmitting || !canWrite}
                className="h-8.5 w-full px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
              />
            </div>
          )}

          {/* Concepto / Motivo con Chips Rápidos */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Concepto / Motivo *
              </label>
              <span className="text-[10px] text-slate-400">Atajo: Enter avanza a notas</span>
            </div>

            {/* Chips de sugerencias rápidas */}
            <div className="flex flex-wrap gap-1.5">
              {(mode === "income"
                ? [
                    "Aporte de capital a caja fuerte",
                    "Recaudación por cierre de caja diaria",
                    "Ajuste positivo de arqueo",
                    "Aporte de socios",
                  ]
                : [
                    "Depósito en cuenta bancaria",
                    "Fondo inicial apertura caja diaria",
                    "Pago a proveedor en efectivo",
                    "Retiro de socios / Ganancias",
                    "Gasto operativo / Servicios",
                  ]
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setConcept(chip)}
                  className={cn(
                    "text-[10.5px] px-2 py-0.5 rounded-lg border font-medium transition-colors cursor-pointer",
                    concept === chip
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs"
                      : "bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>

            <input
              ref={conceptRef}
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={handleKeyDownOnConcept}
              placeholder="Ej: Depósito en cuenta Banco Galicia"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              disabled={isSubmitting || !canWrite}
              className="h-8.5 w-full px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-colors"
            />
          </div>

          {/* Observaciones / Comprobante adicionales */}
          <div className="space-y-1 shrink-0">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Observaciones adicionales{" "}
              <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
            </label>
            <textarea
              ref={notesRef}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDownOnNotes}
              placeholder="Detalles adicionales... (Presioná Enter para guardar)"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              disabled={isSubmitting || !canWrite}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-colors resize-none"
            />
          </div>
        </form>

        {/* Footer de Acciones Moderno y Accesible */}
        <footer className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar (Esc)
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !isAssigned || !canWrite}
            className={cn(
              "px-5 py-2 text-xs font-bold text-white rounded-xl transition-all disabled:opacity-50 shadow-xs flex items-center gap-2 cursor-pointer",
              mode === "income"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
            )}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                {mode === "income" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                <span>
                  {mode === "income"
                    ? `Registrar Ingreso ${isAssigned ? `(${formatMoney(numericAmount)})` : ""}`
                    : `Registrar Egreso ${isAssigned ? `(${formatMoney(numericAmount)})` : ""}`}
                </span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
