import { useState, type FC } from "react";
import { Package, X, Plus, Minus, Check } from "lucide-react";
import { COMMON_RETURNABLE_PACKAGES } from "@/utils/returnable-packages";

interface Props {
  isOpen: boolean;
  customerName: string;
  onClose: () => void;
  onSubmit: (packageName: string, quantity: number) => Promise<boolean | void>;
}

export const ManualPackageLoanModal: FC<Props> = ({
  isOpen,
  customerName,
  onClose,
  onSubmit,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string>(COMMON_RETURNABLE_PACKAGES[0]?.name || "Garrafa 10kg");
  const [isCustom, setIsCustom] = useState(false);
  const [customPackageName, setCustomPackageName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const finalPackageName = isCustom ? customPackageName.trim() : selectedPackage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPackageName || quantity <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await onSubmit(finalPackageName, quantity);
      if (res !== false) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Anotar Préstamo de Envase
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cliente: <span className="font-semibold text-slate-800 dark:text-slate-200">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* SELECTOR DE ENVASE */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Tipo de envase a prestar <span className="text-red-500">*</span>
            </label>

            {/* PRESETS RÁPIDOS */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-40 overflow-y-auto pr-1">
              {COMMON_RETURNABLE_PACKAGES.map((pkg) => {
                const active = !isCustom && selectedPackage === pkg.name;
                return (
                  <button
                    key={pkg.name}
                    type="button"
                    onClick={() => {
                      setSelectedPackage(pkg.name);
                      setIsCustom(false);
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                      active
                        ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200 font-bold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    {pkg.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                  isCustom
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200 font-bold"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                }`}
              >
                + Otro envase...
              </button>
            </div>

            {/* INPUT DE OTRO ENVASE */}
            {isCustom ? (
              <div className="mt-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Bidón 5L, Cajón de gaseosa, etc."
                  value={customPackageName}
                  onChange={(e) => setCustomPackageName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500"
                  required
                />
              </div>
            ) : null}
          </div>

          {/* SELECTOR DE CANTIDAD */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Cantidad de unidades adeudadas
            </label>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-l-lg"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-12 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-r-lg"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {quantity === 1 ? "unidad física" : "unidades físicas"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            💡 No genera cobro en dinero ni mueve caja. Solo añade el envase al control de stock pendiente del cliente hasta que lo devuelva.
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="ui-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !finalPackageName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Guardando..." : "Asentar Préstamo"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
