# POS V2 - Repository Guidelines & Agent Rules

## UI & Dark Mode Contrast Standard
When creating, editing, or styling any user interface component (pages, modals, forms, tables, inputs, buttons):
1. **Always follow the `dark-mode-contrast` skill** located at [SKILL.md](file:///.agents/skills/dark-mode-contrast/SKILL.md).
2. **Form Inputs**: Every `<input>`, `<select>`, `<textarea>`, and `.ui-input` must have a clearly visible border against its container (`border-slate-300 dark:border-slate-700` or `#3f3f46` in dark mode) and elevated surface (`dark:bg-slate-900/90` or `#18181b`). Never allow inputs to look like unbordered "black holes".
3. **Labels**: Always provide high contrast for form labels using `text-slate-700 dark:text-slate-200`. Optional/helper indicators must use `dark:text-slate-400`.
4. **Modals & Cards**: Avoid raw opacity overlays like `bg-slate-50/40`. Always pair card and modal containers with explicit dark styles (e.g. `dark:bg-slate-800/50 dark:border-slate-700/80`).
5. **Ghost / Cancel Buttons**: Ensure secondary buttons have a visible border and light text in dark mode (`dark:border-slate-700 dark:text-slate-200`).
6. **Browser Suggestions & Autocomplete**: Always disable browser autocomplete suggestions on entity forms (customers, suppliers, products) by adding `autoComplete="off"` to `<form>` and `autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-lpignore="true"` to input fields.
