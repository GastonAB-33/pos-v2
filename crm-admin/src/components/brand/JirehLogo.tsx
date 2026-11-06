import React from "react";

interface JirehLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const JirehLogo: React.FC<JirehLogoProps> = ({
  className = "",
  size = "md",
}) => {
  const sizeConfig = {
    sm: { imgH: "h-7", text: "text-lg", badge: "text-[9px] px-1 py-0.5" },
    md: { imgH: "h-8", text: "text-xl", badge: "text-[10px] px-1.5 py-0.5" },
    lg: { imgH: "h-10", text: "text-2xl", badge: "text-xs px-2 py-0.5" },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <img
          src="/jireh-logo.png"
          alt="Jireh Logo"
          className={`${sizeConfig.imgH} w-auto object-contain`}
          loading="eager"
        />
      </div>

      <div className="flex items-center gap-1.5 leading-none">
        <span className={`font-black tracking-tight text-white ${sizeConfig.text}`}>
          Jireh
        </span>
        <span
          className={`rounded-md font-black uppercase tracking-wider text-white shadow-sm bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800] ${sizeConfig.badge}`}
        >
          CRM
        </span>
        <span className="rounded bg-sky-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-800 uppercase tracking-widest ml-1">
          SuperAdmin
        </span>
      </div>
    </div>
  );
};
