---
name: dark-mode-contrast
description: >-
  Guidelines, tokens, and contrast standards for designing and implementing UI components,
  forms, inputs, modals, and tables in dark mode and midnight mode across POS V2.
---

# Dark Mode & Midnight Mode Contrast Guidelines

This skill defines the mandatory contrast, token conventions, and design standards to ensure that all UI components in POS V2 remain high-contrast, visually structured, and accessible (WCAG AA compliant) in both `dark` (`html.dark`) and `midnight` (`html.midnight`) themes.

---

## 1. Core Principles

1. **No Hollow "Black Hole" Inputs**:
   Inputs must never render as borderless, flat black cut-outs inside dark or gray cards. Every input field (`<input>`, `<select>`, `<textarea>`, `.ui-input`) must have a distinct border (`#3f3f46` / `dark:border-slate-700`) and a slight surface elevation or defined background (`#18181b` / `dark:bg-slate-900/90`).

2. **No Unadapted Light Utility Classes**:
   Tailwind classes designed for light mode (such as `text-slate-700`, `text-slate-500`, `border-slate-200`, `bg-slate-50`) must **always** be paired with their dark mode counterparts (`dark:text-slate-200`, `dark:text-slate-400`, `dark:border-slate-700`, `dark:bg-slate-800/50`).

3. **Avoid Raw Alpha Modifiers on Light Grays**:
   Classes like `bg-slate-50/40` or `bg-white/10` create a muddy gray film over dark backgrounds. Always define an explicit dark background with border:
   `bg-slate-50/70 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/80`.

4. **Minimum 3:1 Contrast for UI Controls & Borders**:
   Every interactable control boundary (inputs, buttons, tabs, card frames) must meet at least 3:1 contrast against its surrounding container.

---

## 2. Standard Color Tokens & Hierarchy

| Role | Light Mode | Dark (`html.dark`) | Midnight (`html.midnight`) | Tailwind Utility Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| **App Canvas / Page** | `#f9f9ff` (`--ui-bg`) | `#09090b` (`--ui-bg`) | `#0b132b` (`--ui-bg`) | `bg-slate-100 dark:bg-zinc-950` |
| **Cards & Modals** | `#ffffff` (`--ui-surface`) | `#121215` (`--ui-surface`) | `#111c38` (`--ui-surface`) | `bg-white dark:bg-slate-900` |
| **Inner Sub-containers** | `#f2f4f7` (`--ui-surface-2`) | `#1c1c21` (`--ui-surface-2`) | `#1b284f` (`--ui-surface-2`) | `bg-slate-50 dark:bg-slate-800/50` |
| **Visible Borders** | `#d9dee8` (`--ui-border`) | `#3f3f46` (`--ui-border`) | `#33477d` (`--ui-border`) | `border-slate-200 dark:border-slate-700` |
| **Input Background** | `#ffffff` / `#f2f4f7` | `#18181b` | `#16213e` | `bg-white dark:bg-slate-900/90` |
| **Input Border (Rest)** | `#d9dee8` | `#3f3f46` (zinc-700) | `#33477d` (navy-600) | `border-slate-300 dark:border-slate-700` |
| **Input Border (Hover)** | `#b0b8c8` | `#52525b` (zinc-600) | `#435b9c` | `hover:border-slate-400 dark:hover:border-slate-600` |
| **Input Focus Ring** | Accent (blue) | Accent (blue ring) | Accent (sky ring) | `focus:border-blue-500 focus:ring-2` |
| **Primary Text** | `#101828` (`--ui-text`) | `#fafafa` (`--ui-text`) | `#f8fafc` (`--ui-text`) | `text-slate-900 dark:text-slate-100` |
| **Form Labels** | `#344054` | `#e4e4e7` (zinc-200) | `#f1f5f9` (slate-100) | `text-slate-700 dark:text-slate-200 font-medium` |
| **Muted / Optional Text** | `#667085` | `#a1a1aa` (zinc-400) | `#94a3b8` (slate-400) | `text-slate-500 dark:text-slate-400` |
| **Ghost Button Border** | `#d9dee8` | `#3f3f46` | `#33477d` | `border-slate-300 dark:border-slate-700` |
| **Ghost Button Text** | `#344054` | `#e4e4e7` | `#f1f5f9` | `text-slate-700 dark:text-slate-200` |

---

## 3. UI Component Patterns

### 3.1 Form Inputs (`.ui-input` or Tailwind Inputs)
```tsx
// Using global class:
<input className="ui-input" placeholder="Nombre..." />

// Using Tailwind directly:
<input
  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400"
/>
```

### 3.2 Form Labels & Optional Markers
```tsx
<label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
  Razón social <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
  <span className="text-red-500 dark:text-red-400 ml-1">*</span>
</label>
```

### 3.3 Modal Containers & Section Cards
```tsx
// Modal Shell:
<div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-panel dark:border dark:border-slate-800 dark:bg-slate-900">
  {/* Header */}
  <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Título</h3>
    <ModalCloseButton onClick={onClose} />
  </div>

  {/* Inner Section Card */}
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
    {/* Form Fields */}
  </div>

  {/* Footer */}
  <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
    <button type="button" className="ui-btn-ghost" onClick={onClose}>Cancelar</button>
    <button type="submit" className="ui-btn-primary">Guardar</button>
  </div>
</div>
```

### 3.4 Segmented Tabs
```tsx
<div className="inline-flex rounded-xl bg-slate-100 p-1 dark:border dark:border-slate-700/60 dark:bg-slate-800/80">
  <button
    type="button"
    className={cn(
      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white dark:shadow-none"
        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
    )}
  >
    Pestaña
  </button>
</div>
```

### 3.5 Summary / KPI Mini-Cards inside Modals
```tsx
<div className="grid gap-2 sm:grid-cols-4">
  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/80">
    <span className="block text-[11px] text-slate-500 dark:text-slate-400">Estado</span>
    <span className="font-medium text-slate-900 dark:text-slate-100">Activo</span>
  </div>
</div>
```

---

## 4. Implementation Checklist for New Features

Whenever creating or modifying UI components, verify each item before delivery:

- [ ] **Inputs & Controls**: Do inputs have a clearly visible border against whatever card or modal background they sit on?
- [ ] **Focus State**: Does clicking or tabbing into an input show an obvious focus outline/ring?
- [ ] **Labels**: Are labels using `dark:text-slate-200` (or `var(--ui-text-soft)`) rather than low-contrast `text-slate-700`?
- [ ] **Microcopy**: Are helper texts, badges, and optional tags readable with `dark:text-slate-400`?
- [ ] **Card & Panel Backgrounds**: Did you avoid raw opacity overlays like `bg-slate-50/40` without explicit `dark:bg-slate-800/50`?
- [ ] **Secondary Actions**: Is the "Cancelar" / ghost button clearly delineated with a visible border and readable text?
- [ ] **Theme Switching**: Does the component look polished in both standard `dark` mode and `midnight` mode?
