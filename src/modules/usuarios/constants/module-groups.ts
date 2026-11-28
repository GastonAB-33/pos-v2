import type { AppModule } from "@/types/modules";

export interface SystemModuleItem {
  module: AppModule;
  label: string;
  description: string;
  readDescription?: string;
  writeDescription?: string;
  isSpecialAction?: boolean;
}

export interface SystemModuleGroup {
  id: string;
  label: string;
  description: string;
  iconName:
    | "shopping-cart"
    | "package"
    | "truck"
    | "users"
    | "landmark"
    | "file-text"
    | "user-check"
    | "bar-chart"
    | "sliders";
  modules: SystemModuleItem[];
}

export const defaultSystemModuleGroups: SystemModuleGroup[] = [
  {
    id: "ventas",
    label: "Punto de Venta y Mostrador",
    description: "Operaciones de caja diaria, ventas rápidas de mostrador y promociones comerciales",
    iconName: "shopping-cart",
    modules: [
      {
        module: "pos",
        label: "Punto de Venta (POS)",
        description: "Terminal de venta rápida, escaneo de artículos, cobro y emisión de tickets",
        readDescription: "Consultar ventas y terminal POS",
        writeDescription: "Cobrar, registrar ventas, aplicar descuentos y finalizar operaciones",
      },
      {
        module: "caja",
        label: "Caja Diaria (Turnos y Arqueo)",
        description: "Apertura y cierre de turnos de caja, conteo de billetes y consulta de arqueo",
        readDescription: "Ver saldo de caja y movimientos registrados",
        writeDescription: "Abrir y cerrar turnos de caja diaria, realizar arqueo de turno",
      },
      {
        module: "caja_movimientos_manuales",
        label: "Movimientos Manuales de Caja",
        description: "Autorización para registrar ingresos o egresos de efectivo manuales en la caja abierta",
        readDescription: "Consultar historial de movimientos manuales",
        writeDescription: "Registrar extracciones de efectivo, retiros, adelantos y entradas manuales",
      },
      {
        module: "caja_cierre_ciego",
        label: "Cierre de Caja a Ciegas",
        description: "Regla de arqueo ciego para cajeros: oculta las ventas y saldo esperado, obligando al usuario a contar billetes a ciegas al cerrar turno",
        readDescription: "Aplica cierre a ciegas obligatorio (oculta importes previos al cierre)",
        writeDescription: "Aplica cierre a ciegas obligatorio (oculta importes previos al cierre)",
        isSpecialAction: true,
      },
      {
        module: "caja_apertura_diferida",
        label: "Posponer Conteo de Apertura",
        description: "Permite abrir la caja en $0 para atender rápido y cargar el conteo físico más tarde (descontando automáticamente el efectivo de ventas previas)",
        readDescription: "Permitir posponer conteo inicial al abrir caja",
        writeDescription: "Permitir posponer conteo inicial al abrir caja",
        isSpecialAction: true,
      },
      {
        module: "promociones",
        label: "Promociones y Descuentos",
        description: "Configuración de promociones comerciales, 2x1, combos y descuentos por volumen",
        readDescription: "Consultar promociones vigentes",
        writeDescription: "Crear, editar o desactivar promociones y descuentos",
      },
    ],
  },
  {
    id: "inventario",
    label: "Catálogo e Inventario",
    description: "Artículos, existencias de mercadería, listas de precios y ajustes de almacén",
    iconName: "package",
    modules: [
      {
        module: "productos",
        label: "Catálogo de Productos",
        description: "Fichero maestro de artículos, costos, precios de venta, códigos de barra y categorías",
        readDescription: "Consultar catálogo de productos y precios",
        writeDescription: "Crear, editar o eliminar productos, modificar costos y precios",
      },
      {
        module: "stock",
        label: "Control de Stock",
        description: "Existencias en tiempo real, consulta de movimientos y umbrales mínimos",
        readDescription: "Consultar existencias y movimientos de stock",
        writeDescription: "Modificar umbrales de stock mínimo/máximo y definir alertas de reposición",
      },
      {
        module: "stock_ajustes_manuales",
        label: "Ajustes Manuales de Stock",
        description: "Autorización para registrar entradas o salidas manuales de mercadería por roturas, mermas o inventario físico",
        readDescription: "Consultar historial de ajustes manuales de stock",
        writeDescription: "Registrar ajustes manuales de aumento o descuento de existencias",
        isSpecialAction: true,
      },
      {
        module: "listas_precios",
        label: "Listas de Precios",
        description: "Listas de precios diferenciales (minorista, mayorista, gremio y convenios)",
        readDescription: "Consultar listas de precios habilitadas",
        writeDescription: "Crear, editar y ajustar porcentajes en listas de precios",
      },
      {
        module: "produccion",
        label: "Producción y Recetas",
        description: "Elaboración de alimentos o insumos propios descontando materia prima del inventario y sumando producto terminado",
        readDescription: "Consultar recetas, costos y lotes de producción",
        writeDescription: "Crear/editar recetas, registrar lotes de producción y anular producciones",
      },
    ],
  },
  {
    id: "compras",
    label: "Compras y Proveedores",
    description: "Recepción de mercadería, órdenes de compra, control de costos y fichero de proveedores",
    iconName: "truck",
    modules: [
      {
        module: "proveedores",
        label: "Directorio de Proveedores",
        description: "Fichas comerciales de proveedores, CUIT, condiciones de pago y datos de contacto",
        readDescription: "Consultar datos y fichas de proveedores",
        writeDescription: "Crear, editar y eliminar proveedores",
      },
      {
        module: "compras",
        label: "Compras a Proveedores",
        description: "Registro de facturas y remitos de compra de mercadería e ingreso de existencias",
        readDescription: "Consultar historial de compras realizadas",
        writeDescription: "Registrar nuevas compras y dar ingreso a stock",
      },
      {
        module: "compras_margen",
        label: "Márgenes y Precios de Venta en Compras",
        description: "Privilegio de seguridad: autoriza a ver/editar el margen de ganancia (%) y actualizar precios de venta finales al ingresar compras",
        readDescription: "Visualizar porcentajes de ganancia en pantalla de compras",
        writeDescription: "Modificar márgenes y actualizar precios de venta directamente",
        isSpecialAction: true,
      },
      {
        module: "compras_doble_confirmacion",
        label: "Aprobar Precios en Compras (Doble Confirmación)",
        description: "Autorización para revisar, fijar márgenes y aprobar compras recepcionadas pendientes de fijar precios",
        readDescription: "Consultar compras en estado pendiente de aprobación de precios",
        writeDescription: "Aprobar y fijar precios definitivos de venta en compras",
        isSpecialAction: true,
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes y Créditos",
    description: "Cartera de clientes, límites crediticios y cuentas corrientes comerciales",
    iconName: "users",
    modules: [
      {
        module: "clientes",
        label: "Cartera de Clientes",
        description: "Fichero de clientes, datos fiscales, direcciones, teléfonos y condiciones comerciales",
        readDescription: "Consultar listado y fichas de clientes",
        writeDescription: "Crear, editar datos fiscales y límites crediticios",
      },
      {
        module: "cuentas_corrientes",
        label: "Cuentas Corrientes Clientes",
        description: "Saldos a favor y deudas de clientes, imputación de cobranzas y recibos oficiales",
        readDescription: "Ver saldos adeudados y movimientos de clientes",
        writeDescription: "Registrar cobranzas, emitir recibos y autorizar excepciones de crédito",
      },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas y Tesorería",
    description: "Caja general, cuentas bancarias, deudas con proveedores y medios de pago",
    iconName: "landmark",
    modules: [
      {
        module: "caja_general",
        label: "Caja General / Tesorería",
        description: "Gestión centralizada de fondos, transferencias entre cajas y retiros ejecutivos",
        readDescription: "Consultar balances de tesorería y arqueos centrales",
        writeDescription: "Registrar transferencias y movimientos de caja general",
      },
      {
        module: "bancos",
        label: "Cuentas Bancarias",
        description: "Cuentas bancarias de la empresa, extractos, transferencias, CBU/Alias y conciliación",
        readDescription: "Consultar cuentas bancarias y saldos",
        writeDescription: "Registrar movimientos bancarios, depósitos y conciliar",
      },
      {
        module: "cuentas_corrientes_proveedores",
        label: "Cuentas Corrientes Proveedores",
        description: "Seguimiento de deudas comerciales por compras a proveedores y órdenes de pago",
        readDescription: "Ver facturas pendientes y vencimientos con proveedores",
        writeDescription: "Emitir órdenes de pago y registrar cancelaciones",
      },
      {
        module: "medios_pago",
        label: "Medios de Pago",
        description: "Administración de canales de cobro (efectivo, tarjetas de débito/crédito, transferencias, QR)",
        readDescription: "Consultar medios de pago configurados",
        writeDescription: "Habilitar, desactivar y configurar recargos o planes de pago",
      },
    ],
  },
  {
    id: "fiscalidad",
    label: "Facturación y Fiscalidad",
    description: "Emisión fiscal electrónica ante ARCA / AFIP y auditoría de comprobantes",
    iconName: "file-text",
    modules: [
      {
        module: "facturacion",
        label: "Facturación Electrónica ARCA",
        description: "Emisión de facturas A, B, C, notas de crédito y notas de débito con CAE oficial",
        readDescription: "Consultar facturas electrónicas emitidas",
        writeDescription: "Emitir facturas fiscales, notas de crédito y transmitir a ARCA",
      },
      {
        module: "comprobantes",
        label: "Historial de Comprobantes",
        description: "Búsqueda, auditoría, reimpresión y descarga de comprobantes emitidos y presupuestos",
        readDescription: "Consultar y reimprimir comprobantes y presupuestos",
        writeDescription: "Anular comprobantes y gestionar devoluciones",
      },
    ],
  },
  {
    id: "personal",
    label: "Personal y RRHH",
    description: "Control de empleados, asistencia, anticipos salariales y cuentas de personal",
    iconName: "user-check",
    modules: [
      {
        module: "empleados",
        label: "Gestión de Empleados",
        description: "Fichero de empleados, fichaje de asistencias, liquidación de sueldos y anticipos",
        readDescription: "Consultar nómina de empleados y asistencias",
        writeDescription: "Crear empleados, registrar asistencias, anticipos y liquidar",
      },
    ],
  },
  {
    id: "inteligencia",
    label: "Estadísticas y Auditoría",
    description: "Inteligencia comercial, informes ejecutivos de gestión y auditoría de eventos",
    iconName: "bar-chart",
    modules: [
      {
        module: "dashboard",
        label: "Panel de Estadísticas (Dashboard)",
        description: "Visualización de gráficos ejecutivos, facturación del día y métricas clave de rendimiento",
        readDescription: "Visualizar gráficos de ventas y estadísticas comerciales",
        writeDescription: "Exportar estadísticas y personalizar paneles",
      },
      {
        module: "reportes",
        label: "Reportes de Gestión",
        description: "Informes analíticos de rentabilidad, ranking de ventas, clientes y arqueos",
        readDescription: "Generar y consultar reportes analíticos",
        writeDescription: "Exportar reportes a Excel / CSV y programar envíos",
      },
      {
        module: "auditoria",
        label: "Auditoría de Seguridad",
        description: "Registro cronológico inmutable de acciones realizadas por cada usuario en el sistema",
        readDescription: "Consultar registros de auditoría y trazas de usuario",
        writeDescription: "Exportar bitácoras de auditoría de seguridad",
      },
    ],
  },
  {
    id: "administracion",
    label: "Administración y Sistema",
    description: "Gestión de usuarios operadores, perfiles de seguridad y configuración global del comercio",
    iconName: "sliders",
    modules: [
      {
        module: "usuarios",
        label: "Usuarios y Perfiles de Seguridad",
        description: "Creación de operadores, asignación de perfiles, control de acceso y contraseñas",
        readDescription: "Ver usuarios registrados y perfiles asignados",
        writeDescription: "Crear, editar usuarios, resetear contraseñas y configurar perfiles de permisos",
      },
      {
        module: "configuracion",
        label: "Configuración General del Sistema",
        description: "Parámetros comerciales de la empresa, certificados ARCA, balanzas, apariencia y opciones generales",
        readDescription: "Consultar las configuraciones del comercio y parámetros del sistema",
        writeDescription: "Modificar datos comerciales, claves fiscales ARCA, balanzas, cuentas y parámetros del sistema",
      },
    ],
  },
];
