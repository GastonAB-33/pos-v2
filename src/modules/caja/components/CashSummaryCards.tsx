interface CashSummaryCardsProps {
  openingAmount: number;
  incomes: number;
  expenses: number;
  expectedBalance: number;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashSummaryCards = ({
  openingAmount,
  incomes,
  expenses,
  expectedBalance,
}: CashSummaryCardsProps) => {
  return (
    <div className="ui-summary-grid">
      <article className="ui-summary-card">
        <p className="ui-summary-label">Monto inicial</p>
        <p className="ui-kpi">{currency.format(openingAmount)}</p>
      </article>

      <article className="ui-summary-card border-emerald-300/50 bg-emerald-500/10">
        <p className="ui-summary-label text-emerald-300">Ingresos</p>
        <p className="ui-kpi text-emerald-200">{currency.format(incomes)}</p>
      </article>

      <article className="ui-summary-card border-rose-300/50 bg-rose-500/10">
        <p className="ui-summary-label text-rose-300">Egresos</p>
        <p className="ui-kpi text-rose-200">{currency.format(expenses)}</p>
      </article>

      <article className="ui-summary-card border-sky-300/50 bg-sky-500/10">
        <p className="ui-summary-label text-sky-300">Saldo esperado</p>
        <p className="ui-kpi text-sky-200">{currency.format(expectedBalance)}</p>
      </article>
    </div>
  );
};
