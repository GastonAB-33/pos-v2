import type { AppModule } from "@/types/modules";
import type { PermissionProfile } from "@/types/permissions";
import { createDefaultPermissionProfile } from "@/types/permissions";

interface ModuleItem {
  module: AppModule;
  label: string;
  isSubmodule?: boolean;
}

export interface ModuleGroup {
  id: string;
  label: string;
  description?: string;
  modules: ModuleItem[];
}

interface PermissionMatrixProps {
  groups: ModuleGroup[];
  value: PermissionProfile;
  disabled?: boolean;
  onChange: (next: PermissionProfile) => void;
}

export const PermissionMatrix = ({
  groups,
  value,
  disabled,
  onChange,
}: PermissionMatrixProps) => {
  const normalized = {
    ...createDefaultPermissionProfile(),
    ...value,
  };

  const setAccess = (module: AppModule, access: "none" | "read" | "write") => {
    const accessMap: Record<"none" | "read" | "write", { read: boolean; write: boolean }> = {
      none: { read: false, write: false },
      read: { read: true, write: false },
      write: { read: true, write: true },
    };

    onChange({
      ...normalized,
      [module]: {
        ...normalized[module],
        ...accessMap[access],
      },
    });
  };

  const getAccess = (module: AppModule): "none" | "read" | "write" => {
    if (normalized[module]?.write) return "write";
    if (normalized[module]?.read) return "read";
    return "none";
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.id} className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
          <header className="mb-3 border-b border-slate-200 pb-2">
            <h4 className="text-sm font-semibold text-slate-900">{group.label}</h4>
            {group.description ? <p className="text-xs text-slate-500">{group.description}</p> : null}
          </header>

          <div className="space-y-2">
            {group.modules.map((item) => {
              const access = getAccess(item.module);

              return (
                <div
                  key={item.module}
                  className={[
                    "flex flex-col gap-2 rounded-lg border px-3 py-2 md:flex-row md:items-center md:justify-between",
                    item.isSubmodule ? "md:ml-6 border-dashed" : "",
                  ].join(" ")}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{item.label}</p>
                    {item.isSubmodule ? <p className="text-xs text-slate-500">Submodulo</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="ui-btn-ghost px-2 py-1 text-xs"
                      onClick={() => setAccess(item.module, "none")}
                      disabled={disabled || access === "none"}
                    >
                      Sin acceso
                    </button>
                    <button
                      type="button"
                      className={access === "read" ? "ui-btn-primary px-2 py-1 text-xs" : "ui-btn-ghost px-2 py-1 text-xs"}
                      onClick={() => setAccess(item.module, "read")}
                      disabled={disabled}
                    >
                      Acceder
                    </button>
                    <button
                      type="button"
                      className={access === "write" ? "ui-btn-primary px-2 py-1 text-xs" : "ui-btn-ghost px-2 py-1 text-xs"}
                      onClick={() => setAccess(item.module, "write")}
                      disabled={disabled}
                    >
                      Acceder y editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
