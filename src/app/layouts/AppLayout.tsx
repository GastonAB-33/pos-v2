import { Outlet, useLocation } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export const AppLayout = () => {
  const location = useLocation();
  const isPosRoute =
    location.pathname === routePaths.pos || location.pathname.startsWith(`${routePaths.pos}/`);

  if (isPosRoute) {
    return (
      <div className="app-shell">
        <main className="app-main app-main--pos w-full">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <Topbar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
