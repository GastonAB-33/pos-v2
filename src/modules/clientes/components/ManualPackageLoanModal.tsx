import { useState, useEffect, type FC } from "react";
import { Package, X, Plus, Minus, Check, AlertCircle } from "lucide-react";
import type { ReturnablePackageType } from "@/types/entities";

interface Props {
  isOpen: boolean;
  customerName: string;
  configuredPackages?: ReturnablePackageType[];
  onClose: () => void;
  onSubmit: (packageName: string, quantity: number) => Promise<boolean | void>;
}

export const ManualPackageLoanModal: FC<Props> = ({
  isOpen,
  customerName,
  configuredPackages = [],
  onClose,
  onSubmit,
}) => {
  const hasConfigured = configuredPackages.length > 0;
  const [selectedPackage, setSelectedPackage] = useState<string>(
    hasConfigured ? configuredPackages[0].name : ""
  );
  const [isCustom, setIsCustom] = useState(!hasConfigured);
  const [customPackageName, setCustomPackageName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configuredPackages.length > 0) {
      setSelectedPackage(configuredPackages[0].name);
      setIsCustom(false);
    } else {
      setSelectedPackage("");
      setIsCustom(true);
    }
    setCustomPackageName("");
    setQuantity(1);
  }, [configuredPackages, isOpen]);

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

            {hasConfigured ? (
              /* PRESETS CONFIGURADOS POR EL COMERCIO */
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-40 overflow-y-auto pr-1">
                {configuredPackages.map((pkg) => {
                  const active = !isCustom && selectedPackage === pkg.name;
                  return (
                    <button
                      key={pkg.name}
                      type="button"
                      onClick={() => {
                        setSelectedPackage(pkg.name);
                        setIsCustom(false);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                        active
                          ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200 font-bold ring-1 ring-amber-500/50"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <div className="truncate">{pkg.name}</div>
                      {pkg.suggestedPrice ? (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          $${pkg.suggestedPrice.toLocaleString("es-AR")}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                    isCustom
                      ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200 font-bold ring-1 ring-amber-500/50"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                  }`}
                >
                  + Otro envase...
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Sin envases predefinidos</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Escribe el nombre del envase a continuación. Puedes registrar tus envases habituales en <strong>Configuración &gt; Stock</strong> o activándolos en tus productos.
                </p>
              </div>
            )}

            {/* INPUT DE OTRO ENVASE O ENVASE LIBRE */}
            {isCustom ? (
              <div className="mt-2.5">
                <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {hasConfigured ? "Nombre del otro envase:" : "Nombre del envase:"}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Envase de Coca, Garrafa 10kg, Bidón 20L..."
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
