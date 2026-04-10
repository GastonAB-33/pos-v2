import type { AppModule } from "@/types/modules";
import type { PermissionProfile } from "@/types/permissions";
import { createDefaultPermissionProfile } from "@/types/permissions";

interface ModuleRow {
  module: AppModule;
  label: string;
}

interface PermissionMatrixProps {
  modules: ModuleRow[];
  value: PermissionProfile;
  disabled?: boolean;
  onChange: (next: PermissionProfile) => void;
}

export const PermissionMatrix = ({
  modules,
  value,
  disabled,
  onChange,
}: PermissionMatrixProps) => {
  const normalized = {
    ...createDefaultPermissionProfile(),
    ...value,
  };

  const setPermission = (module: AppModule, level: "read" | "write", checked: boolean) => {
    onChange({
      ...normalized,
      [module]: {
        ...normalized[module],
        [level]: checked,
      },
    });
  };

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-700">Modulo</th>
            <th className="px-3 py-2 text-center font-medium text-slate-700">Read</th>
            <th className="px-3 py-2 text-center font-medium text-slate-700">Write</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {modules.map((row) => (
            <tr key={row.module}>
              <td className="px-3 py-2 text-slate-700">{row.label}</td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={Boolean(normalized[row.module]?.read)}
                  onChange={(event) =>
                    setPermission(row.module, "read", event.target.checked)
                  }
                  disabled={disabled}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={Boolean(normalized[row.module]?.write)}
                  onChange={(event) =>
                    setPermission(row.module, "write", event.target.checked)
                  }
                  disabled={disabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
