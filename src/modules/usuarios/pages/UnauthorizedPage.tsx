import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { useLandingPath } from "@/features/auth/hooks/useLandingPath";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const UnauthorizedPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenantId = useAuthStore((state) => state.tenantId);
  const landingPath = useLandingPath();

  const backPath =
    isAuthenticated && user && tenantId && user.isActive
      ? landingPath
      : routePaths.login;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-panel">
        <h1 className="text-xl font-semibold text-slate-900">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-slate-600">
          No tenes permisos para acceder a este modulo.
        </p>
        <Link
          to={backPath}
          className="mt-5 inline-flex rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ir al panel principal
        </Link>
      </section>
    </main>
  );
};
