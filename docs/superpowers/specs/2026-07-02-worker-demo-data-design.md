# Worker demo data fixes — design

**Date:** 2026-07-02
**Status:** Approved

## Problem

Worker mobile views (recepcionista, picker, packer) demo poorly:

1. `/worker/receiving` shows only one devolución and "no hay citas asignadas" for María Recepcionista, even though a demo ASN exists in seed data.
2. Receiving worker flow has no label print step, unlike packing.
3. Recepcionista cannot take a real action on a devolución beyond a generic "Avanzar estado" button.
4. Picker step 2 (scan location + product) and packer per-line scan step have no documented demo codes to type/scan live.

## Root cause (bug #1)

`src/app/(worker)/worker/receiving/page.tsx` filters ASNs with
`a.appointmentDate.startsWith(today)` — an exact-date match. The demo ASN
(`demo-asn-inbound`, `appointmentDate: '2026-07-01'`) fell behind the current
date (2026-07-02) and was silently excluded. Only the devolución (not
date-gated) still showed. This will keep breaking every day the demo runs
past the seeded date.

## Changes

### 1. Receiving list filter — date-drift proof

`src/app/(worker)/worker/receiving/page.tsx`: change the ASN filter from
exact-date match to "status pending/in_progress AND `appointmentDate <=
today`", sorted soonest first (in_progress before pending, as today). This
survives any amount of date drift between seed data and demo day.

### 2. Seed data additions

`src/data/seed.ts`, DEMO DATA block:

- Add `demoAsn2` — second ASN assigned conceptually to the receiving flow
  (different supplier/product than `demoAsnInbound`), dated recent-past
  (e.g. `2026-06-30`), so the receiving worker view shows more than one card.
- Add `demoReturnOrder2` — second devolución in status `under_validation`
  (distinct from the existing `demo-ret-1` at `received_at_dc`), so the new
  inspection UI (below) has a return ready for inspection, not just one
  waiting to be advanced into validation.
- No changes to picking seed data — barcodes are already complete
  (`LOC-A-A0101`, `7700000000011`, etc.). Codes get documented in
  `DEMO-SCRIPT.md` only.
- No changes to packing seed data — scan codes already exist
  (`7700000000103`, etc.) and are already documented; verify accuracy only.

### 3. Receiving detail — print label step

`src/app/(worker)/worker/receiving/[asnId]/page.tsx`: insert a `print-label`
step between `putaway` and `done`. Reuses `printReceiptLabel(labelId)`
(already in the store — receipt labels are created inside `receiveAsn`).
Screen shows the generated label code and an "Imprimir" button (mock, no
`window.print()`), mirroring the visual pattern of the packing flow's
`label` step. On confirm, advance to `done`.

### 4. Devolución — real inspection + disposition flow

`src/app/(worker)/worker/returns/page.tsx`: replace the single generic
"Avanzar estado" button with:

- If return is `received_at_store` / `received_at_dc`: show "Avanzar a
  validación" button → `advanceReturn()` (existing FSM step, unchanged).
- If return is `under_validation`: show an inspection form — condition per
  item (large tap targets: Bueno / Dañado), quantity, optional notes →
  `inspectReturn(returnId, inspectorName, items, notes)` (existing store
  action).
- After inspection, show 4 large disposition buttons: Reingreso / Scrap /
  Reparación / Control de Calidad → `setReturnDisposition()` (existing store
  action).

Out of scope: executing the reentry/scrap/repair ticket itself
(`executeReentry`, `executeScrap`, `createRepairTicket`) — those move real
inventory and remain supervisor desktop actions, unchanged.

### 5. DEMO-SCRIPT.md updates

- Document exact picker scan codes for step 2 (location barcode + product
  barcode) using existing seed data — no new fixtures.
- Verify packer scan codes already documented are still accurate against
  current seed; fix any drift.
- Add the new receiving print-label step and the new devolución inspection
  flow to the relevant script steps.

## Non-goals

- No changes to picking or packing seed data (already complete).
- No new store actions — every action used above already exists.
- No changes to reentry/scrap/repair execution UI.

## Design constraints (carried from CLAUDE.md)

- Mobile/tablet-first, large tap targets, minimal steps.
- Arrow function components, clause guards for loading/empty/error states.
- Reuse `<WorkerCard>`, existing step-pattern from packing's label step.
- No new dependencies.
