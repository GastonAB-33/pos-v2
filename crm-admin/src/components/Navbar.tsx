import React from "react";
import { JirehLogo } from "./brand/JirehLogo";
import { LayoutDashboard, Users, Store, CreditCard, ShieldCheck, Lock } from "lucide-react";

export type NavTab = "dashboard" | "crm" | "tenants" | "billing";

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  expiringCount: number;
  newLeadsCount?: number;
  onLock?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  expiringCount,
  newLeadsCount = 0,
  onLock,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
        
        {/* Marca SuperAdmin */}
        <div className="flex items-center gap-4">
          <JirehLogo size="md" />
        </div>

        {/* Pestañas de Navegación */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onSelectTab("dashboard")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              currentTab === "dashboard"
                ? "bg-[#00B5C8] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("crm")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition relative ${
              currentTab === "crm"
                ? "bg-[#00B5C8] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Pipeline CRM</span>
            {newLeadsCount > 0 && (
              <span className="flex items-center justify-center px-1.5 py-0.5 rounded-full bg-emerald-500 text-[10px] text-white font-extrabold animate-pulse">
                {newLeadsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("tenants")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition relative ${
              currentTab === "tenants"
                ? "bg-[#00B5C8] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Store className="h-4 w-4" />
            <span>Comercios</span>
            {expiringCount > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Hay comercios por vencer" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("billing")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              currentTab === "billing"
                ? "bg-[#00B5C8] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Cobranzas</span>
          </button>
        </nav>

        {/* Perfil SuperAdmin */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold">Modo Maestro Activo</span>
          </div>
          {onLock && (
            <button
              onClick={onLock}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs font-semibold transition"
              title="Bloquear acceso al CRM"
            >
              <Lock className="h-3 w-3" />
              <span>Bloquear</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
