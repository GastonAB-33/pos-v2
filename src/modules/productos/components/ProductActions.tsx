import { Barcode, Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface ProductActionsProps {
  canWrite: boolean;
  canDelete: boolean;
  onBarcode: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ProductActions = ({
  canWrite,
  canDelete,
  onBarcode,
  onEdit,
  onDelete,
}: ProductActionsProps) => (
  <div className="flex items-center gap-2">
    <IconButton size="sm" icon={Barcode} label="Generar código de barras" onClick={onBarcode} />
    <IconButton size="sm" icon={Pencil} label="Editar producto" onClick={onEdit} disabled={!canWrite} />
    <IconButton
      size="sm"
      icon={Trash2}
      label="Eliminar producto"
      tone="danger"
      onClick={onDelete}
      disabled={!canWrite || !canDelete}
    />
  </div>
);
