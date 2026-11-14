---
name: mobile-data-cards
description: >-
  Standard and implementation pattern for responsive Table-to-Card transformation across POS V2:
  switches dense data tables (hidden md:block) into elevated, touch-friendly individual cards on mobile (block md:hidden),
  encapsulates secondary filters into an advanced filters panel underneath the search bar,
  ensuring high legibility, accessible touch targets, and zero horizontal scroll blowouts.
---

# Mobile Data Cards & Filter Encapsulation Pattern (POS V2)
### *Responsive Table-to-Card Transformation & Mobile Filter Architecture*

This skill defines the UX/UI architecture, visual hierarchy, tokens, and React/Tailwind standard to:
1. Transform complex desktop data tables (`<table>`) into clean, independent, touch-first cards (`<article>` / `<div>`) on mobile viewports.
2. Encapsulate secondary table filters (categories, statuses, suppliers, dates, branch/deposit) inside a dedicated **`[ ☷ Filtros avanzados ]`** modal placed directly underneath the search bar on mobile, eliminating cluttered dropdown stacking and horizontal scroll blowouts.

---

## 1. What is this Feature and Why Do We Use It?

In modern web development and responsive UI/UX, this pattern combines:
- **Responsive Table-to-Card Pattern** (Adaptive Data Cards / Hybrid Table-Card Layout)
- **Mobile Filter Sheet Encapsulation** (Progressive Disclosure for Search & Filtering)

### The Core Problems it Solves:
Traditional web dashboards display wide tables (600px–1200px) with multiple filter dropdowns side-by-side. When viewed on a mobile device (320px–420px):
1. **Horizontal Scroll Hell (`overflow-x-auto`)**: The user has to scroll sideways constantly to read columns or find hidden filter pills that fell off screen.
2. **Filter Clutter & Cognitive Overload**: Stacking 4 or 5 dropdowns (`Categoría`, `Subcategoría`, `Proveedor`, `Estado`, `Depósito`) directly on the screen consumes half the viewport before any product card is even visible.
3. **Misclicks & Text Clipping**: Tight table action buttons cause misclicks, and long product names get clipped into unreadable fragments.

### The Standard POS V2 Solution:
1. **Table-to-Card Bifurcation**:
   - **Desktop & Tablets (`hidden md:block`)**: Renders the complete, dense data table (`<table>`) wrapped in `rounded-2xl sm:rounded-3xl`.
   - **Mobile Phones (`block md:hidden`)**: Renders a vertical stack of **individual elevated cards**, organizing each row's data into a clean 3-4 zone vertical micro-hierarchy.
2. **Mobile Filter Encapsulation**:
   - The search input sits prominently on top (`w-full`).
   - Secondary filters are stripped from the direct mobile view and moved inside an **Advanced Filters Modal**.
   - Directly underneath the search input sits a dedicated, touch-friendly button: `[ ☷ Filtros avanzados ]` with an active filter badge counter (`activeCount > 0`).

---

## 2. Mobile Search & Filter Encapsulation Pattern

On mobile screens, filters must never take up multiple lines of dropdowns or require horizontal scrolling. They must follow this layout:

```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Buscar por nombre, código...                       📷]  │  ← Search input + integrated camera icon
│ [ ☷ Filtros avanzados                          (2) ] [✖]    │  ← Full-width filter button + reset button
└─────────────────────────────────────────────────────────────┘
```

### Visual Structure & Ergonomics:
1. **Search Input (Top)**:
   - Full width on mobile (`flex-1 min-w-0`).
   - Integrated camera barcode scanner button on the right side if the module supports barcode scanning.
   - Clear icon (`X`) appears when input has text.
2. **Filtros Avanzados Button (Directly Underneath on Mobile)**:
   - Layout: `flex flex-col sm:flex-row sm:items-center gap-2`. On mobile, it stacks cleanly below the search bar.
   - Button class: `flex-1 sm:flex-none w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200`.
   - **Active State**: When filters are applied (`activeFiltersCount > 0`), the button highlights with vivid blue borders and background:
     `border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold`.
   - **Counter Badge**: Displays a blue pill with the number of active filters:
     `<span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{activeFiltersCount}</span>`.
3. **Quick Clear Button (`FilterX`)**:
   - Positioned alongside the advanced filter button whenever any filter or search query is active, allowing 1-tap reset of all filters.

