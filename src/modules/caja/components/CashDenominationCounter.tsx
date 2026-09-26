import React, { useMemo } from "react";
import { Coins, Banknote, RotateCcw, Plus, Minus } from "lucide-react";

export interface DenominationItem {
  value: number;
  label: string;
  type: "bill" | "coin";
}

export const ARS_DENOMINATIONS: DenominationItem[] = [
  { value: 20000, label: "$20.000", type: "bill" },
  { value: 10000, label: "$10.000", type: "bill" },
  { value: 2000, label: "$2.000", type: "bill" },
  { value: 1000, label: "$1.000", type: "bill" },
  { value: 500, label: "$500", type: "bill" },
  { value: 200, label: "$200", type: "bill" },
  { value: 100, label: "$100", type: "bill" },
  { value: 50, label: "$50", type: "bill" },
];

interface CashDenominationCounterProps {
  denominations: Record<string, number>;
  coinsAmount: number;
  onChange: (denominations: Record<string, number>, coinsAmount: number, total: number) => void;
  disabled?: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export const CashDenominationCounter: React.FC<CashDenominationCounterProps> = ({
  denominations,
  coinsAmount,
  onChange,
  disabled = false,
}) => {
  const total = useMemo(() => {
    let sum = coinsAmount || 0;
    for (const item of ARS_DENOMINATIONS) {
      const count = denominations[item.value] || 0;
      sum += count * item.value;
    }
    return sum;
  }, [denominations, coinsAmount]);

  const handleCountChange = (value: number, newCount: number) => {
    const validCount = Math.max(0, Math.floor(newCount || 0));
    const nextDenoms: Record<string, number> = {
      ...denominations,
      [value]: validCount,
    };
    let sum = coinsAmount || 0;
    for (const item of ARS_DENOMINATIONS) {
      const count = nextDenoms[item.value] || 0;
      sum += count * item.value;
    }
    onChange(nextDenoms, coinsAmount, sum);
  };

  const handleCoinsChange = (newCoins: number) => {
    const validCoins = Math.max(0, newCoins || 0);
    let sum = validCoins;
    for (const item of ARS_DENOMINATIONS) {
      const count = denominations[item.value] || 0;
      sum += count * item.value;
    }
    onChange(denominations, validCoins, sum);
  };

  const handleReset = () => {
    const emptyDenoms: Record<string, number> = {};
    ARS_DENOMINATIONS.forEach((d) => {
      emptyDenoms[d.value] = 0;
    });
    onChange(emptyDenoms, 0, 0);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Desglose de Billetes y Monedas
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled || total === 0}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 disabled:opacity-40 transition-colors"
          title="Reiniciar conteo a cero"
        >
          <RotateCcw className="h-3 w-3" /> Limpiar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ARS_DENOMINATIONS.map((item) => {
          const count = denominations[item.value] || 0;
          const subtotal = count * item.value;

          return (
            <div
              key={item.value}
              className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-all ${
                count > 0
                  ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {item.label}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {subtotal > 0 ? currency.format(subtotal) : "$0"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || count <= 0}
                  onClick={() => handleCountChange(item.value, count - 1)}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  aria-label={`Restar billete de ${item.label}`}
                >
                  <Minus className="h-3 w-3" />
                </button>

                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={count === 0 ? "" : count}
                  placeholder="0"
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                    handleCountChange(item.value, isNaN(val) ? 0 : val);
                  }}
                  className="h-7 w-12 rounded-md border border-slate-200 text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleCountChange(item.value, count + 1)}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  aria-label={`Sumar billete de ${item.label}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monedas y cambio suelto */}
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-500" />
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Monedas y cambio suelto
            </span>
            <p className="text-[10px] text-slate-400">Total en monedas acumuladas</p>
          </div>
        </div>
        <div className="w-28">
          <input
            type="number"
            min="0"
            step="1"
            disabled={disabled}
            value={coinsAmount === 0 ? "" : coinsAmount}
            placeholder="$ 0"
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
              handleCoinsChange(isNaN(val) ? 0 : val);
            }}
            className="w-full h-8 px-2 text-right rounded-md border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Total Efectivo Arqueado */}
      <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-950 dark:text-emerald-200">
        <span className="text-xs font-semibold">Total Efectivo Contado:</span>
        <span className="text-sm font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
          {currency.format(total)}
        </span>
      </div>
    </div>
  );
};
