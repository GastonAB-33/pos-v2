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
    <section className="ui-summary-grid md:grid-cols-3 xl:grid-cols-6">
      <article className="ui-summary-card">
        <p className="ui-summary-label">Ventas filtradas</p>
        <p className="ui-kpi">{currency.format(salesTotal)}</p>
      </article>
      <article className="ui-summary-card">
        <p className="ui-summary-label">Transacciones</p>
        <p className="ui-kpi">{number.format(salesCount)}</p>
      </article>
      <article className="ui-summary-card">
        <p className="ui-summary-label">Compras filtradas</p>
        <p className="ui-kpi">{currency.format(purchasesTotal)}</p>
      </article>
      <article className="ui-summary-card">
        <p className="ui-summary-label">Deuda clientes</p>
        <p className="ui-kpi">{currency.format(debtorsTotal)}</p>
      </article>
      <article className="ui-summary-card">
        <p className="ui-summary-label">Neto caja</p>
        <p className="ui-kpi">{currency.format(cashNet)}</p>
      </article>
      <article className="ui-summary-card">
        <p className="ui-summary-label">Stock critico</p>
        <p className="ui-kpi">{number.format(stockCriticalCount)}</p>
      </article>
    </section>
  );
};
