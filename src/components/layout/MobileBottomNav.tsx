import { Package, ShoppingCart, Store, Users, Wallet } from "lucide-react";
import { NavLink } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import type { AppModule } from "@/types/modules";
import { cn } from "@/utils/cn";

interface MobileNavigationItem {
  label: string;
  to: string;
  module: AppModule;
  icon: typeof Store;
}

const navigationItems: MobileNavigationItem[] = [
  { label: "Inicio", to: routePaths.menuPrincipal, module: "dashboard", icon: Store },
  { label: "Ventas", to: routePaths.pos, module: "pos", icon: ShoppingCart },
  { label: "Productos", to: routePaths.productos, module: "productos", icon: Package },
  { label: "Caja", to: routePaths.caja, module: "caja", icon: Wallet },
  { label: "Clientes", to: routePaths.clientes, module: "clientes", icon: Users },
];

export const MobileBottomNav = () => {
  const { canRead } = usePermissions();
  const visibleItems = navigationItems.filter((item) => canRead(item.module));

  if (visibleItems.length === 0) return null;

  return (
    <nav className="app-mobile-nav" aria-label="Navegacion principal">
      {visibleItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn("app-mobile-nav__item", isActive && "app-mobile-nav__item--active")}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
