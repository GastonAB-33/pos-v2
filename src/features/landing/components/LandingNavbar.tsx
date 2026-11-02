import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { JirehLogo } from "@/components/brand/JirehLogo";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Sparkles, Menu, X, LogIn, LayoutDashboard } from "lucide-react";

interface LandingNavbarProps {
  onOpenFreeTrial: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenFreeTrial }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenantId = useAuthStore((state) => state.tenantId);
  const hasValidSession = Boolean(isAuthenticated && user?.isActive && tenantId);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Ventajas", href: "#ventajas" },
    { label: "Herramientas", href: "#herramientas" },
    { label: "Calculadora", href: "#calculadora" },
    { label: "Planes", href: "#planes" },
    { label: "Testimonios", href: "#testimonios" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo Jireh */}
          <Link to="/" className="flex items-center gap-2 group">
            <JirehLogo size="md" showTagline={false} />
          </Link>

          {/* Links desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-slate-600 hover:text-sky-700 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {hasValidSession ? (
              <Link
                to={routePaths.menuPrincipal}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition"
              >
                <LayoutDashboard className="h-4 w-4 text-sky-600" />
                <span>Ir a mi Panel</span>
              </Link>
            ) : (
              <Link
                to={routePaths.login}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-700 hover:text-sky-700 hover:bg-slate-100 rounded-xl transition"
              >
                <LogIn className="h-4 w-4 text-sky-600" />
                <span>Iniciar Sesión</span>
              </Link>
            )}

            <button
              onClick={onOpenFreeTrial}
              className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-500/20 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-4 w-4 text-amber-200 group-hover:rotate-12 transition-transform" />
              <span>Prueba 15 Días Gratis</span>
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Menú móvil"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-sky-700 rounded-lg"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2.5">
            {hasValidSession ? (
              <Link
                to={routePaths.menuPrincipal}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sm font-bold text-sky-800"
              >
                <LayoutDashboard className="h-4 w-4 text-sky-600" />
                <span>Ir a mi Panel</span>
              </Link>
            ) : (
              <Link
                to={routePaths.login}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4 text-sky-600" />
                <span>Iniciar Sesión en el POS</span>
              </Link>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenFreeTrial();
              }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] text-sm font-bold text-white shadow-md"
            >
              <Sparkles className="h-4 w-4 text-amber-200" />
              <span>Activar 15 Días Gratis</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