### Implementation Pattern (Search Strip + Filter Encapsulation):

```tsx
import { useState } from "react";
import { Search, Camera, SlidersHorizontal, FilterX, X } from "lucide-react";
import { cn } from "@/utils/cn";

export const ModuleFilterStrip = ({
  search,
  onSearchChange,
  onOpenScanner,
  activeFiltersCount,
  onOpenAdvancedFilters,
  onClearFilters,
}: {
  search: string;
  onSearchChange: (val: string) => void;
  onOpenScanner?: () => void;
  activeFiltersCount: number;
  onOpenAdvancedFilters: () => void;
  onClearFilters: () => void;
}) => {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
        {/* 1. Buscador con cámara integrada */}
        <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, código..."
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full"
            >
              <X size={15} />
            </button>
          )}
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 shrink-0 rounded-lg"
              title="Escanear con cámara"
            >
              <Camera size={18} />
            </button>
          )}
        </div>

        {/* 2. Botón de Filtros Avanzados (debajo en móvil, inline en desktop) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAdvancedFilters}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer",
              activeFiltersCount > 0 &&
                "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
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

          {(search || activeFiltersCount > 0) && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0"
              title="Limpiar filtros"
            >
              <FilterX size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

## 3. Anatomical Structure of a Mobile Data Card

Every mobile data card must be structured in 4 clearly defined horizontal zones:

```
┌─────────────────────────────────────────────────────────────┐
│ [FERNET]  [MAXICONSUMO]                         ● 13 u.     │  ← Zone 1: Pills, badges & stock status
│ 1882 FERNET 750 ml                                          │  ← Zone 2: Primary Name / Identifier (Bold)
│ PRECIO FINAL                                   (≡) (✎) (⋮)  │  ← Zone 3: Main KPI (Price/Total) & Circular Actions
│ $ 9.075,00                                                  │
├─────────────────────────────────────────────────────────────┤
│   MÍNIMO SUGERIDO              MÁXIMO BODEGA                │  ← Zone 4: Secondary Sub-panel (optional metrics)
│         -                            -                      │
└─────────────────────────────────────────────────────────────┘
```

### Zone 1: Metadata Pills & Quick Status Badge
- **Left Side**: Entity tags and categories (`rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 text-[11px] font-semibold`). Max 1-2 badges, truncated if necessary.
- **Right Side**: Primary status badge (e.g., Stock status, invoice payment status, attendance status). Uses colored dot (`●`) and high-contrast pill (`bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300`).

### Zone 2: Primary Name / Title
- Product name, supplier corporate name, customer name, or receipt title.
- Typography: `font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug line-clamp-2`.
- Avoid cutting off names awkwardly; allow up to 2 lines before truncating.

### Zone 3: Main KPI & Circular Row Actions
- **Main Metric (Left)**: Sized prominently (`text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100`). Always accompanied by an uppercase micro-label above it (`text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500`).
- **Touch Actions (Right)**: Fully circular pill buttons (`!rounded-full h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 transition-all active:scale-95`).

### Zone 4: Secondary Metrics Sub-panel (Optional)
- When items have pairs of parameters (e.g. Min/Max thresholds, Due dates, Discounts):
- Render as an enclosed sub-card: `rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 dark:divide-slate-700/60`.

---

## 4. Visual Styling Tokens & Dark Mode Contract

Adheres strictly to `modern-rounded-design` and `dark-mode-contrast`:

| Element | Light Mode Tokens | Dark Mode Tokens |
| :--- | :--- | :--- |
| **Card Shell** | `rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs` | `dark:border-slate-800 dark:bg-slate-900` |
| **Card (Selected)** | `border-blue-500 ring-1 ring-blue-500/25 bg-blue-50/15` | `dark:border-blue-500/80 dark:bg-blue-950/20` |
| **Title** | `text-slate-900 font-bold text-sm` | `dark:text-slate-100` |
| **Pill Badges** | `rounded-full bg-slate-100 text-slate-700 text-[11px]` | `dark:bg-slate-800 dark:text-slate-300` |
| **KPI Amount** | `text-slate-900 font-extrabold text-base` | `dark:text-slate-100` |
| **Sub-panel** | `rounded-xl bg-slate-50/80 border border-slate-200/70` | `dark:bg-slate-800/40 dark:border-slate-700/60` |
| **Circular Actions** | `!rounded-full border border-slate-200/90 bg-white text-slate-600` | `dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200` |
| **Filter Button** | `rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 text-slate-700` | `dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200` |

> [!IMPORTANT]
> Never let mobile cards become unbordered "black holes" in dark mode. Always enforce `dark:border-slate-800` or `dark:border-slate-700/80` and `dark:bg-slate-900`.

---

## 5. Reusable Implementation Pattern (React + Tailwind)

This is the standard implementation pattern to apply in any module's table component:

```tsx
import { useState } from "react";
import { cn } from "@/utils/cn";
import { Barcode, Pencil, MoreVertical } from "lucide-react";

