import React, { useState, useEffect } from "react";
import { JirehLogo } from "./brand/JirehLogo";
import { POS_LOGIN_URL } from "../config/app-urls";
import { Sparkles, Menu, X, LogIn } from "lucide-react";

interface LandingNavbarProps {
  onOpenFreeTrial: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenFreeTrial }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <a href="#" className="flex items-center gap-2 group">
            <JirehLogo size="md" showTagline={false} />
          </a>

          {/* Menú Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-slate-600 hover:text-sky-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Botones de acción derecha */}
          <div className="hidden md:flex items-center space-x-3.5">
            <a
              href={POS_LOGIN_URL}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:text-sky-700 hover:bg-slate-50 rounded-xl transition"
            >
              <LogIn className="h-4 w-4 text-sky-600" />
              <span>Iniciar Sesión</span>
            </a>

            <button
              onClick={onOpenFreeTrial}
              className="relative group overflow-hidden rounded-xl p-[2px] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 shadow-sm"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800] transition-all duration-300 group-hover:scale-105" />
              <span className="relative flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-all duration-300 group-hover:bg-opacity-95">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <span>Prueba 7 Días Gratis</span>
              </span>
            </button>
          </div>

          {/* Botón hamburguesa móvil */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-4 duration-200">
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
            <a
              href={POS_LOGIN_URL}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <LogIn className="h-4 w-4 text-sky-600" />
              <span>Iniciar Sesión en el POS</span>
            </a>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenFreeTrial();
              }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] text-sm font-bold text-white shadow-md"
            >
              <Sparkles className="h-4 w-4 text-amber-200" />
              <span>Activar 7 Días Gratis</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
