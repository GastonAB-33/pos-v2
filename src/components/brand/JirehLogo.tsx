import React from "react";

interface JirehLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  variant?: "light" | "dark" | "default";
}

export const JirehLogo: React.FC<JirehLogoProps> = ({
  className = "",
  size = "md",
  showTagline = false,
  variant = "default",
}) => {
  const sizeConfig = {
    sm: { imgH: "h-7", text: "text-lg", badge: "text-[9px] px-1 py-0.5", tag: "text-[10px]" },
    md: { imgH: "h-9", text: "text-2xl", badge: "text-[10px] px-1.5 py-0.5", tag: "text-xs" },
    lg: { imgH: "h-12", text: "text-3xl", badge: "text-xs px-2 py-0.5", tag: "text-sm" },
    xl: { imgH: "h-16", text: "text-4xl", badge: "text-sm px-2.5 py-1", tag: "text-base" },
  }[size];

  const isLight = variant === "light";

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Isotipo oficial Jireh con los 3 colores: Turquesa (#00B5C8), Verde Lima (#7CE01E) y Naranja (#FF7800) */}
      <div
        className={`relative flex items-center justify-center shrink-0 ${
          isLight ? "bg-white rounded-xl p-1 shadow-sm" : ""
        }`}
      >
        <img
          src="/jireh-logo.jpg"
          alt="Jireh Logo"
          className={`${sizeConfig.imgH} w-auto object-contain transition-transform duration-300 hover:scale-105 ${
            !isLight ? "mix-blend-multiply" : ""
          }`}
          loading="eager"
        />
      </div>

      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black tracking-tight ${sizeConfig.text} ${
              isLight ? "text-white" : "text-slate-900"
            }`}
          >
            Jireh
          </span>
          <span
            className={`rounded-md font-black uppercase tracking-wider text-slate-950 shadow-sm bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800] text-white ${sizeConfig.badge}`}
          >
            POS
          </span>
        </div>
        {showTagline && (
          <span
            className={`mt-0.5 font-semibold ${sizeConfig.tag} ${
              isLight ? "text-slate-300" : "text-slate-500"
            }`}
          >
            Punto de Venta & Gestión Cloud
          </span>
        )}
      </div>
    </div>
  );
};
