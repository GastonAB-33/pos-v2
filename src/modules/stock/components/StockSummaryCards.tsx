interface StockSummaryCardsProps {
  activeProducts: number;
  lowStock: number;
  noStock: number;
  overMax: number;
}

export const StockSummaryCards = ({
  activeProducts,
  lowStock,
  noStock,
  overMax,
}: StockSummaryCardsProps) => {
  return (
    <div className="ui-summary-grid">
      <article className="ui-summary-card">
        <p className="ui-summary-label">Productos activos</p>
        <p className="ui-kpi">{activeProducts}</p>
      </article>

      <article className="ui-summary-card border-amber-300/50 bg-amber-500/10">
        <p className="ui-summary-label text-amber-300">Stock bajo minimo</p>
        <p className="ui-kpi text-amber-200">{lowStock}</p>
      </article>

      <article className="ui-summary-card border-red-300/50 bg-red-500/10">
        <p className="ui-summary-label text-red-300">Sin stock</p>
        <p className="ui-kpi text-red-200">{noStock}</p>
      </article>

      <article className="ui-summary-card border-sky-300/50 bg-sky-500/10">
        <p className="ui-summary-label text-sky-300">Sobre maximo</p>
        <p className="ui-kpi text-sky-200">{overMax}</p>
      </article>
    </div>
  );
};
