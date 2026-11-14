import { Navigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { ConfiguracionPage } from "@/modules/configuracion/pages/ConfiguracionPage";

// Redirecciones unificadas hacia el centro de configuración del sistema
export const ConfiguracionAgendaPage = () => (
  <Navigate to={`${routePaths.configuracionSistema}?tab=empleados`} replace />
);

export const ConfiguracionCatalogoPage = () => (
  <Navigate to={`${routePaths.configuracionSistema}?tab=stock`} replace />
);

export const ConfiguracionAnalisisPage = () => (
  <Navigate to={routePaths.configuracionSistema} replace />
);

export const ConfiguracionContablePage = () => (
  <Navigate to={`${routePaths.configuracionSistema}?tab=facturacion`} replace />
);

export const ConfiguracionSistemaPage = () => <ConfiguracionPage scope="sistema" />;
