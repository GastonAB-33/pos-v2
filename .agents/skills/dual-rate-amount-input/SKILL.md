---
name: dual-rate-amount-input
description: >-
  Design standard and component pattern for dual-mode inputs that allow switching
  between percentage rates (%) and fixed monetary amounts ($), such as tax withholdings,
  IIBB perceptions, discounts, and payment surcharges across POS V2.
---

# Dual Rate & Amount Input Pattern (`%` / `$`)

This skill defines the UX/UI standards and implementation guide for inputs that allow users to enter either a **percentage rate (%)** or a **fixed monetary amount ($)** in a compact, single-row interface without cluttering the screen.

---

## 1. When to Use This Pattern

Use this component pattern whenever a fiscal, accounting, or commercial value can be expressed as either a percentage of a base subtotal or as an absolute fixed sum. Common examples:

1. **Tax Perceptions & Withholdings (IIBB / Gross Income Tax, IVA Perceptions)**:
   - Some vendor purchase invoices specify an IIBB rate (e.g., `3.5%`), while others only print the final perceived amount (e.g., `$ 150.00`).
2. **Global Discounts (Sales, Purchases, POS)**:
   - Operators often need to apply either a percentage discount (e.g., `10%`) or a fixed cash discount (e.g., `$ 500.00`).
3. **Payment Method Surcharges & Interest**:
   - Card plans or financing fees that can be entered as an APR percentage or a fixed administrative surcharge fee.
4. **Profit Margins / Markups on Products**:
   - Setting a target markup percentage vs. fixing a specific profit amount per unit.

---

## 2. Core UX & Visual Design Principles

1. **Ultra-Compact Footprint**:
   - The component MUST fit in the exact same footprint as a standard single input and badge.
   - Do NOT stack inputs or create multi-line form rows for rate vs. amount.

2. **Always Show Both Perspectives**:
   - When the user selects **`%`**, the input displays the editable percentage, and an adjacent badge/label displays the computed monetary amount in parentheses:
     `[% | $] IIBB: [ 3.50 ] → ($ 107.44)`
   - When the user selects **`$`**, the input displays the editable monetary amount, and the adjacent badge displays the calculated effective percentage:
     `[% | $] IIBB: [ 150.00 ] → (4.88 %)`
   - This provides instant confirmation against paper invoices without mental math.

3. **Alternating Toggle Button (Mobile & Desktop Ergonomics)**:
   - The toggle is integrated directly ahead of the concept label:
     `[ % | $ ] Concept:`
   - The entire pill acts as a **single unified toggle button**: tapping or clicking anywhere on it alternates between `%` and `$`. This eliminates tiny touch targets on mobile and guarantees reliable switching on touchscreen devices.
   - Shows both `%` and `$` indicators with the active mode clearly elevated and highlighted with the accent color.

4. **Seamless Two-Way Conversion**:
   - Switching from `%` to `$` derives the initial dollar amount based on the current subtotal:
     `amount = round(baseTotal * (percent / 100))`
   - Switching from `$` to `%` calculates the corresponding percentage:
     `percent = round((amount / baseTotal) * 100)`

5. **Accessibility & Dark Mode Standards**:
   - Adheres strictly to `dark-mode-contrast`:
     - Inputs use visible borders (`border-slate-300 dark:border-slate-600`).
     - Backgrounds use elevated surfaces (`bg-white dark:bg-slate-950`).
     - Always disables autocomplete suggestions: `autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-lpignore="true"`.

---

## 3. Reusable Component Reference

Import the prebuilt component located at `@/components/ui/DualRateAmountInput`:

```tsx
import {
  DualRateAmountInput,
  type RateAmountMode,
} from "@/components/ui/DualRateAmountInput";
```

### Component Props:

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | *required* | Concept name displayed next to the toggle (e.g. `"IIBB"`, `"Descuento"`) |
| `mode` | `"percent" \| "amount"` | *required* | Current active unit mode |
| `onModeChange` | `(mode) => void` | *required* | State setter when user clicks `%` or `$` |
| `percentValue` | `number` | *required* | Value in percentage (0 to 100) |
| `amountValue` | `number` | *required* | Value in currency amount |
| `baseTotal` | `number` | *required* | Net base subtotal upon which calculations are made |
| `onPercentChange` | `(percent) => void` | *required* | Callback when percentage input changes |
| `onAmountChange` | `(amount) => void` | *required* | Callback when amount input changes |
| `disabled` | `boolean` | `false` | Disables interaction |
| `accentColor` | `"amber" \| "blue" \| "emerald" \| "purple" \| "slate"` | `"amber"` | Badge and highlight color scheme |
| `id` | `string` | `undefined` | HTML id attribute for input |

---

## 4. Usage Example

```tsx
const [mode, setMode] = useState<RateAmountMode>("percent");
const [percent, setPercent] = useState<number>(3.5);
const [amount, setAmount] = useState<number>(0);
const subtotal = 3069.66;

<DualRateAmountInput
  id="purchase-iibb"
  label="IIBB"
  mode={mode}
  onModeChange={setMode}
  percentValue={percent}
  amountValue={amount > 0 ? amount : subtotal * (percent / 100)}
  baseTotal={subtotal}
  onPercentChange={(val) => {
    setPercent(val);
    setAmount(0); // Clear fixed amount so percent takes priority
  }}
  onAmountChange={(val) => {
    setAmount(val);
    const derivedPercent = subtotal > 0 ? (val / subtotal) * 100 : 0;
    setPercent(Math.min(100, Math.round(derivedPercent * 100) / 100));
  }}
  accentColor="amber"
/>
```

---

## 5. Summary Checklist for New Implementations

- [ ] Import `DualRateAmountInput` from `@/components/ui/DualRateAmountInput`.
- [ ] Connect both `percent` and `amount` state variables in the parent form or hook.
- [ ] Pass the appropriate `baseTotal` (e.g. net subtotal before taxes/discounts).
- [ ] Select an `accentColor` that matches the fiscal/commercial context:
  - `amber` for tax perceptions (IIBB).
  - `blue` for VAT / general taxes.
  - `emerald` for discounts and savings.
  - `purple` for payment surcharges and financing fees.
