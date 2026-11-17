interface ReportsSummaryCardsProps {
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  debtorsTotal: number;
  cashNet: number;
  stockCriticalCount: number;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("es-AR");

export const ReportsSummaryCards = ({
  salesTotal,
  salesCount,
  purchasesTotal,
  debtorsTotal,
  cashNet,
  stockCriticalCount,
}: ReportsSummaryCardsProps) => {
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Ventas filtradas
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          {currency.format(salesTotal)}
        </p>
      </article>

      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Transacciones
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          {number.format(salesCount)}
        </p>
      </article>

      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Compras filtradas
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          {currency.format(purchasesTotal)}
        </p>
      </article>

      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Deuda clientes
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
          {currency.format(debtorsTotal)}
        </p>
      </article>

      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Neto caja
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          {currency.format(cashNet)}
        </p>
      </article>

      <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Stock crítico
        </p>
        <p className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
          {number.format(stockCriticalCount)}
        </p>
      </article>
    </section>
  );
};