import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

type ModalCloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
};

export const ModalCloseButton = ({ label = "Cerrar", ...props }: ModalCloseButtonProps) => (
  <IconButton icon={X} label={label} {...props} />
);
