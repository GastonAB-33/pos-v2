import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useState } from "react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { SupplierForm } from "@/modules/proveedores/components/SupplierForm";
import { SuppliersTable } from "@/modules/proveedores/components/SuppliersTable";
import { SuppliersToolbar } from "@/modules/proveedores/components/SuppliersToolbar";
import { useSuppliersCrud } from "@/modules/proveedores/hooks/useSuppliersCrud";
import type { Supplier } from "@/types/entities";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";

export const ProveedoresPage = () => {
  const { tenantId } = useTenant();
  const { canRead, canWrite } = usePermissions();
  const canReadSuppliers = canRead("proveedores");
  const canWriteSuppliers = canWrite("proveedores");

  const {
    suppliers,
    search,
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

    const confirmed = window.confirm(`Eliminar proveedor ${supplier.name}?`);
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
      <PagePlaceholder
        title="Proveedores"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadSuppliers) {
    return (
      <PagePlaceholder
        title="Proveedores"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Proveedores" description="Datos de contacto y compras por proveedor">
      <div className="space-y-4">
        <SuppliersToolbar
          canWrite={canWriteSuppliers}
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
          onCreate={handleCreateClick}
          onReload={() => void reload()}
        />

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
            Cargando proveedores...
          </div>
        ) : (
          <SuppliersTable
            suppliers={suppliers}
            canWrite={canWriteSuppliers}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />
        )}

        {formOpen ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              {formMode === "create" ? "Crear proveedor" : "Editar proveedor"}
            </h3>
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
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
