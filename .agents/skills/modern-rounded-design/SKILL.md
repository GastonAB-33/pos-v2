---
name: modern-rounded-design
description: >-
  Standard and design system for modern, rounded UI across POS V2: pill-shaped action buttons,
  rounded-2xl/3xl elevated panels, integrated search and filter strips, rounded table wraps,
  circular action buttons, and rounded-2xl/3xl modals.
---

# Modern Rounded Design Standard (POS V2)

This skill defines the visual hierarchy, component geometry, border radii, sizing, and interaction standards to apply the **Modern Rounded Design** established in the Products module across all other modules of POS V2 (Clientes, Proveedores, Stock, Caja, Compras, etc.).

---

## 1. Core Visual Principles

1. **Clean Separation of Page & Surfaces**:
   - The page header floats cleanly directly on the page canvas (no gray square container box wrapping the entire header and toolbar).
   - Content and filter areas are enclosed in distinct, elevated, highly rounded card surfaces (`rounded-2xl` or `rounded-3xl`).

2. **Rounded Hierarchy Tokens**:
   - **Page Panels / Modals / Table Wrappers**: `rounded-2xl sm:rounded-3xl` (16px to 24px corner radius).
   - **Top Primary & Secondary Action Buttons**: Pill shape (`rounded-2xl` or `rounded-full`).
   - **Inputs / Dropdowns / Inner Filter Controls / Modal Buttons**: `rounded-xl sm:rounded-2xl` (12px to 16px).
   - **Row Actions / Badges / Status Indicators**: Fully rounded capsules / circles (`rounded-full`).

3. **Subtle Elevation & Contrast**:
   - Light Mode: Crisp white surfaces (`bg-white`), ultra-subtle borders (`border-slate-200/90`), and soft micro-shadows (`shadow-xs` or `shadow-sm`).
   - Dark Mode: Solid dark surface (`dark:bg-slate-900`), visible structural borders (`dark:border-slate-800` or `dark:border-slate-700/80`), never unbordered "black holes".
   - Complies fully with the `dark-mode-contrast` skill at all times.

---

## 2. Page Header & Action Buttons Pattern

Every module toolbar/header must present the breadcrumb, title, and pill-shaped action buttons directly against the canvas:

```tsx
<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    {/* Breadcrumbs en mayúsculas con jerarquía */}
    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
      <span className="text-slate-400 dark:text-slate-500">INVENTARIO</span>
      <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
      <span className="text-blue-600 dark:text-blue-400 font-bold">CATÁLOGO DE PRODUCTOS</span>
    </div>

    {/* Título y bajada descriptiva */}
    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
      Productos
    </h1>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Busca, edita e incorpora productos al inventario general.
    </p>
  </div>

  {/* Fila de Botones Píldora */}
  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
    {/* Botón Secundario Píldora (Actualizar / Exportar / etc.) */}
    <button
      type="button"
      onClick={onReload}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all"
    >
      <RefreshCw size={15} className="text-slate-500 dark:text-slate-400" />
      <span>Actualizar</span>
    </button>

    {/* Botón de Menú de Opciones (Píldora de 3 puntos verticales) */}
    <div className="relative">
      <button
        type="button"
        onClick={() => setActionsOpen(!actionsOpen)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-500 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
        title="Más acciones"
      >
        <MoreVertical size={16} />
      </button>

      {/* Popover desplegable con esquinas redondeadas */}
      {actionsOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
          <button className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors">
            ...
          </button>
        </div>
      )}
    </div>

    {/* Botón Primario Píldora (+ Nuevo) */}
    <button
      type="button"
      onClick={onOpenCreate}
      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
    >
      <Plus size={16} strokeWidth={2.5} />
      <span>Nuevo registro</span>
    </button>
  </div>
</header>
```

---

## 3. Search & Filter Bar Pattern

The search input and filters are wrapped in a single, unified `rounded-2xl sm:rounded-3xl` card panel:

```tsx
<div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
    {/* 1. Input de Búsqueda Redondeado */}
    <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
      <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
      <input
        className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar..."
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full"
        >
          <X size={15} />
        </button>
      )}
      {/* Acción rápida accesoria (ej. Cámara / Escáner) */}
      <button
        type="button"
        onClick={onOpenScanner}
        className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 shrink-0 transition-colors rounded-lg"
      >
        <Camera size={18} />
      </button>
    </div>

    {/* 2. Selector Dropdown Redondeado (Categoría / Estado / etc.) */}
    <div className="relative inline-flex items-center shrink-0">
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="appearance-none cursor-pointer rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 pl-4 pr-8 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-full sm:w-auto"
      >
        <option value="">Categoría: Todos</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            Categoría: {c}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400 dark:text-slate-500" />
    </div>

    {/* 3. Botón de Filtros Avanzados */}
    <button
      type="button"
      onClick={() => setFiltersModalOpen(true)}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer",
        activeFiltersCount > 0 && "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
      )}
    >
      <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
      <span>Filtros avanzados</span>
      {activeFiltersCount > 0 && (
        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {activeFiltersCount}
        </span>
      )}
    </button>
  </div>
</div>
```

---

## 4. Tables & Lists Container Pattern

All tabular views must wrap their table in a dedicated `rounded-2xl sm:rounded-3xl` container:

```tsx
<div className="ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
  <table className="min-w-full text-sm">
    <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
      <tr>
        <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Columna</th>
        ...
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
        {/* Badges Píldora dentro de filas */}
        <td>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Etiqueta
          </span>
        </td>

        {/* Acciones de fila: botones circulares / píldora */}
        <td>
          <div className="flex items-center gap-1.5">
            <button className="!rounded-full h-8 w-8 inline-flex items-center justify-center hover:scale-105 transition-transform ...">
              <Pencil size={14} />
            </button>
            <button className="!rounded-full h-8 w-8 inline-flex items-center justify-center hover:scale-105 transition-transform text-red-600 ...">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 5. Pagination & Disclosures

- **Pagination Controls**:
  Wrapped in `rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900`.
  Next/Previous buttons use `rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`.

- **Collapsible Disclosures (Auditoría, Historiales)**:
  Outer container: `rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900`.
  Summary: `px-4 py-3.5 rounded-2xl hover:bg-slate-50/60 dark:hover:bg-slate-800/40`.
  Sub-tables and buttons inside: `rounded-xl`.

---

## 6. Modals & Dialogs Pattern

1. **Outer Shell**:
   `w-full max-w-4xl rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden`
2. **Inner Cards / Fieldsets**:
   `rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50`
3. **Inputs & Selects**:
   `rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90`
4. **Footer Buttons**:
   - Secondary / Cancel: `rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`
   - Primary / Submit: `rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95`

---

## 7. Quick Checklist Before Shipping UI Changes

- [ ] Header has breadcrumbs (`MODULE › SUBMODULE`) and no rigid square border wrapper.
- [ ] Primary action buttons are pill-shaped (`rounded-2xl` or `rounded-full`).
- [ ] Search & filter bar is an integrated card with `rounded-2xl sm:rounded-3xl`.
- [ ] Dropdowns and search input use `rounded-xl sm:rounded-2xl`.
- [ ] Table wrapper has `rounded-2xl sm:rounded-3xl` with `overflow-hidden`.
- [ ] Row action buttons are circular/pill (`!rounded-full`).
- [ ] Paginator and disclosures use `rounded-2xl`.
- [ ] Modals use `rounded-2xl sm:rounded-3xl` with `rounded-xl` inputs and buttons.
- [ ] Dark and midnight modes maintain visible borders and contrast (no borderless black holes).
