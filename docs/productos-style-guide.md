# Guía de Estilo UI - Módulo Productos (POS V2)

## 1. Objetivo visual
Esta guía documenta el estilo aplicado en la nueva vista **Gestión de Productos** para reutilizarlo en otros módulos sin romper consistencia visual ni compatibilidad con tema claro/oscuro.

## 2. Base de diseño
- Estética: moderna, profesional, minimalista.
- Densidad: compacta-moderada, con foco en lectura rápida de tabla.
- Idioma: español en toda la interfaz.
- Soporte: escritorio y tablet (responsive).

## 3. Tokens y tema dinámico
La vista usa los tokens globales ya existentes en `src/styles.css` y toma color dinámico desde Configuración (`apariencia.accent_color`) vía `ThemeProvider`.

Tokens usados:
- Fondo general: `--ui-bg`
- Superficie principal: `--ui-surface`
- Superficie secundaria: `--ui-surface-2`
- Bordes: `--ui-border`
- Texto principal: `--ui-text`
- Texto secundario: `--ui-text-soft`
- Texto tenue: `--ui-muted`
- Acento dinámico: `--ui-accent`
- Acento suave: `--ui-accent-soft`

## 4. Componentes reutilizables usados
- Contenedor de página: `ui-panel`
- Inputs y selects: `ui-input`
- Botón principal: `ui-btn-primary`
- Botón secundario/ghost: `ui-btn-ghost`
- Tabla: `ui-table-wrap`
- Estados de feedback: `ui-success-state`, `ui-error-state`, `ui-empty-state`, `ui-loading`

## 5. Estructura de la pantalla
Orden visual recomendado:
1. Encabezado (título + subtítulo)
2. Barra de acciones (importar/exportar/nuevo)
3. Bloque de filtros
4. Tabla principal
5. Historial discreto al pie
6. Modales (alta/edición, código de barras, importación)

## 6. Reglas de layout y spacing
- Separación vertical entre bloques: `space-y-4`
- Bloques de control: `rounded-xl border border-slate-200 bg-white p-3`
- Grillas responsive:
  - Filtros: `md:grid-cols-2 xl:grid-cols-5`
  - Formularios: `md:grid-cols-2 xl:grid-cols-3` / `xl:grid-cols-5`

## 7. Tabla estándar para módulos administrativos
- Encabezados en mayúscula con tracking (heredado global en `thead th`).
- Celda de entidad principal con 2 líneas:
  - Línea 1: nombre con `font-medium`
  - Línea 2: metadata en `text-xs text-slate-500`
- Columna de estado visual binario: ícono (estrella favorita activa/inactiva).
- Columna acciones: botones iconográficos compactos con `title` (tooltip nativo).

## 8. Modales
Patrón usado:
- Overlay: `fixed inset-0 z-50 ... bg-[var(--ui-overlay)]`
- Caja modal: `rounded-xl border ... bg-white shadow-panel`
- Header con borde inferior y botón cerrar.
- Footer con acciones `Cancelar` + `Guardar`.

## 9. Interacciones y estados
- Favorito: toggle inmediato (estrella rellena/vacía).
- Eliminar: confirmación explícita previa.
- Precio final editable con cálculo inverso de ganancia.
- Feedback de operaciones: usar banners `ui-success-state` / `ui-error-state`.

## 10. Accesibilidad mínima aplicada
- `aria-label` en icon buttons.
- Tooltips vía atributo `title`.
- Contraste heredado por tokens de tema.
- Inputs con estados `focus` globales del sistema.

## 11. Patrón de auditoría reusable
Componente `ProductAuditLog`:
- Tabla compacta con columnas: Fecha, Usuario, Acción, Detalle.
- Altura limitada con scroll interno (`max-h-52 overflow-auto`).
- Ubicación: pie del módulo para no competir con la tabla principal.

## 12. Convención para replicar en otros módulos (paso a paso)
1. Copiar estructura visual: Header + Actions + Filters + Table + Audit + Modals.
2. Reusar clases `ui-*` antes de crear nuevas clases.
3. Mantener textos y labels en español.
4. Usar acciones iconográficas compactas con tooltip.
5. Conectar feedback con estados globales (`ui-success-state`, `ui-error-state`).
6. Mantener filtros arriba y logs abajo.
7. Si el módulo tiene cálculos, aislarlos en `utils/` con funciones puras.
8. Si hay configuración visual, respetar `--ui-accent` y no hardcodear colores de marca.

## 13. Archivos fuente del estilo de Productos
- `src/modules/productos/pages/ProductsPage.tsx`
- `src/modules/productos/components/ProductFilters.tsx`
- `src/modules/productos/components/ProductTable.tsx`
- `src/modules/productos/components/ProductActions.tsx`
- `src/modules/productos/components/ProductFormModal.tsx`
- `src/modules/productos/components/BarcodeGeneratorModal.tsx`
- `src/modules/productos/components/ProductAuditLog.tsx`

## 14. Checklist rápido para nuevos módulos
- [ ] Encabezado claro con subtítulo operativo
- [ ] Botón principal de alta + acciones secundarias
- [ ] Filtros por contexto
- [ ] Tabla con acciones por fila
- [ ] Modal de edición consistente
- [ ] Bloque de auditoría discreto
- [ ] Compatibilidad tema claro/oscuro
- [ ] Compatibilidad color dinámico de Configuración
