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
    <div className="flex flex-wrap items-center gap-2">
      <span className="ui-badge ui-badge--success">Activos: {activeProducts}</span>
      <span className="ui-badge ui-badge--warn">Bajo minimo: {lowStock}</span>
      <span className="ui-badge ui-badge--danger">Sin stock: {noStock}</span>
      <span className="ui-badge ui-badge--info">Sobre maximo: {overMax}</span>
    </div>
  );
};
