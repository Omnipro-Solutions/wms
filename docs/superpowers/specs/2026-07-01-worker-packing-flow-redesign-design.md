# Worker Packing Flow Redesign — Design

**Date:** 2026-07-01
**Status:** Approved

## Problem

`src/app/(worker)/worker/packing/[orderId]/page.tsx` does not verify anything real during the "items" step. A generic button increments a local `scannedCount` without regard to which product line it corresponds to, without comparing against `order.items[]`, and without error handling. This is inconsistent with the sibling worker flows:

- `worker/receiving/[asnId]/page.tsx` uses `BarcodeScanner` + `ErrorBanner` + retry, with a manual-skip fallback.
- `worker/picking/task/[taskId]/page.tsx` uses `ScanInput` (typed scan with match/error state) for both location and product verification.

Symptom previously reported: packer flow "passes through" without requiring any scan (already partially root-caused and fixed — `scanItem` threw when `startPacking` was never called on the no-rules path). This design closes the remaining gap: the items step has no real per-line verification at all.

## Store change — `scanItem`

Current signature: `scanItem(packingOrderId: string, qty: number): PackingOrder` — mutates only the aggregate `order.scannedItems` counter. Only caller is the packing page.

New signature: `scanItem(packingOrderId: string, productId: string, qty: number): PackingOrder`

Behavior:
- Finds the order; throws if not found or not `in_progress` (unchanged guard).
- Finds the matching line in `order.items` by `productId`; throws if no matching line.
- Adds `qty` to that line's `scannedQuantity`, clamped to `requestedQuantity`.
- Recomputes order-level aggregates from all lines:
  - `scannedItems = sum(items[].scannedQuantity)`
  - `verificationStatus = 'verified'` when every line's `scannedQuantity === requestedQuantity`, else `'pending'`

This fixes the underlying data bug where an order with one line at `requestedQuantity: 2` displayed a generic "Producto" label on the second scan — scanning is now per-line, one scan confirms the full line quantity.

## Page change — `worker/packing/[orderId]/page.tsx`

Steps: `rules → items → box → label → done` (unchanged step names/order).

- **rules** — unchanged. Informational only; shows `activeRules` derived from `appliedRuleIds`. No `applyPackingRule`/`removePackingRule` interaction added (out of scope).
- **items** — rewritten:
  - Iterates `order.items[]` by line, not by unit. The current line is the first with `scannedQuantity < requestedQuantity`.
  - Renders product image (if present), name, SKU, and requested quantity for the current line.
  - Renders `ScanInput` with `expectedValue = product.barcode ?? product.sku`, looked up from the `products` store slice by `item.productId`.
  - On match: calls `scanItem(order.id, item.productId, item.requestedQuantity)` — one scan confirms the whole line quantity. Advances to the next pending line, or to `box` step when no lines remain pending.
  - On mismatch: `ScanInput`'s built-in error state fires; page also surfaces an `ErrorBanner` with the scanned value vs. expected code, consistent with the receiving page's error copy pattern.
  - Includes a "Omitir verificación" ghost button (same pattern as receiving) that calls the same confirm path without requiring a real scan match — keeps the flow usable in the demo environment without physical scanner hardware.
  - `startPacking` is still called on first entry into `items` when `order.status === 'pending'` (existing fix, retained).
- **box**, **label**, **done** — unchanged. `generateLabel` in the store already guards on `verificationStatus === 'verified'`, which now reflects true per-line completion.

## Out of scope

- No changes to `applyPackingRule`, `removePackingRule`, `selectBox`, `generateLabel`, `sendToShipping`.
- No new scanning hardware/component — reuses existing `ScanInput`.
- No seed data changes required — line-based iteration (not unit-based) already handles orders like `demo-pk-1` (1 line, `requestedQuantity: 2`) correctly.
- `ErrorBanner` stays duplicated inline (same as it already is between receiving and picking pages) rather than being extracted to a shared component — consistent with existing repo pattern, avoids an unrequested refactor.

## Testing

- Manual verification per `superpowers:verification-before-completion`: walk `demo-pk-1` (no rules, 1 line qty 2), `pk-eco-2` (no rules, 1 line qty 1, already `in_progress`), and an order with `appliedRuleIds` set (`pk-b2b-1`, though already `labelled` — verify via a fresh in-progress+rules fixture if needed) through the full flow in the browser.
- Confirm mismatch path shows error and allows retry.
- Confirm "Omitir verificación" still allows completing the flow end to end.
