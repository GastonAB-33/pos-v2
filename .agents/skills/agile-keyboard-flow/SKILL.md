---
name: agile-keyboard-flow
description: >-
  Standard and implementation pattern for ultra-agile, keyboard-first modal workflows,
  list navigation with ArrowUp/ArrowDown, dynamic split-amount allocation with Enter,
  dual KPI header tracking (Total vs Pending), and fast autofocus selector sub-modals across POS V2.
---

# Agile Keyboard-First Flow Pattern

This skill establishes the UX/UI contract, keyboard interaction rules, and component architecture for high-speed, keyboard-driven operational workflows in POS V2 (such as the POS Checkout Modal, Purchase Registration, Cash In/Out, and Stock Movement dialogs).

---

## 1. Core Objectives & Philosophy

1. **Zero-Mouse Operational Flow**: Cashiers and warehouse operators must be able to complete 100% of common actions without lifting their hands from the keyboard.
2. **Instant 1-Key Close**: If an operation is standard (e.g., full cash payment), hitting `Enter` immediately confirms and finalizes the transaction.
3. **Dual KPI Header Visibility**: At all times, the user must see both the **Target Total** and the **Remaining Pending Amount** in high-contrast KPI cards.
4. **Dynamic Remainder Allocation**: Navigating to an item and pressing `Enter` automatically allocates the remaining pending balance to that item.
5. **Autofocus Search Sub-Modals**: When an item requires choosing a linked entity (e.g., choosing a customer for current account / fiado), the sub-modal opens with the search input immediately focused and cursor blinking, ready to type, navigate with arrows, and select with `Enter`.

---

## 2. Interaction Contract & Keybindings

| Key / Shortcut | Context | Expected Action |
| :--- | :--- | :--- |
| **`ArrowDown` (↓)** | Main List / Search Results | Moves highlight to the next available item/row. |
| **`ArrowUp` (↑)** | Main List / Search Results | Moves highlight to the previous item/row. |
| **`Enter` (↵)** | Row with $0 & Pending > 0 | Automatically fills the remaining pending balance into this row. |
| **`Enter` (↵)** | Row when Total is 100% covered | Submits and finalizes the transaction instantly. |
| **`Enter` (↵)** | Unassigned Entity Trigger | Opens the fast selector sub-modal (e.g., `PosCustomerSelectModal`). |
| **`Enter` (↵)** | Active Search Result in Sub-Modal | Selects highlighted entity, closes sub-modal, returns focus. |
| **`Escape` (Esc)** | Sub-Modal / Modal | Closes the current modal or sub-modal without committing invalid state. |
| **Typing Numbers** | Active Row Input | Adjusts row allocation in real-time, dynamically updating `Total Pendiente`. |

---

## 3. UI Architecture: 4 Essential Layers

### Layer A: Dual KPI Header (Live Remainder Tracking)
Place two prominent cards at the top of the modal:
1. **Total a Pagar / Subtotal**: Always displays the gross target amount (with currency badge and rounding if applicable).
2. **Total Pendiente / Resta Cubrir**:
   - `Pending > 0`: Warning amber/orange tone (`bg-amber-50 dark:bg-amber-950/50 border-amber-300`).
   - `Pending === 0`: Emerald confirmation tone with checkmark (`bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-800`).
   - `Pending < 0` (Overpaid): Rose error tone (`bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-800`).

### Layer B: Unified Keyboard-Navigable Item List
Instead of separate tabs or fragmented grids:
- Render a unified, vertical list of options.
- The active row has a high-contrast focus ring (`ring-2 ring-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-950/40`).
- Rows with assigned amount `> 0` feature an emerald accent (`border-emerald-400 dark:border-emerald-600 bg-emerald-50/20`).
- To the right: a dedicated numeric input (`$ ...`) allowing manual split amounts.

### Layer C: Inline Dual-Box Controls (e.g., Cuenta Corriente)
When a payment method or line item depends on an associated record:
- Divide the row's action area into **two distinct boxes**:
  1. **Box 1 (Amount Input)**: Standard amount field.
  2. **Box 2 (Entity Selector Trigger)**:
     - Unassigned: High-contrast blinking/accent button `[ + Elegir Cliente (Enter) ]`.
     - Assigned: Badge showing entity name, key identifier (e.g. DNI/CUIT), and live credit balance.
- Hitting `Enter` or clicking on Box 2 opens the fast lookup sub-modal.

### Layer D: Fast Autofocus Search Sub-Modal
When opening the lookup dialog:
1. Use an autofocus `ref` (`window.setTimeout(() => inputRef.current?.focus(), 50)`).
2. Real-time filtering as the user types letters or numbers.
3. Arrow keys navigate up/down through filtered items.
4. `Enter` commits the selection and returns focus.
5. Provide a one-click/Enter fallback: `+ Crear nuevo "[lo que escribió]"`.

---

## 4. Bank Accounts & Tenant Integration Pattern

When dealing with bank transfers (e.g. Patricia vs Octavio in tenant `la25`):
1. **Catalog Configuration (`bancos` module)**:
   - Bank accounts have a flag `is_pos_available: boolean` (default: `true`).
   - In the `bancos` table and modal, users can toggle which accounts accept POS payments.
2. **Dynamic Expansion in POS**:
   - The POS query retrieves active bank accounts where `is_pos_available !== false`.
   - Each POS-enabled account is rendered as a first-class payment method option in the checkout list (e.g. `Transferencia Banco Galicia (Patricia)`).
   - Selecting that row automatically tags `destination_account_id` and records the income in that specific bank account upon checkout.

---

## 5. Dark Mode & Contrast Standard (`dark-mode-contrast` compliance)

All components implementing this skill MUST follow:
- Visible borders on all inputs and cards: `border-slate-300 dark:border-slate-700`.
- Elevated surface backgrounds: `bg-white dark:bg-slate-900/90`. Never pure black holes.
- Disable browser autocomplete on operational inputs:
  `autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-lpignore="true"`.
- Focus outlines: clear `ring-2 ring-indigo-500 dark:ring-indigo-400`.
