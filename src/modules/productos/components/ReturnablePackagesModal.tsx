import { useState, type FC } from "react";
import { Package, X, Plus, Trash2, RefreshCw, AlertCircle, ShoppingBag } from "lucide-react";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useProductsStore } from "@/features/products/store/products.store";
import { useToast } from "@/components/ui/useToast";
import { settingsService } from "@/services/settings.service";
import {
  parseReturnableConfig,
  useTenantReturnablePackages,
  COMMON_RETURNABLE_PACKAGES,
} from "@/utils/returnable-packages";
import type { ReturnablePackageType } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  canWrite?: boolean;
}

export const ReturnablePackagesModal: FC<Props> = ({
  isOpen,
  onClose,
  canWrite = true,
}) => {
  const { tenantId } = useTenant();
  const toast = useToast();
  const { packages, reload, isLoading } = useTenantReturnablePackages(tenantId);
  const products = useProductsStore((state) => state.products);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Contar cuántos productos del catálogo tienen asignado cada envase
  const usageCountByPackage = new Map<string, number>();
  for (const p of products) {
    const config = parseReturnableConfig(p.description);
    if (config?.enabled && config.packageName) {
      const key = config.packageName.trim().toLowerCase();
      usageCountByPackage.set(key, (usageCountByPackage.get(key) ?? 0) + 1);
    }
  }

  const handleSaveList = async (updatedList: ReturnablePackageType[]) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      await settingsService.updateSection(tenantId, "stock", {
        returnable_packages: updatedList,
      });
      await reload();
    } catch {
      toast.error("Error al guardar la lista de envases retornables");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    if (packages.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`El envase "${trimmed}" ya está en la lista.`);
      return;
    }

    const price = typeof newPrice === "number" ? Math.max(0, newPrice) : 0;
    const updated = [...packages, { name: trimmed, suggestedPrice: price }];
    await handleSaveList(updated);
    setNewName("");
    setNewPrice("");
    toast.success(`Tipo de envase "${trimmed}" agregado`);
  };

  const handleRemovePackage = async (packageName: string) => {
    const usage = usageCountByPackage.get(packageName.toLowerCase()) ?? 0;
    if (usage > 0) {
      const confirmRemove = window.confirm(
        `El envase "${packageName}" está asignado a ${usage} producto(s) en tu catálogo. ¿Seguro que deseas eliminarlo de la lista configurada?`
      );
      if (!confirmRemove) return;
    }

    const updated = packages.filter((p) => p.name !== packageName);
    await handleSaveList(updated);
    toast.success(`Envase "${packageName}" eliminado`);
  };

  const handleDetectFromProducts = async () => {
    const currentList = [...packages];
    const existingNames = new Set(currentList.map((p) => p.name.toLowerCase()));
    let addedCount = 0;

    for (const p of products) {
      const config = parseReturnableConfig(p.description);
      if (config?.enabled && config.packageName?.trim()) {
        const lower = config.packageName.trim().toLowerCase();
        if (!existingNames.has(lower)) {
          existingNames.add(lower);
          currentList.push({
            name: config.packageName.trim(),
            suggestedPrice: config.packagePrice,
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      await handleSaveList(currentList);
      toast.success(`Se detectaron y agregaron ${addedCount} tipos de envases desde tus productos`);
    } else {
      toast.info("No se encontraron tipos de envases nuevos en los productos");
    }
  };

  const handleLoadCommon = async () => {
    const currentList = [...packages];
    const existingNames = new Set(currentList.map((p) => p.name.toLowerCase()));
    let addedCount = 0;

    for (const pkg of COMMON_RETURNABLE_PACKAGES) {
      if (!existingNames.has(pkg.name.toLowerCase())) {
        existingNames.add(pkg.name.toLowerCase());
        currentList.push(pkg);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await handleSaveList(currentList);
      toast.success(`Se agregaron ${addedCount} sugerencias habituales`);
    } else {
      toast.info("Las sugerencias habituales ya están en la lista");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tipos de Envases Retornables
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Envases disponibles para asignar a productos y prestar en Cuentas Corrientes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* FORMULARIO AGREGAR ENVASE */}
          {canWrite && (
            <form
              onSubmit={handleAddPackage}
              className="flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nuevo tipo de envase
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: ENVASE DE COCA, Bidón 20L..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="w-36">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Precio reposición
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewPrice(v === "" ? "" : Number(v));
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || !newName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar</span>
              </button>
            </form>
          )}

          {/* ACCIONES RÁPIDAS DE SINCRONIZACIÓN */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Envases registrados ({packages.length}):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDetectFromProducts()}
                disabled={isSaving}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Detectar desde productos</span>
              </button>
              {packages.length === 0 && (
                <button
                  type="button"
                  onClick={() => void handleLoadCommon()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  <span>+ Sugerencias habituales</span>
                </button>
              )}
            </div>
          </div>

          {/* LISTA DE ENVASES */}
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400">Cargando envases...</div>
          ) : packages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 dark:border-slate-800">
              <AlertCircle className="h-7 w-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No hay envases retornables configurados
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Carga los envases que utiliza tu comercio arriba o detecta los envases existentes en tus productos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {packages.map((pkg) => {
                const usage = usageCountByPackage.get(pkg.name.toLowerCase()) ?? 0;
                return (
                  <div
                    key={pkg.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {pkg.name}
                        </span>
                        {usage > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            <ShoppingBag className="h-2.5 w-2.5" />
                            {usage} {usage === 1 ? "producto" : "productos"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Sin productos
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {pkg.suggestedPrice
                          ? `Precio cobro/reposición: ${currency.format(pkg.suggestedPrice)}`
                          : "Sin precio de reposición"}
                      </div>
                    </div>

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => void handleRemovePackage(pkg.name)}
                        title={`Eliminar ${pkg.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end border-t border-slate-200 pt-3 mt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="ui-btn-primary text-xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
