import { RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface PaymentMethodsToolbarProps {
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onReload: () => void;
}

export const PaymentMethodsToolbar = ({
  loading,
  search,
  onSearchChange,
  onReload,
}: PaymentMethodsToolbarProps) => {
  return (
    <div className="workspace-toolbar workspace-toolbar--inline">
      <div className="grid gap-1">
        <p className="ui-section-label">Cobros</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Medios de pago</h2>
      </div>

      <div className="workspace-toolbar__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, codigo o tipo"
          className="ui-input w-72"
        />
        <IconButton icon={RefreshCw} label="Recargar medios de pago" onClick={onReload} loading={loading} />
      </div>
    </div>
  );
};
