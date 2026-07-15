import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

type IconButtonTone = "default" | "primary" | "danger";
type IconButtonSize = "sm" | "md";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  tone?: IconButtonTone;
  size?: IconButtonSize;
}

export const IconButton = ({
  icon: Icon,
  label,
  loading = false,
  tone = "default",
  size = "md",
  className,
  disabled,
  ...props
}: IconButtonProps) => {
  const Glyph = loading ? LoaderCircle : Icon;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "ui-icon-button",
        `ui-icon-button--${tone}`,
        `ui-icon-button--${size}`,
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      <Glyph aria-hidden="true" className={cn("h-4 w-4", loading && "animate-spin")} />
    </button>
  );
};
