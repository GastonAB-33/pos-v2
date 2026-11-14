# POS V2 - Repository Guidelines & Agent Rules

## UI, Dark Mode Contrast & Rounded Design Standard
When creating, editing, or styling any user interface component (pages, modals, forms, tables, inputs, buttons):
1. **Always follow the `dark-mode-contrast` skill** located at [SKILL.md](file:///.agents/skills/dark-mode-contrast/SKILL.md).
2. **Always follow the `modern-rounded-design` skill** located at [SKILL.md](file:///.agents/skills/modern-rounded-design/SKILL.md):
   - **Header & Toolbars**: Float clean directly on the page background without an outer square wrapper border. Use uppercase breadcrumbs (`SECTION › MODULE`).
   - **Action Buttons**: Top action buttons must be pill-shaped (`rounded-2xl` or `rounded-full`). Primary action in vivid blue (`bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-5 py-2`), secondary actions in white/dark elevated pill buttons (`border border-slate-200/90 dark:border-slate-700/80 rounded-2xl px-4 py-2`).
   - **Search & Filter Strips**: Enclosed in a unified elevated card panel with `rounded-2xl sm:rounded-3xl`, containing rounded search inputs (`rounded-xl sm:rounded-2xl`), category dropdowns with `ChevronDown`, and filter trigger buttons.
   - **Tables & Lists**: Wrap in `rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden` with soft header backgrounds (`bg-slate-50/90 dark:bg-slate-800/70`), pill badges (`rounded-full`), and circular row action buttons (`!rounded-full`).
   - **Pagination & Disclosures**: Use `rounded-2xl` containers with `rounded-xl` pagination and trigger buttons.
   - **Modals**: Modal containers must use `rounded-2xl sm:rounded-3xl`, inner cards `rounded-xl`, inputs `rounded-xl`, and footer buttons `rounded-xl`.
3. **Always follow the `mobile-data-cards` skill** located at [SKILL.md](file:///.agents/skills/mobile-data-cards/SKILL.md):
   - Whenever designing, refactoring, or displaying tabular data, never force dense data tables on mobile screens with cut-off horizontal scrolling.
   - Transform data tables into clean, individual, touch-friendly cards on mobile (`block md:hidden`), keeping traditional tables only on desktop/tablet (`hidden md:block`).
   - Each mobile card must organize information into clear micro-hierarchies: Category/status pill badges on top, bold item title, prominent main KPI (Price/Total), optional secondary metrics sub-panel, and circular touch action buttons (`!rounded-full h-8 w-8`).
   - **Mobile Filter Encapsulation**: Never clutter mobile search bars with multiple dropdowns or horizontal scrolling tabs. Secondary filters (categories, statuses, suppliers, date ranges) must be encapsulated inside an advanced filters modal/drawer triggered by a `[ ☷ Filtros avanzados ]` button placed directly beneath the search input.
4. **Form Inputs**: Every `<input>`, `<select>`, `<textarea>`, and `.ui-input` must have a clearly visible border against its container (`border-slate-300 dark:border-slate-700` or `#3f3f46` in dark mode) and elevated surface (`dark:bg-slate-900/90` or `#18181b`). Never allow inputs to look like unbordered "black holes".
5. **Labels**: Always provide high contrast for form labels using `text-slate-700 dark:text-slate-200`. Optional/helper indicators must use `dark:text-slate-400`.
6. **Modals & Cards**: Avoid raw opacity overlays like `bg-slate-50/40`. Always pair card and modal containers with explicit dark styles (e.g. `dark:bg-slate-800/50 dark:border-slate-700/80`).
7. **Ghost / Cancel Buttons**: Ensure secondary buttons have a visible border and light text in dark mode (`dark:border-slate-700 dark:text-slate-200`).
8. **Browser Suggestions & Autocomplete**: Always disable browser autocomplete suggestions on entity forms (customers, suppliers, products) by adding `autoComplete="off"` to `<form>` and `autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-lpignore="true"` to input fields.
