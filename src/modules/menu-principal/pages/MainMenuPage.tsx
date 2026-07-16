import { Boxes, CircleDollarSign, PackageSearch, ShoppingCart, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { routePaths } from "@/config/routes";

const quickActions = [
  { label: "Nueva venta", detail: "Abrir terminal POS", to: routePaths.pos, icon: ShoppingCart },
  { label: "Productos", detail: "Catalogo e inventario", to: routePaths.productos, icon: PackageSearch },
  { label: "Caja diaria", detail: "Movimientos y cierre", to: routePaths.caja, icon: Wallet },
  { label: "Clientes", detail: "Datos y cuenta corriente", to: routePaths.clientes, icon: Users },
  { label: "Stock", detail: "Existencias y ajustes", to: routePaths.stock, icon: Boxes },
  { label: "Cuentas corrientes", detail: "Deudas y cobranzas", to: routePaths.cuentasCorrientes, icon: CircleDollarSign },
] as const;

export const MainMenuPage = () => {
  const navigate = useNavigate();

  return (
    <PagePlaceholder title="Inicio operativo" description="Accesos principales y novedades del comercio">
      <div className="operational-home-grid">
        <section className="operational-home-main">
          <div className="operational-section-heading">
            <div>
              <p className="ui-section-label">Accesos rapidos</p>
              <h2 className="text-base font-semibold text-slate-900">Operaciones frecuentes</h2>
            </div>
          </div>

          <div className="operational-quick-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.to}
                  type="button"
                  className="operational-quick-action"
                  onClick={() => navigate(action.to)}
                >
                  <span className="operational-quick-action__icon"><Icon aria-hidden="true" size={19} /></span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                    <span className="block truncate text-xs text-slate-500">{action.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="operational-home-aside">
          <div className="operational-section-heading">
            <div>
              <p className="ui-section-label">Comunicaciones</p>
              <h2 className="text-base font-semibold text-slate-900">Novedades</h2>
            </div>
            <span className="ui-badge ui-badge--info">Sistema</span>
          </div>
          <div className="ui-empty-state">
            <p className="font-semibold text-slate-900">Todo al dia</p>
            <p className="mt-1 text-xs text-slate-500">No hay comunicados nuevos para tu comercio.</p>
          </div>
        </aside>
      </div>
    </PagePlaceholder>
  );
};
