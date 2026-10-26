import { Navigate } from "react-router-dom";
import { routePaths } from "@/config/routes";

export const ComprobantesPage = () => {
  return <Navigate to={`${routePaths.facturacion}?tab=comprobantes`} replace />;
};