interface Item {
  id: string;
  name: string;
  category: string;
  supplier?: string;
  stock: number;
  price: number;
}

export const ModuleHybridTable = ({ items }: { items: Item[] }) => {
  return (
    <div className="space-y-3 w-full min-w-0">
      {/* ============================================================== */}
      {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
      {/* ============================================================== */}
      <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Producto</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Categoría</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Stock</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Precio Final</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200 w-28">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {item.category}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{item.stock} u.</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                  ${item.price.toLocaleString("es-AR")}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-600 dark:text-slate-200 transition-all">
                      <Pencil size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================== */}
      {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
      {/* ============================================================== */}
      <div className="block md:hidden space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5 transition-all"
          >
            {/* Zona 1: Badges superiores */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                  {item.category}
                </span>
                {item.supplier && (
                  <span className="inline-flex items-center rounded-full bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                    {item.supplier}
                  </span>
                )}
              </div>

              {/* Badge de Stock con punto de estado */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{item.stock} u.</span>
              </span>
            </div>

            {/* Zona 2: Nombre del Producto */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                {item.name}
              </h3>
            </div>

            {/* Zona 3: Precio Principal & Botones Circulares de Acción */}
            <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  PRECIO FINAL
                </p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  ${item.price.toLocaleString("es-AR")}
                </p>
              </div>

              {/* Acciones Circulares Accesibles (Touch-Friendly) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs"
                  title="Código de barras"
                >
                  <Barcode size={15} />
                </button>
                <button
                  type="button"
                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs"
                  title="Editar registro"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs"
                  title="Más opciones"
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. Accompanying Mobile Rules

When transforming tables to cards and encapsulating filters on mobile, always apply these complementary rules:

1. **Toolbar Filters (No Cluttered Stacks or Horizontal Scrollbars)**:
   - Avoid horizontal overflow rows of tabs/pills (`overflow-x-auto`) on mobile toolbar strips.
   - Avoid dumping multiple `<select>` dropdowns directly onto mobile screens.
   - Encapsulate all secondary filters into an **Advanced Filters Modal** accessed via `[ ☷ Filtros avanzados ]` located directly beneath the search input.
2. **Pagination Controls (No Screen Overflow)**:
   - On screens `< 380px`, hide first/last page jump buttons (`«` and `»` via `hidden sm:inline-flex`).
   - Keep only `< Anterior`, `Página X / Y`, and `Siguiente >`.
3. **Empty States**:
   - Provide an empty state container matching the cards' border radius: `rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center`.
4. **Touch Targets**:
   - Every action button inside mobile cards must have minimum clickable bounds of at least `32x32px` (`h-8 w-8`) with adequate padding and active tap feedback (`active:scale-95`).

---

## 7. Implementation Checklist for Any Table in POS V2

- [ ] Table is hidden on mobile: `hidden md:block` on the `<table>` wrapper.
- [ ] Card list is visible only on mobile: `block md:hidden`.
- [ ] Each item is rendered as an independent elevated card (`rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900`).
- [ ] Status badges are pill-shaped with colored status dots (`●`).
- [ ] Main KPI/amount has an uppercase micro-label above it and bold font size.
- [ ] Action buttons are circular (`!rounded-full h-8 w-8`).
- [ ] Search strip contains search input on top (`w-full`) with optional integrated camera scanner.
- [ ] Secondary filters are **encapsulated** into a modal/sheet triggered by `[ ☷ Filtros avanzados ]` directly beneath the search input.
- [ ] Active filter count is shown in a blue badge (`activeFiltersCount > 0`).
- [ ] No horizontal scrolling required on mobile to see essential item details or filters.
- [ ] Tested and verified in dark/midnight mode with high-contrast visible borders.
