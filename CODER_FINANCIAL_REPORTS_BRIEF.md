# MaggiePM — Financial Reports Business Logic Fix

**File to edit:** `src/components/FinancialReports.tsx` (only file that needs changes)  
**Deploy:** Push to `master` → Vercel auto-deploys

---

## The Problem (Read This First)

The current report mixes up two completely different financial perspectives into one view. Maggie's business model needs to be understood before touching any code:

- **Gross Rental Income** (e.g. $17,000/mo for unit 42E) — this is the *owner's* money. It's rent collected on their behalf. It is NOT MHG's revenue.
- **Management Fee** (e.g. $850/mo = 5% of rent) — this is MHG's actual cut. It's revenue *for Maggie's company* and simultaneously an *expense/deduction for the owner*.
- **All other expenses** (taxes, maintenance, insurance, CC, utilities, other) — these are purely the owner's costs.

Right now the report treats mgmt fee as just another expense in a flat list. This is wrong in two ways:
1. It buries MHG's actual revenue (mgmt fees) inside a generic "expenses" bucket
2. The PDF sent to owners doesn't clearly call out the mgmt fee as a separate line deduction — it's mixed in with taxes and repairs

The fix requires **two distinct views** of the same data: one for **owners** (what Maggie sends them) and one for **MHG internally** (Maggie's own business P&L).

---

## What to Build

### 1. Add a View Toggle — "Owner View" vs "Internal View"

Add a segmented toggle button next to the existing Export PDF and Add Expense buttons:

```
[ Owner View ]  [ Internal View ]    [Export PDF]  [+ Add Expense]
```

Use a `useState<'owner' | 'internal'>` defaulting to `'owner'`. This toggle controls:
- What the summary cards show
- What the property cards show
- What the PDF contains

---

### 2. Owner View — What Maggie Sends to Property Owners

This is the default view. It answers the question: *"Here's what happened with your property this month."*

**Summary cards (4 boxes, replace existing):**
| Card | Value | Color |
|------|-------|-------|
| Gross Rental Income | `totals.income` | green |
| Management Fee | `totals.mgmt` | amber/gold (`var(--accent)`) |
| Total Expenses | `totals.maintenance + totals.taxes + totals.insurance + totals.utilities + totals.cc + totals.other` (does NOT include mgmt fee) | red |
| Net to Owner | `totals.income - totals.mgmt - otherExpenses` | green or red |

Note: "Net to Owner" = what the owner actually pockets after paying MHG and all costs.

**Property card expanded view** — show a proper statement layout for each month:

```
Gross Rental Income         $17,000
  — Management Fee             -$850     ← indented, labeled "MHG Fee"
  — Real Estate Tax          -$4,250
  — Maintenance                  -$0
  — Common Charges               -$0
  — Insurance                    -$0
  — Utilities                    -$0
  — Other                        -$0
                             ─────────
Net to Owner                $11,900
```

Mgmt fee should be visually distinct — slightly different color (amber/gold) and labeled **"MHG Management Fee"** so the owner sees clearly that it's Maggie's charge, not a third-party expense.

**Property card header (collapsed)** — show:
- Property address (existing)  
- "Income" column → rename to "Gross Rent"
- "Net" column → rename to "Net to Owner"

---

### 3. Internal View — MHG's Business P&L

This view answers: *"How is Maggie's company doing?"*

**Summary cards (4 boxes):**
| Card | Value | Color |
|------|-------|-------|
| Gross Rental Income | `totals.income` | green (context) |
| **MHG Revenue** | `totals.mgmt` | green (this is MHG's money!) |
| Owner Expenses Paid | `otherExpenses` (no mgmt fee) | amber |
| Total Owner Net | `totals.income - totals.mgmt - otherExpenses` | neutral |

The key difference: in the Internal View, **MHG Revenue** (mgmt fees) is highlighted in green as income, not buried as an expense. This is what Maggie uses to track her company's performance.

**Property card** — same expanded layout as Owner View, but with an additional callout at the top of each card:

```
MHG Fee Earned:  $850   ← small green badge/pill at top right of card header
```

---

### 4. Update the Export PDF Button

The PDF should reflect whichever view is active. Two different PDF formats:

#### Owner Statement PDF (when `view === 'owner'`):

**Header:**
```
MH Group — Property Statement
[Property Address + Unit] — [Month/Period]
Prepared by: Maggie Huang Group Property Management
Generated: [date]
```

**Summary boxes (3):** Gross Rental Income | MHG Management Fee | Net to Owner

**Table columns:**
```
Property | Month | Gross Rent | MHG Mgmt Fee | Maintenance | Taxes | Insurance | CC | Utilities | Other | Net to Owner
```

Mgmt Fee column header should be styled distinctly (e.g. gold/amber header background) to make it clear it's MHG's charge.

**Footer:** `"This statement is prepared by MH Group Property Management and is confidential."`

#### Internal P&L PDF (when `view === 'internal'`):

**Header:**
```
MH Group — Internal P&L Report
[Period] | CONFIDENTIAL — Internal Use Only
Generated: [date]
```

**Summary boxes (4):** Gross Rental Income | MHG Revenue (Mgmt Fees) | Owner Expenses | Owner Net

**Table columns:** Same as current PDF — no changes needed here.

**Footer:** `"MH Group — Internal Document. Not for distribution."`

---

### 5. Relabel Throughout (Both Views)

These label changes apply everywhere — cards, property rows, PDF, collapsed headers:

| Old Label | New Label |
|-----------|-----------|
| "Total Income" | "Gross Rental Income" |
| "Net Income" | "Net to Owner" (owner view) or "Owner Net" (internal) |
| "Mgmt Fee" | "MHG Management Fee" |
| "Margin" | Keep as-is, but calculate as `netToOwner / grossIncome` |

---

### 6. No Database Changes Needed

All the data already exists in `monthly_pnl` view:
- `rental_income` = gross rent
- `mgmt_fee_expense` = MHG's management fee
- All other expense columns = owner's costs

This is purely a **UI/labeling/calculation change** in `FinancialReports.tsx`. No Supabase schema changes, no new API calls.

---

## Summary Checklist

- [ ] Add `view: 'owner' | 'internal'` state, default `'owner'`
- [ ] Toggle UI next to Export PDF button
- [ ] Owner View: 4 summary cards with correct labels + values
- [ ] Owner View: property card expanded shows statement-style layout with MHG fee as a separate named deduction
- [ ] Internal View: 4 summary cards with MHG Revenue highlighted green
- [ ] Internal View: property card shows MHG fee earned badge per property
- [ ] PDF — Owner Statement format when `view === 'owner'`
- [ ] PDF — Internal P&L format when `view === 'internal'`
- [ ] All labels updated: "Gross Rental Income", "Net to Owner", "MHG Management Fee"

**Commit message:** `feat: owner vs internal financial view, correct mgmt fee framing, dual PDF formats`
