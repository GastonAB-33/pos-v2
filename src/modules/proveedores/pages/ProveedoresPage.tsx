import { useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { SupplierForm } from "@/modules/proveedores/components/SupplierForm";
import { SuppliersTable } from "@/modules/proveedores/components/SuppliersTable";
import {
  SuppliersToolbar,
  type SuppliersFiltersState,
} from "@/modules/proveedores/components/SuppliersToolbar";
import { useSuppliersCrud } from "@/modules/proveedores/hooks/useSuppliersCrud";
import { cn } from "@/utils/cn";
import type { Supplier } from "@/types/entities";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";

export const ProveedoresPage = () => {
  const { tenantId } = useTenant();
  const { canRead, canWrite } = usePermissions();
  const canReadSuppliers = canRead("proveedores");
  const canWriteSuppliers = canWrite("proveedores");

  const {
    suppliers,
    totalCount,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    toggleSupplierActive,
  } = useSuppliersCrud(tenantId);

  const [filters, setFilters] = useState<SuppliersFiltersState>({
    search: "",
    status: "all",
    hasPhone: "all",
    hasEmail: "all",
  });

  const handleFiltersChange = (patch: Partial<SuppliersFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (patch.search !== undefined) {
      setSearch(patch.search);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      hasPhone: "all",
      hasEmail: "all",
    });
    setSearch("");
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      if (filters.status === "active" && !supplier.is_active) return false;
      if (filters.status === "inactive" && supplier.is_active) return false;
      if (filters.hasPhone === "yes" && !supplier.phone?.trim()) return false;
      if (filters.hasPhone === "no" && supplier.phone?.trim()) return false;
      if (filters.hasEmail === "yes" && !supplier.email?.trim()) return false;
      if (filters.hasEmail === "no" && supplier.email?.trim()) return false;
      return true;
    });
  }, [suppliers, filters.status, filters.hasPhone, filters.hasEmail]);

  const resetPaginationKey = `${filters.search}-${filters.status}-${filters.hasPhone}-${filters.hasEmail}`;
  const paginatedSuppliers = usePagination(filteredSuppliers, 10, resetPaginationKey);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>(undefined);

  const handleCreateClick = () => {
    if (!canWriteSuppliers) return;
    clearFeedback();
    setFormMode("create");
    setSelectedSupplier(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (supplier: Supplier) => {
    if (!canWriteSuppliers) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedSupplier(supplier);
    setFormOpen(true);
  };

  const handleDeleteClick = async (supplier: Supplier) => {
    if (!canWriteSuppliers) return;

    const confirmed = window.confirm(`¿Eliminar proveedor ${supplier.name}?`);
    if (!confirmed) return;

    await deleteSupplier(supplier.id);
  };

  const handleToggleClick = async (supplier: Supplier) => {
    if (!canWriteSuppliers) return;
    await toggleSupplierActive(supplier.id);
  };

  const handleSubmitForm = async (values: SupplierFormValues) => {
    if (formMode === "create") {
      await createSupplier(values);
    } else if (selectedSupplier) {
      await updateSupplier(selectedSupplier.id, values);
    }

    setFormOpen(false);
    setSelectedSupplier(undefined);
  };

  if (!tenantId) {
    return (
      <section className="ui-panel operational-page p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No hay un comercio activo seleccionado.
        </div>
      </section>
    );
  }

  if (!canReadSuppliers) {
    return (
      <section className="ui-panel operational-page p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No tienes permisos de lectura para este módulo.
        </div>
      </section>
    );
  }

  return (
    <section className="ui-panel operational-page suppliers-page space-y-4 w-full min-w-0 max-w-full overflow-hidden">
      <SuppliersToolbar
        canWrite={canWriteSuppliers}
        loading={isLoading || isSubmitting}
        totalCount={totalCount ?? suppliers.length}
        filteredCount={filteredSuppliers.length}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        onCreate={handleCreateClick}
        onReload={() => void reload()}
      />

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            feedback.type === "success" ? "ui-success-state" : "ui-error-state"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState
          message="Cargando listado de proveedores..."
          description="Consultando proveedores activos, datos de contacto y condiciones..."
        />
      ) : (
        <>
          <SuppliersTable
            suppliers={paginatedSuppliers.pageItems}
            canWrite={canWriteSuppliers}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />

          <PaginationControls
            currentPage={paginatedSuppliers.currentPage}
            pageCount={paginatedSuppliers.pageCount}
            startItem={paginatedSuppliers.startItem}
            endItem={paginatedSuppliers.endItem}
            totalItems={paginatedSuppliers.totalItems}
            onPageChange={paginatedSuppliers.setCurrentPage}
          />
        </>
      )}

      {/* Modal de Alta / Edición de Proveedor */}
      {formOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar formulario de proveedor"
            onClick={() => {
              setFormOpen(false);
              setSelectedSupplier(undefined);
            }}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="text-slate-400 dark:text-slate-500">ABASTECIMIENTO</span>
                  <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {formMode === "create" ? "NUEVO PROVEEDOR" : "EDITAR PROVEEDOR"}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formMode === "create"
                    ? "Registrar nuevo proveedor"
                    : `Editar: ${selectedSupplier?.name ?? "Proveedor"}`}
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar modal de proveedor"
                onClick={() => {
                  setFormOpen(false);
                  setSelectedSupplier(undefined);
                }}
                disabled={isSubmitting}
              />
            </div>
            <SupplierForm
              mode={formMode}
              supplier={selectedSupplier}
              disabled={isSubmitting}
              onCancel={() => {
                setFormOpen(false);
                setSelectedSupplier(undefined);
              }}
              onSubmit={handleSubmitForm}
            />
          </div>
        </section>
      ) : null}
    </section>
  );
};

