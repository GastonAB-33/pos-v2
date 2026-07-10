import { routePaths } from "@/config/routes";
import type { ModuleRouteItem } from "@/app/router/types";
import { MainMenuPage } from "@/modules/menu-principal/pages/MainMenuPage";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { PosPage } from "@/modules/pos/pages/PosPage";
import { ProductosPage } from "@/modules/productos/pages/ProductosPage";
import { ClientesPage } from "@/modules/clientes/pages/ClientesPage";
import { CuentasCorrientesPage } from "@/modules/cuentas-corrientes/pages/CuentasCorrientesPage";
import { StockPage } from "@/modules/stock/pages/StockPage";
import { CajaPage } from "@/modules/caja/pages/CajaPage";
import { ComprasPage } from "@/modules/compras/pages/ComprasPage";
import { ProveedoresPage } from "@/modules/proveedores/pages/ProveedoresPage";
import { ListasPreciosPage } from "@/modules/listas-precios/pages/ListasPreciosPage";
import { PromocionesPage } from "@/modules/promociones/pages/PromocionesPage";
import { MediosPagoPage } from "@/modules/medios-pago/pages/MediosPagoPage";
import { FacturacionPage } from "@/modules/facturacion/pages/FacturacionPage";
import { ComprobantesPage } from "@/modules/comprobantes/pages/ComprobantesPage";
import { ReportesPage } from "@/modules/reportes/pages/ReportesPage";
import { AuditoriaPage } from "@/modules/auditoria/pages/AuditoriaPage";
import { ConfiguracionPage } from "@/modules/configuracion/pages/ConfiguracionPage";
import {
  ConfiguracionAgendaPage,
  ConfiguracionAnalisisPage,
  ConfiguracionCatalogoPage,
  ConfiguracionContablePage,
  ConfiguracionSistemaPage,
} from "@/modules/configuracion/pages/ConfiguracionScopedPages";
import { UsuariosPage } from "@/modules/usuarios/pages/UsuariosPage";
import { MisConsultasPage } from "@/modules/sistema/pages/MisConsultasPage";
import { CentroSoportePage } from "@/modules/sistema/pages/CentroSoportePage";
import { AltaComercioPage } from "@/modules/sistema/pages/AltaComercioPage";

export const moduleRoutes: ModuleRouteItem[] = [
  { path: routePaths.menuPrincipal, Component: MainMenuPage },
  { path: routePaths.dashboard, Component: DashboardPage, requiredPermission: { module: "dashboard", level: "read" } },
  { path: routePaths.pos, Component: PosPage, requiredPermission: { module: "pos", level: "read" } },
  { path: routePaths.productos, Component: ProductosPage, requiredPermission: { module: "productos", level: "read" } },
  { path: routePaths.clientes, Component: ClientesPage, requiredPermission: { module: "clientes", level: "read" } },
  { path: routePaths.cuentasCorrientes, Component: CuentasCorrientesPage, requiredPermission: { module: "cuentas_corrientes", level: "read" } },
  { path: routePaths.stock, Component: StockPage, requiredPermission: { module: "stock", level: "read" } },
  { path: routePaths.caja, Component: CajaPage, requiredPermission: { module: "caja", level: "read" } },
  { path: routePaths.compras, Component: ComprasPage, requiredPermission: { module: "compras", level: "read" } },
  { path: routePaths.proveedores, Component: ProveedoresPage, requiredPermission: { module: "proveedores", level: "read" } },
  { path: routePaths.listasPrecios, Component: ListasPreciosPage, requiredPermission: { module: "listas_precios", level: "read" } },
  { path: routePaths.promociones, Component: PromocionesPage, requiredPermission: { module: "promociones", level: "read" } },
  { path: routePaths.mediosPago, Component: MediosPagoPage, requiredPermission: { module: "medios_pago", level: "read" } },
  { path: routePaths.facturacion, Component: FacturacionPage, requiredPermission: { module: "facturacion", level: "read" } },
  { path: routePaths.comprobantes, Component: ComprobantesPage, requiredPermission: { module: "comprobantes", level: "read" } },
  { path: routePaths.reportes, Component: ReportesPage, requiredPermission: { module: "reportes", level: "read" } },
  { path: routePaths.auditoria, Component: AuditoriaPage, requiredPermission: { module: "auditoria", level: "read" } },
  { path: routePaths.configuracion, Component: ConfiguracionPage, requiredPermission: { module: "configuracion", level: "read" } },
  { path: routePaths.configuracionAgenda, Component: ConfiguracionAgendaPage, requiredPermission: { module: "configuracion_agenda", level: "read" } },
  { path: routePaths.configuracionCatalogo, Component: ConfiguracionCatalogoPage, requiredPermission: { module: "configuracion_catalogo", level: "read" } },
  { path: routePaths.configuracionAnalisis, Component: ConfiguracionAnalisisPage, requiredPermission: { module: "configuracion_analisis", level: "read" } },
  { path: routePaths.configuracionSistema, Component: ConfiguracionSistemaPage, requiredPermission: { module: "configuracion_sistema", level: "read" } },
  { path: routePaths.altaComercio, Component: AltaComercioPage, requiredPermission: { module: "configuracion_sistema", level: "write" } },
  { path: routePaths.centroSoporte, Component: CentroSoportePage, requiredPermission: { module: "configuracion_sistema", level: "read" } },
  { path: routePaths.misConsultas, Component: MisConsultasPage, requiredPermission: { module: "configuracion_sistema", level: "read" } },
  { path: routePaths.configuracionContable, Component: ConfiguracionContablePage, requiredPermission: { module: "configuracion_contable", level: "read" } },
  { path: routePaths.usuarios, Component: UsuariosPage, requiredPermission: { module: "usuarios", level: "read" } },
];
