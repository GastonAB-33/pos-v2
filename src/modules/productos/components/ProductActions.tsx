import type { ReactNode } from "react";

interface ProductActionsProps {
  canWrite: boolean;
  canDelete: boolean;
  onBarcode: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ActionButton = ({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[var(--ui-accent)] hover:text-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-45"
  >
    {children}
  </button>
);

export const ProductActions = ({
  canWrite,
  canDelete,
  onBarcode,
  onEdit,
  onDelete,
}: ProductActionsProps) => {
  return (
    <div className="flex items-center gap-2">
      <ActionButton title="Generar codigo de barras" onClick={onBarcode}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 5v14" />
          <path d="M7 5v14" />
          <path d="M10 5v14" />
          <path d="M14 5v14" />
          <path d="M17 5v14" />
          <path d="M21 5v14" />
        </svg>
      </ActionButton>

      <ActionButton title="Editar producto" onClick={onEdit} disabled={!canWrite}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20h4l10-10-4-4L4 16v4z" />
          <path d="M12 6l4 4" />
        </svg>
      </ActionButton>

      <ActionButton title="Eliminar producto" onClick={onDelete} disabled={!canWrite || !canDelete}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M7 7l1 12h8l1-12" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </ActionButton>
    </div>
  );
};
