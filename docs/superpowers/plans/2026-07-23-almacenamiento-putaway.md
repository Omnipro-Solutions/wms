# Almacenamiento y Putaway (Base + Estándar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the current putaway implementation and `docs/funcionalidades_base_wms.md` §3 (Base + Estándar): validate putaway destinations, add a configurable `PutawayRule` engine, add hazard/cold-chain/lot-mixing restrictions, and surface it all in a governed settings page.

**Architecture:** Everything lives in the existing Zustand store (`src/store/wms-store.ts`), persisted whole via the existing custom IndexedDB adapter (`src/lib/idb-storage.client.ts`) — no new persistence layer. A new pure-function engine (`src/lib/rules/putaway.ts`) mirrors the existing `SlottingRule` engine pattern (`src/lib/rules/slotting.ts`) but as an independent type/table (`PutawayRule`), reusing the slotting engine's generic matching/evaluation functions internally (they're generic over the directive shape) rather than duplicating ~120 lines of logic.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Zustand 5 · react-hook-form + zod · shadcn/Radix UI · TailwindCSS 4.

## Global Constraints

- No tests — explicit user instruction for this work. Every task instead ends with a `npx tsc --noEmit` check and, where relevant, a manual dev-server walkthrough.
- All UI copy in Spanish (es-CO), matching the rest of the app.
- Never mutate store state directly — every action spreads (see `holdInventory`/`putawayItem` for the existing pattern).
- Reuse existing components (`Field`/`FieldLabel`/`FieldError`, `Switch`, `Select`, shadcn `Table`/`Dialog`) — do not introduce new UI primitives.
- Follow the CLAUDE.md rule: arrow functions, clause guards before the happy path, `cn()` for conditional classes, no raw `useState` for **new** forms (existing `useState`-based dialogs being extended keep their existing pattern — see Task 8).

---

### Task 0 (folded into Task 1): pre-existing type bug found during research

`npx tsc --noEmit -p .` currently reports **90 errors**, all tracing back to a single misplaced closing brace: `src/types/wms.ts`'s `WmsSettings` interface closes too early (right after `pickingZones: PickingZoneConfig[]`), so every field added for the Packing (#6) and Shipping (#7) modules (`packingFreezeActive`, `shippingFreezeActive`, etc.) ended up declared on `PickingZoneConfig` instead. This breaks `/packing-settings`, `/shipping-settings`, `/shipping`, `/worker/packing/[orderId]`, and parts of `wms-store.ts` and `seed.ts` today, unrelated to this feature. It sits exactly where Task 1 needs to add `putawayFreezeActive`, so Task 1 fixes it as a prerequisite — flag this to the user as an unrelated bug fix once implementation is done.

---

### Task 1: Domain types — restriction fields, `PutawayRule`, settings bug fix

**Files:**
- Modify: `src/types/wms.ts`
- Modify: `src/data/seed.ts` (one-line settings addition, to keep this task's `tsc` check green)

**Interfaces:**
- Produces: `Product.isHazardous?: boolean`, `Product.requiresColdChain?: boolean`; `StorageLocation.hazardApproved?: boolean`, `StorageLocation.temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'`, `StorageLocation.allowsLotMixing?: boolean`; `PutawayRuleMatchType`, `PutawayDirectiveKind`, `PutawayDirective`, `PutawayRule`; `WmsSettings.putawayFreezeActive: boolean`. All consumed by Task 2 onward.

- [ ] **Step 1: Fix the misplaced `WmsSettings`/`PickingZoneConfig` brace**

Open `src/types/wms.ts` and find this block (around line 1216–1270):

```ts
  pickingRequireIssuePhoto: boolean
  pickingAllowSubstitution: boolean
  // Catálogo independiente de zonas de picking (pick-and-pass), desacoplado de
  // StorageLocation.zone para permitir renombrar/reordenar sin tocar ubicaciones.
  pickingZones: PickingZoneConfig[]
}

export interface PickingZoneConfig {
  id: string
  name: string
  sequenceOrder: number // orden de paso en pick-and-pass, ascendente
  active: boolean
  // Packing module (#6) — embalaje. Configured in /packing-settings.
  // Congela iniciar/escanear/completar/aplicar reglas/seleccionar caja/generar etiqueta/enviar a despacho.
  packingFreezeActive: boolean
  // Cartonización: margen de seguridad (fracción) que se reserva sobre el peso/volumen
  // de la caja al sugerirla — 0.1 = usar solo el 90% de la capacidad nominal.
  packingBoxSafetyMargin: number
  // Si está activo, /packing sugiere caja automáticamente por peso+volumen (suggestBox).
  packingAutoBoxSuggestion: boolean
  // Verificación de contenido: si está activo, exige escaneo 1:1 (esperado === escaneado)
  // antes de poder completar el packing.
  packingRequireFullScan: boolean
  // Si está activo, se puede completar un packing con discrepancia (mismatch) registrando
  // un motivo; si está inactivo, el mismatch bloquea el cierre.
  packingAllowMismatch: boolean
  // Si está activo, la etiqueta de envío se genera automáticamente al verificar el packing.
  packingAutoGenerateLabel: boolean
  // Shipping module (#7) — despacho y transporte. Configured in /shipping-settings.
  // Congela despachar/entregar/cotizar/consolidar/crear y despachar manifiestos.
  shippingFreezeActive: boolean
  // Rate shopping: si está activo, /shipping preselecciona automáticamente la cotización
  // más barata al abrir el comparador de tarifas.
  shippingAutoRateShop: boolean
  // Criterio de orden por defecto del rate shopping: menor costo o menor tiempo de tránsito.
  shippingRateStrategy: 'cheapest' | 'fastest'
  // Sobrecosto máximo (fracción) tolerado sobre la tarifa más barata al elegir por servicio.
  // 0.15 = se acepta pagar hasta 15% más que la opción más económica.
  shippingMaxCostOverBestPct: number
  // Verificación de carga: exige confirmar bultos (y series) antes de despachar.
  shippingRequireLoadVerification: boolean
  // Si está activo, permite despachar un envío con menos bultos de los esperados,
  // dejando el saldo pendiente (despacho parcial). Si está inactivo, bloquea.
  shippingAllowPartialDispatch: boolean
  // Modalidades de transporte habilitadas para cotizar y despachar.
  shippingEnabledModalities: CarrierModality[]
  // Días de holgura sobre la fecha prometida antes de marcar un envío "en riesgo" (OTIF).
  shippingOtifAtRiskDays: number
  // Meta de cumplimiento OTIF (%) — referencia para los KPIs del módulo.
  shippingOtifTargetPct: number
  // Si está activo, los envíos con el mismo destino se sugieren para consolidar en una ruta.
  shippingConsolidateByDestination: boolean
}
```

Replace it with (moves the closing `}` down so all of these fields belong to `WmsSettings`, and `PickingZoneConfig` keeps only its own 4 fields; adds the new `putawayFreezeActive` field and the module-9 comment marker at the true end):

```ts
  pickingRequireIssuePhoto: boolean
  pickingAllowSubstitution: boolean
  // Catálogo independiente de zonas de picking (pick-and-pass), desacoplado de
  // StorageLocation.zone para permitir renombrar/reordenar sin tocar ubicaciones.
  pickingZones: PickingZoneConfig[]
  // Packing module (#6) — embalaje. Configured in /packing-settings.
  // Congela iniciar/escanear/completar/aplicar reglas/seleccionar caja/generar etiqueta/enviar a despacho.
  packingFreezeActive: boolean
  // Cartonización: margen de seguridad (fracción) que se reserva sobre el peso/volumen
  // de la caja al sugerirla — 0.1 = usar solo el 90% de la capacidad nominal.
  packingBoxSafetyMargin: number
  // Si está activo, /packing sugiere caja automáticamente por peso+volumen (suggestBox).
  packingAutoBoxSuggestion: boolean
  // Verificación de contenido: si está activo, exige escaneo 1:1 (esperado === escaneado)
  // antes de poder completar el packing.
  packingRequireFullScan: boolean
  // Si está activo, se puede completar un packing con discrepancia (mismatch) registrando
  // un motivo; si está inactivo, el mismatch bloquea el cierre.
  packingAllowMismatch: boolean
  // Si está activo, la etiqueta de envío se genera automáticamente al verificar el packing.
  packingAutoGenerateLabel: boolean
  // Shipping module (#7) — despacho y transporte. Configured in /shipping-settings.
  // Congela despachar/entregar/cotizar/consolidar/crear y despachar manifiestos.
  shippingFreezeActive: boolean
  // Rate shopping: si está activo, /shipping preselecciona automáticamente la cotización
  // más barata al abrir el comparador de tarifas.
  shippingAutoRateShop: boolean
  // Criterio de orden por defecto del rate shopping: menor costo o menor tiempo de tránsito.
  shippingRateStrategy: 'cheapest' | 'fastest'
  // Sobrecosto máximo (fracción) tolerado sobre la tarifa más barata al elegir por servicio.
  // 0.15 = se acepta pagar hasta 15% más que la opción más económica.
  shippingMaxCostOverBestPct: number
  // Verificación de carga: exige confirmar bultos (y series) antes de despachar.
  shippingRequireLoadVerification: boolean
  // Si está activo, permite despachar un envío con menos bultos de los esperados,
  // dejando el saldo pendiente (despacho parcial). Si está inactivo, bloquea.
  shippingAllowPartialDispatch: boolean
  // Modalidades de transporte habilitadas para cotizar y despachar.
  shippingEnabledModalities: CarrierModality[]
  // Días de holgura sobre la fecha prometida antes de marcar un envío "en riesgo" (OTIF).
  shippingOtifAtRiskDays: number
  // Meta de cumplimiento OTIF (%) — referencia para los KPIs del módulo.
  shippingOtifTargetPct: number
  // Si está activo, los envíos con el mismo destino se sugieren para consolidar en una ruta.
  shippingConsolidateByDestination: boolean
  // Putaway module (#3) — almacenamiento y putaway. Configured in /putaway-settings.
  // Congela putawayItem/assignPutaway. Las reglas (PutawayRule) y sus CRUD NO se congelan.
  putawayFreezeActive: boolean
}

export interface PickingZoneConfig {
  id: string
  name: string
  sequenceOrder: number // orden de paso en pick-and-pass, ascendente
  active: boolean
}
```

- [ ] **Step 2: Verify the bug fix resolves every pre-existing error**

Run: `npx tsc --noEmit -p . 2>&1 | grep -c "error TS"`
Expected: fewer errors than before (90), with all remaining ones (if any) being exactly one new error about `seed.ts`'s `settings` object literal missing `putawayFreezeActive` — that's expected until Step 3.

- [ ] **Step 3: Add `putawayFreezeActive` to the seed settings object**

Open `src/data/seed.ts`, find the `settings` object (`export const settings: WmsSettings = { ... }`), locate the end of the Shipping module (#7) block (last field is `shippingConsolidateByDestination: ...`), and add immediately after it, before the closing `}`:

```ts
  // Putaway module (#3)
  putawayFreezeActive: false,
```

- [ ] **Step 4: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 5: Add restriction fields to `Product` and `StorageLocation`**

In `src/types/wms.ts`, find the `StorageLocation` interface and add after `maxStockUnits?: number` (its last field):

```ts
  // Putaway module (#3) — restricciones siempre activas (no configurables), ver
  // lib/rules/putaway.ts:checkPutawayCompatibility. hazardApproved/allowsLotMixing
  // por defecto false/true respectivamente cuando están ausentes.
  hazardApproved?: boolean
  temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'
  allowsLotMixing?: boolean
```

Find the `Product` interface and add after `maxStockUnits?: number` (its last field):

```ts
  // Putaway module (#3) — restricciones siempre activas de destino.
  isHazardous?: boolean
  requiresColdChain?: boolean
```

- [ ] **Step 6: Add the `PutawayRule` types**

In `src/types/wms.ts`, immediately after the `SlottingRule` interface (right after its closing `}`, before the `// --- Administration domain ---` comment), add:

```ts
// --- Putaway rules (motor paralelo e independiente de SlottingRule) ---
//
// Mismo shape que SlottingRule (matchType + directives + priority), declarado por
// separado a propósito: gobierna DÓNDE ATERRIZA la mercancía recién recibida, no
// dónde debería reubicarse stock ya existente (eso es SlottingRule). Ajustar una
// regla de slotting nunca debe cambiar el comportamiento de putaway, y viceversa.
// Las funciones de evaluación de lib/rules/slotting.ts (activeMatchingRules,
// candidateAllowedByRules, resolvePreferredTier) son genéricas sobre la forma de
// las directivas, así que lib/rules/putaway.ts las reutiliza vía un cast interno
// en vez de duplicar la lógica de matching.

export type PutawayRuleMatchType = 'category' | 'abcClass' | 'weightAboveKg' | 'trackBy'

export type PutawayDirectiveKind =
  | 'preferTier'
  | 'requireLocationType'
  | 'requireZone'
  | 'requireGolden'
  | 'forbidGolden'
  | 'maxLevel'
  | 'requireRackCompatible'

export type PutawayDirective =
  | { kind: 'preferTier'; tier: SlottingTier }
  | { kind: 'requireLocationType'; locationType: LocationType }
  | { kind: 'requireZone'; zone: string }
  | { kind: 'requireGolden' }
  | { kind: 'forbidGolden' }
  | { kind: 'maxLevel'; level: number }
  | { kind: 'requireRackCompatible' }

export interface PutawayRule {
  id: string
  code: string
  name: string
  description?: string
  matchType: PutawayRuleMatchType
  matchValue: string
  directives: PutawayDirective[]
  priority: number
  active: boolean
}
```

- [ ] **Step 7: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors (new fields are all optional or have a seed default already in place; no existing object literal breaks).

- [ ] **Step 8: Commit**

```bash
git add src/types/wms.ts src/data/seed.ts
git commit -m "$(cat <<'EOF'
fix(types): correct misplaced WmsSettings/PickingZoneConfig brace; add putaway domain types

The Packing/Shipping settings fields were accidentally declared on
PickingZoneConfig instead of WmsSettings, breaking typecheck across
/packing-settings, /shipping-settings, /shipping and /worker/packing —
unrelated pre-existing bug found while adding putawayFreezeActive.

Also adds Product/StorageLocation restriction fields (hazmat, cold-chain,
lot-mixing) and the PutawayRule type family for the Putaway module.
EOF
)"
```

---

### Task 2: Putaway compatibility & suggestion engine

**Files:**
- Modify: `src/lib/rules/putaway.ts` (full rewrite, currently 57 lines)

**Interfaces:**
- Consumes: `Product`, `StorageLocation`, `RackType`, `AbcClass`, `XyzClass`, `InventoryItem`, `PutawayRule`, `SlottingRule` (types, from `@/types/wms`); `idealLocationTier`, `activeMatchingRules`, `resolvePreferredTier`, `candidateAllowedByRules` (from `@/lib/rules/slotting`); `checkRackCompatibility` (from `@/lib/rules/locations`).
- Produces (used by Task 5, 6, 7):
  - `interface PutawayCompatibility { compatible: boolean; reasons: string[] }`
  - `checkPutawayCompatibility(product, candidate, productVolumeM3, rackType, hasOtherLotAtLocation): PutawayCompatibility`
  - `validatePutawayDestination(args: { product: Product; destination: StorageLocation; rackType?: RackType; hasOtherLotAtLocation: boolean; rules: PutawayRule[]; abcClass: AbcClass }): PutawayCompatibility`
  - `suggestPutawayLocation(args: { product: Product; abcClass: AbcClass; xyzClass: XyzClass; locations: StorageLocation[]; inventoryItems: InventoryItem[]; rules: PutawayRule[]; rackTypes: RackType[]; warehouseId?: string }): { location: StorageLocation; reason: string } | null`
  - `activePutawayMatchingRules(product, abcClass, rules: PutawayRule[]): PutawayRule[]`

- [ ] **Step 1: Rewrite `src/lib/rules/putaway.ts`**

```ts
import type {
  AbcClass,
  InventoryItem,
  Product,
  PutawayRule,
  RackType,
  SlottingRule,
  StorageLocation,
  XyzClass,
} from '@/types/wms'
import { candidateAllowedByRules, activeMatchingRules, idealLocationTier, resolvePreferredTier } from '@/lib/rules/slotting'
import { checkRackCompatibility } from '@/lib/rules/locations'

// PutawayRule/PutawayDirective are declared independently from SlottingRule/
// SlottingDirective (see types/wms.ts) but are structurally identical shapes —
// same matchType literals, same directive kinds. The slotting engine's matching
// functions are generic over that shape, so we reuse them here via a narrow cast
// instead of duplicating ~120 lines of rule-matching logic.
export function activePutawayMatchingRules(
  product: Pick<Product, 'category' | 'unitWeightKg' | 'trackBy'>,
  abcClass: AbcClass,
  rules: PutawayRule[]
): PutawayRule[] {
  return activeMatchingRules(product, abcClass, rules as unknown as SlottingRule[]) as unknown as PutawayRule[]
}

// ─── Restrictions (always-on, not configurable — see spec §Alcance) ───────────

export interface PutawayCompatibility {
  compatible: boolean
  reasons: string[]
}

export function checkPutawayCompatibility(
  product: Pick<Product, 'category' | 'unitWeightKg' | 'isHazardous' | 'requiresColdChain'>,
  candidate: Pick<
    StorageLocation,
    'isBlocked' | 'maxWeightKg' | 'maxVolumeM3' | 'hazardApproved' | 'temperatureZone' | 'allowsLotMixing' | 'type'
  >,
  productVolumeM3: number,
  rackType: RackType | undefined,
  hasOtherLotAtLocation: boolean
): PutawayCompatibility {
  const reasons: string[] = []

  if (candidate.isBlocked) reasons.push('la ubicación está bloqueada')
  if (candidate.maxWeightKg > 0 && product.unitWeightKg > candidate.maxWeightKg) {
    reasons.push(`excede el peso máximo de la ubicación (${candidate.maxWeightKg} kg)`)
  }
  if (candidate.maxVolumeM3 > 0 && productVolumeM3 > candidate.maxVolumeM3) {
    reasons.push(`excede el volumen máximo de la ubicación (${candidate.maxVolumeM3} m³)`)
  }
  if (rackType) {
    const rack = checkRackCompatibility(rackType, candidate, product)
    if (!rack.compatible) reasons.push(...rack.reasons)
  }
  if (product.isHazardous && !candidate.hazardApproved) {
    reasons.push('requiere una ubicación aprobada para materiales peligrosos')
  }
  if (product.requiresColdChain && (candidate.temperatureZone ?? 'ambient') === 'ambient') {
    reasons.push('requiere una zona con temperatura controlada (refrigerado o congelado)')
  }
  if (hasOtherLotAtLocation && candidate.allowsLotMixing === false) {
    reasons.push('ya contiene otro lote y la ubicación no permite mezcla de lotes')
  }

  return { compatible: reasons.length === 0, reasons }
}

// Validates a chosen (suggested or manually-selected) destination before putawayItem
// commits. Combines the always-on restrictions with any active PutawayRule's hard
// directives (requireZone, forbidGolden, requireRackCompatible, etc.).
export function validatePutawayDestination(args: {
  product: Product
  destination: StorageLocation
  rackType?: RackType
  hasOtherLotAtLocation: boolean
  rules: PutawayRule[]
  abcClass: AbcClass
}): PutawayCompatibility {
  const { product, destination, rackType, hasOtherLotAtLocation, rules, abcClass } = args

  const compat = checkPutawayCompatibility(
    product,
    destination,
    product.unitVolumeM3,
    rackType,
    hasOtherLotAtLocation
  )
  if (!compat.compatible) return compat

  const matchingRules = activePutawayMatchingRules(product, abcClass, rules)
  if (matchingRules.length === 0) return { compatible: true, reasons: [] }

  const verdict = candidateAllowedByRules(matchingRules as unknown as SlottingRule[], product, destination, rackType)
  return { compatible: verdict.allowed, reasons: verdict.reasons }
}

// ─── System-directed suggestion ────────────────────────────────────────────────

// Returns the best available putaway destination for a product, or null when no
// candidate satisfies the hard constraints (caller falls back to manual selection).
// Ranking: tier fit (golden/standard/remote, from ABC/XYZ unless a PutawayRule's
// preferTier overrides it) first, then a same-product consolidation preference,
// then accessibilityScore (desc for golden/standard, asc for remote — remote exists
// to free up prime slots, so the least accessible remote candidate is the "best" one).
export function suggestPutawayLocation(args: {
  product: Product
  abcClass: AbcClass
  xyzClass: XyzClass
  locations: StorageLocation[]
  inventoryItems: InventoryItem[]
  rules: PutawayRule[]
  rackTypes: RackType[]
  warehouseId?: string
}): { location: StorageLocation; reason: string } | null {
  const { product, abcClass, xyzClass, locations, inventoryItems, rules, rackTypes, warehouseId } = args

  const baseTier = idealLocationTier(abcClass, xyzClass)
  const matchingRules = activePutawayMatchingRules(product, abcClass, rules)
  const { tier, appliedRule } = resolvePreferredTier(
    baseTier,
    matchingRules as unknown as SlottingRule[]
  )

  const hasProductAt = (locationId: string) =>
    inventoryItems.some(
      (i) => i.locationId === locationId && i.productId === product.id && i.onHandQuantity > 0
    )
  const hasOtherLotAt = (locationId: string, lot: string | undefined) =>
    product.trackBy === 'lot' &&
    inventoryItems.some(
      (i) =>
        i.locationId === locationId &&
        i.productId === product.id &&
        i.onHandQuantity > 0 &&
        i.lot !== undefined &&
        i.lot !== lot
    )

  const candidates = locations.filter((loc) => {
    if (warehouseId && loc.warehouseId !== warehouseId) return false
    if (loc.type !== 'pick' && loc.type !== 'reserve') return false
    const rackType = loc.rackTypeId ? rackTypes.find((r) => r.id === loc.rackTypeId) : undefined
    // At suggestion time there's no specific incoming lot yet — treat "has any
    // other lot" as a soft signal only (hasOtherLotAt with lot=undefined always
    // reads any existing lot as "other"); validatePutawayDestination re-checks
    // precisely against the real incoming lot right before putawayItem commits.
    const compat = checkPutawayCompatibility(
      product,
      loc,
      product.unitVolumeM3,
      rackType,
      hasOtherLotAt(loc.id, undefined)
    )
    if (!compat.compatible) return false
    if (matchingRules.length > 0) {
      const rackTypeForRules = loc.rackTypeId ? rackTypes.find((r) => r.id === loc.rackTypeId) : undefined
      if (!candidateAllowedByRules(matchingRules as unknown as SlottingRule[], product, loc, rackTypeForRules).allowed) {
        return false
      }
    }
    return true
  })

  if (candidates.length === 0) return null

  const rank = (a: StorageLocation, b: StorageLocation): number => {
    const aConsolidates = hasProductAt(a.id)
    const bConsolidates = hasProductAt(b.id)
    if (aConsolidates !== bConsolidates) return aConsolidates ? -1 : 1
    if (tier === 'remote') return a.accessibilityScore - b.accessibilityScore
    return b.accessibilityScore - a.accessibilityScore
  }

  let pool = candidates
  if (tier === 'golden') {
    const golden = candidates.filter((l) => l.golden)
    if (golden.length > 0) pool = golden
  } else if (tier === 'standard') {
    const nonGolden = candidates.filter((l) => !l.golden)
    if (nonGolden.length > 0) pool = nonGolden
  }

  const best = [...pool].sort(rank)[0]
  const tierLabel = tier === 'golden' ? 'zona golden' : tier === 'remote' ? 'zona remota' : 'zona estándar'
  const consolidationNote = hasProductAt(best.id) ? ' · consolida con stock existente' : ''
  const ruleNote = appliedRule ? ` · regla «${appliedRule.name}»` : ''
  const reason = `Sugerencia automática (${abcClass}${xyzClass}, ${tierLabel})${consolidationNote}${ruleNote}`

  return { location: best, reason }
}
```

- [ ] **Step 2: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors. (This file has no callers yet — old callers are fixed in Task 6 — so also grep to confirm nothing else still calls the old signature: `grep -rn "suggestPutawayLocation" src/ --include=*.tsx --include=*.ts`. Expected: only the definition in `putaway.ts` itself; the old caller in `use-putaway-dialog.ts` will show a type error here, which Task 6 fixes — if Step 2 reports an error in `use-putaway-dialog.ts` about `suggestPutawayLocation`'s arguments, that is expected and will be resolved in Task 6, not before.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/rules/putaway.ts
git commit -m "$(cat <<'EOF'
feat(putaway): rewrite suggestion engine with rules + restriction checks

Adds checkPutawayCompatibility (hazmat/cold-chain/lot-mixing/rack, always
on) and validatePutawayDestination, and rewrites suggestPutawayLocation to
filter candidates through active PutawayRules and prefer consolidating
onto a location that already holds the same product.
EOF
)"
```

---

### Task 3: Seed data — hazmat/cold-chain demo products, locations, and `PutawayRule`s

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `Product`, `StorageLocation`, `PutawayRule` (Task 1).
- Produces: `seed.putawayRules: PutawayRule[]`; two new products (`p-bateria-litio`, `p-gas-refrigerante`); two new locations (`loc-hazmat-01`, `loc-cold-01`); `loc-b0204` gains `allowsLotMixing: false`. All consumed by Task 4's `buildSeedState()`.

- [ ] **Step 1: Add two demo products with restriction flags**

In `src/data/seed.ts`, inside the `products` array, immediately before its closing `]`, add:

```ts
  // ─── Insumos técnicos (demo de restricciones de putaway — módulo #3) ────────
  {
    id: 'p-bateria-litio',
    sku: 'AC-BAT-101',
    name: 'Batería de Litio Recargable 5000mAh',
    category: 'Accesorios',
    barcode: '7700000000101',
    unitWeightKg: 0.6,
    unitVolumeM3: 0.001,
    trackBy: 'lot',
    baseUomId: 'uom-und',
    uomConversions: [],
    rotationStrategy: 'fifo',
    isHazardous: true,
  },
  {
    id: 'p-gas-refrigerante',
    sku: 'IT-GAS-201',
    name: 'Cilindro de Gas Refrigerante R410A 5kg',
    category: 'Insumos técnicos',
    barcode: '7700000000201',
    unitWeightKg: 12,
    unitVolumeM3: 0.02,
    trackBy: 'lot',
    baseUomId: 'uom-und',
    uomConversions: [],
    rotationStrategy: 'fifo',
    requiresColdChain: true,
  },
```

- [ ] **Step 2: Add two demo locations and one restriction override**

In `src/data/seed.ts`, inside the `locations` array, immediately before its closing `]`, add:

```ts
  // ─── Zonas de restricción (demo del módulo #3 — Almacenamiento y Putaway) ────
  {
    id: 'loc-hazmat-01',
    code: 'HZ-01-01',
    barcode: 'LOC-HZ-HZ0101',
    warehouseId: 'wh-bog',
    zone: 'HZ',
    rackTypeId: 'rack-floor',
    type: 'reserve',
    isPickFace: false,
    golden: false,
    isBlocked: false,
    accessibilityScore: 35,
    maxWeightKg: 500,
    volumeCapacityM3: 10,
    maxVolumeM3: 3.0,
    distanceToDispatchM: 50,
    hazardApproved: true,
  },
  {
    id: 'loc-cold-01',
    code: 'CC-01-01',
    barcode: 'LOC-CC-CC0101',
    warehouseId: 'wh-bog',
    zone: 'CC',
    rackTypeId: 'rack-floor',
    type: 'reserve',
    isPickFace: false,
    golden: false,
    isBlocked: false,
    accessibilityScore: 30,
    maxWeightKg: 300,
    volumeCapacityM3: 6,
    maxVolumeM3: 2.0,
    distanceToDispatchM: 55,
    temperatureZone: 'refrigerated',
  },
```

Then find the existing `loc-b0204` entry (`code: 'B-02-04'`) and add `allowsLotMixing: false,` as its last field (before the closing `}`) — this demonstrates the lot-mixing restriction on an existing, otherwise-ordinary pick face:

```ts
  {
    id: 'loc-b0204',
    code: 'B-02-04',
    barcode: 'LOC-B-B0204',
    warehouseId: 'wh-bog',
    zone: 'B',
    aisle: '02',
    rack: 'A',
    level: '2',
    position: '04',
    rackTypeId: 'rack-sel-std',
    type: 'pick',
    isPickFace: true,
    golden: false,
    isBlocked: false,
    accessibilityScore: 40,
    maxWeightKg: 30,
    volumeCapacityM3: 3,
    maxVolumeM3: 0.5,
    distanceToDispatchM: 45,
    // Demo del módulo #3: esta pick face exige un solo lote a la vez (FEFO estricto).
    allowsLotMixing: false,
  },
```

- [ ] **Step 3: Add the `putawayRules` seed array**

In `src/data/seed.ts`, immediately after the `slottingRules` array's closing `]` (find `export const slottingRules: SlottingRule[] = [ ... ]`), add:

```ts
export const putawayRules: PutawayRule[] = [
  {
    id: 'pwr-1',
    code: 'PWR-01',
    name: 'Electrónica siempre en zona A',
    description: 'La categoría Electrónica se ubica en la zona A (picking rápido) independiente de su clase ABC.',
    matchType: 'category',
    matchValue: 'Electrónica',
    directives: [{ kind: 'requireZone', zone: 'A' }],
    priority: 50,
    active: true,
  },
  {
    id: 'pwr-2',
    code: 'PWR-02',
    name: 'Clase A preferentemente a golden',
    description: 'Los productos clase A se sugieren en zona golden cuando hay capacidad disponible.',
    matchType: 'abcClass',
    matchValue: 'A',
    directives: [{ kind: 'preferTier', tier: 'golden' }],
    priority: 40,
    active: true,
  },
  {
    id: 'pwr-3',
    code: 'PWR-03',
    name: 'Línea Blanca requiere rack compatible',
    description: 'La Línea Blanca solo se ubica en ubicaciones con un tipo de estiba compatible con su peso y categoría.',
    matchType: 'category',
    matchValue: 'Línea Blanca',
    directives: [{ kind: 'requireRackCompatible' }],
    priority: 30,
    active: true,
  },
]
```

Also add `PutawayRule` to the `import type { ... } from '@/types/wms'` block at the top of `seed.ts` (find the existing import that includes `SlottingRule` and add `PutawayRule` alongside it).

- [ ] **Step 4: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "$(cat <<'EOF'
feat(seed): add hazmat/cold-chain/lot-mixing demo data for putaway

Two new products (lithium battery = hazmat, refrigerant gas = cold-chain),
two new restricted locations, a lot-mixing override on an existing pick
face, and three PutawayRule examples (zone, ABC-preferred-tier, rack
compatibility).
EOF
)"
```

---

### Task 4: Store — `putawayRules` slice, CRUD actions, persistence bump

**Files:**
- Modify: `src/store/wms-store.ts`

**Interfaces:**
- Consumes: `PutawayRule` (Task 1), `seed.putawayRules` (Task 3).
- Produces: `WmsState.putawayRules: PutawayRule[]`; `createPutawayRule(data: Omit<PutawayRule, 'id'>): PutawayRule`; `updatePutawayRule(id: string, data: Partial<Omit<PutawayRule, 'id'>>): PutawayRule`; `togglePutawayRule(id: string): PutawayRule`; `deletePutawayRule(id: string): void`. Consumed by Task 6 (dialog) and Task 7 (settings page).

- [ ] **Step 1: Add `PutawayRule` to the type import block**

In `src/store/wms-store.ts`, find the big `import type { ... } from '@/types/wms'` block (starts ~line 49) and add `PutawayRule` alphabetically next to `PurchaseOrder`/`PutToStoreTask`:

```ts
  PurchaseOrder,
  PutToStoreTask,
  PutawayRule,
  RackType,
```

- [ ] **Step 2: Add the slice field to `WmsState`**

Find `slottingRules: SlottingRule[]` in the `WmsState` interface (~line 234) and add right after it:

```ts
  slottingRules: SlottingRule[]
  putawayRules: PutawayRule[]
```

- [ ] **Step 3: Add the CRUD action signatures**

Find the four `xxxSlottingRule` signatures (~line 479-482) and add right after `deleteSlottingRule: (id: string) => void`:

```ts
  deleteSlottingRule: (id: string) => void
  // Putaway rules (gobierno de destino en recepción — independiente de slotting)
  createPutawayRule: (data: Omit<PutawayRule, 'id'>) => PutawayRule
  updatePutawayRule: (id: string, data: Partial<Omit<PutawayRule, 'id'>>) => PutawayRule
  togglePutawayRule: (id: string) => PutawayRule
  deletePutawayRule: (id: string) => void
```

- [ ] **Step 4: Add the CRUD implementations**

Find the four `xxxSlottingRule` implementations (search for `deleteSlottingRule: (id) => {`) and add right after that function's closing `},`:

```ts
      deleteSlottingRule: (id) => {
        const state = get()
        set({ slottingRules: state.slottingRules.filter((r) => r.id !== id) })
      },

      // ─── Putaway rules ──────────────────────────────────────────────────────────

      createPutawayRule: (data) => {
        const state = get()
        const created: PutawayRule = { ...data, id: `pwr-${Date.now()}` }
        set({ putawayRules: [...state.putawayRules, created] })
        return created
      },

      updatePutawayRule: (id, data) => {
        const state = get()
        const rule = state.putawayRules.find((r) => r.id === id)
        if (!rule) throw new Error('putaway rule not found')
        const updated: PutawayRule = { ...rule, ...data }
        set({ putawayRules: state.putawayRules.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      togglePutawayRule: (id) => {
        const state = get()
        const rule = state.putawayRules.find((r) => r.id === id)
        if (!rule) throw new Error('putaway rule not found')
        const updated: PutawayRule = { ...rule, active: !rule.active }
        set({ putawayRules: state.putawayRules.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      deletePutawayRule: (id) => {
        const state = get()
        set({ putawayRules: state.putawayRules.filter((r) => r.id !== id) })
      },
```

- [ ] **Step 5: Wire the seed into `buildSeedState`**

Find `slottingRules: seed.slottingRules,` inside `buildSeedState()` (~line 681) and add right after it:

```ts
  slottingRules: seed.slottingRules,
  putawayRules: seed.putawayRules,
```

- [ ] **Step 6: Bump the persist version**

Find the persist config tail (search for `version: 8,`) and:

```ts
      // v8: yard/dock module (#8) — docks + dockAppointments slices, and yard
      // governance settings (operating hours, working days, overbooking) added to the seed.
      version: 8,
```

Change to:

```ts
      // v8: yard/dock module (#8) — docks + dockAppointments slices, and yard
      // governance settings (operating hours, working days, overbooking) added to the seed.
      // v9: putaway module (#3) — putawayRules slice, hazard/cold-chain/lot-mixing
      // fields on Product/StorageLocation, and putawayFreezeActive governance added
      // to the seed.
      version: 9,
```

- [ ] **Step 7: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/store/wms-store.ts
git commit -m "$(cat <<'EOF'
feat(store): add putawayRules slice, CRUD actions, and persist version 9

Same CRUD shape as slottingRules — independent slice, no freeze guard on
the CRUD itself (only putawayItem/assignPutaway respect the freeze flag,
added in the next task).
EOF
)"
```

---

### Task 5: Harden `putawayItem` — destination validation, freeze guard, real operator identity

**Files:**
- Modify: `src/store/wms-store.ts`
- Modify: `src/app/(app)/receiving/_hooks/use-putaway-dialog.ts`

**Interfaces:**
- Consumes: `validatePutawayDestination` (Task 2), `abcByProduct` (existing selector, already imported in `wms-store.ts`), `useCurrentOperator` (existing hook, `src/hooks/use-current-operator.ts`).
- Produces: `putawayItem` now throws a descriptive `Error` for an incompatible destination instead of silently succeeding; respects `settings.putawayFreezeActive`.

- [ ] **Step 1: Import `validatePutawayDestination` in the store**

In `src/store/wms-store.ts`, find the import block for `@/lib/rules/locations` (`import { isGoldenEligible } from '@/lib/rules/locations'`) and add a new import right after it:

```ts
import { isGoldenEligible } from '@/lib/rules/locations'
import { validatePutawayDestination } from '@/lib/rules/putaway'
```

- [ ] **Step 2: Add the frozen-module message constant**

Find `const SHIPPING_FROZEN_MSG = ...` (~line 142) and add right after it:

```ts
// Shipping module (#7) — guarda de gobierno, ver /shipping-settings.
const SHIPPING_FROZEN_MSG = 'Despacho en modo congelado. No se permiten operaciones.'

// Putaway module (#3) — guarda de gobierno, ver /putaway-settings.
const PUTAWAY_FROZEN_MSG = 'Almacenamiento y putaway en modo congelado. No se permiten operaciones.'
```

- [ ] **Step 3: Harden `putawayItem`**

Find the `putawayItem: (asnId, locationId, operatorName) => {` implementation. Its current first few lines are:

```ts
      putawayItem: (asnId, locationId, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        if (!canTransition(asnTransitions, asn.status, 'putaway_done'))
          throw new Error(`No se puede hacer putaway desde el estado ${asn.status}`)

        const product = state.products.find((p) => p.id === asn.productId)
        const isSerialTracked = product?.trackBy === 'serial'
```

Replace with (adds the freeze guard, resolves the destination + rack type, and validates before any mutation):

```ts
      putawayItem: (asnId, locationId, operatorName) => {
        const state = get()
        if (state.settings.putawayFreezeActive) throw new Error(PUTAWAY_FROZEN_MSG)
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        if (!canTransition(asnTransitions, asn.status, 'putaway_done'))
          throw new Error(`No se puede hacer putaway desde el estado ${asn.status}`)

        const product = state.products.find((p) => p.id === asn.productId)
        if (!product) throw new Error('Producto no encontrado')
        const isSerialTracked = product.trackBy === 'serial'

        const destination = state.locations.find((l) => l.id === locationId)
        if (!destination) throw new Error('Ubicación de destino no encontrada')
        const rackType = destination.rackTypeId
          ? state.rackTypes.find((r) => r.id === destination.rackTypeId)
          : undefined
        const hasOtherLotAtLocation =
          product.trackBy === 'lot' &&
          state.inventoryItems.some(
            (i) =>
              i.locationId === locationId &&
              i.productId === product.id &&
              i.onHandQuantity > 0 &&
              i.lot !== undefined
          )
        const abcClass = abcByProduct(state)[product.id] ?? 'C'
        const verdict = validatePutawayDestination({
          product,
          destination,
          rackType,
          hasOtherLotAtLocation,
          rules: state.putawayRules,
          abcClass,
        })
        if (!verdict.compatible) {
          throw new Error(`Ubicación no compatible: ${verdict.reasons.join('. ')}.`)
        }
```

The rest of `putawayItem`'s body (the serial/non-serial branches, `updatedAsn`, `set({...})`) stays exactly as-is — only these opening lines change.

- [ ] **Step 4: Add the freeze guard to `assignPutaway`**

Find `assignPutaway: (asnId, operatorName, operatorId) => {` and its `set((state) => ({` body. Add the guard as the first line of the function body:

```ts
      assignPutaway: (asnId, operatorName, operatorId) => {
        if (get().settings.putawayFreezeActive) throw new Error(PUTAWAY_FROZEN_MSG)
        set((state) => ({
```

- [ ] **Step 5: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 6: Fix the hardcoded `'Operador'` string**

Open `src/app/(app)/receiving/_hooks/use-putaway-dialog.ts`. Add the import:

```ts
import { useCurrentOperator } from '@/hooks/use-current-operator'
```

Find:

```ts
export const usePutawayDialog = () => {
  const state = useWmsStore()
  const { putawayItem } = state
  const { locationCode } = useStoreHelpers()
```

Replace with:

```ts
export const usePutawayDialog = () => {
  const state = useWmsStore()
  const { putawayItem } = state
  const { locationCode } = useStoreHelpers()
  const { operator } = useCurrentOperator()
```

Find:

```ts
  const handleSubmit = () => {
    if (!dialog.data) return
    if (!selectedLocation) {
      dialog.setError('Selecciona una ubicación.')
      return
    }
    try {
      putawayItem(dialog.data.asnId, selectedLocation, 'Operador')
```

Replace the `putawayItem` line with:

```ts
      putawayItem(dialog.data.asnId, selectedLocation, operator?.name ?? 'Operador')
```

- [ ] **Step 7: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors. (`use-putaway-dialog.ts` will still show an error about `suggestPutawayLocation`'s old call signature at this point — that's expected, fixed in Task 6.)

- [ ] **Step 8: Commit**

```bash
git add src/store/wms-store.ts "src/app/(app)/receiving/_hooks/use-putaway-dialog.ts"
git commit -m "$(cat <<'EOF'
fix(putaway): validate destination before committing, respect freeze, use real operator

putawayItem previously accepted any locationId with zero validation
(blocked, capacity, hazmat, cold-chain, lot-mixing, rack compatibility all
ignored) and the confirm-location step logged the literal string
'Operador' instead of the signed-in operator's name.
EOF
)"
```

---

### Task 6: `PutawayDialog` UX — compatibility badges, disabled invalid options, re-validated suggestion

**Files:**
- Modify: `src/app/(app)/receiving/_hooks/use-putaway-dialog.ts`
- Modify: `src/app/(app)/receiving/_components/putaway-dialog.tsx`

**Interfaces:**
- Consumes: `suggestPutawayLocation`, `validatePutawayDestination` (Task 2); `state.putawayRules`, `state.rackTypes` (Task 4).
- Produces: `PutawayDialogData` gains `locationCompat: Record<string, { compatible: boolean; reasons: string[] }>` (per-candidate compatibility, computed once when the dialog opens) so the component can grey out/annotate options without recomputing on every render.

- [ ] **Step 1: Rewrite the suggestion logic in `use-putaway-dialog.ts`**

Replace the full file content with:

```ts
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { selectSlottingRecommendations, abcByProduct, xyzByProduct } from '@/store/selectors'
import { idealLocationTier } from '@/lib/rules/slotting'
import { suggestPutawayLocation, validatePutawayDestination } from '@/lib/rules/putaway'
import type { AbcClass, XyzClass } from '@/types/wms'

export interface PutawayDialogData {
  asnId: string
  productName: string
  asnCode: string
  suggestedLocationId: string | null
  abcClass: AbcClass
  xyzClass: XyzClass
  tierLabel: string
  suggestionReason: string
  isCrossDocking: boolean
  locationCompat: Record<string, { compatible: boolean; reasons: string[] }>
}

const TIER_LABEL: Record<string, string> = {
  golden: 'Golden zone — alta rotación, acceso ergonómico',
  standard: 'Zona estándar — rotación media',
  remote: 'Zona remota — baja rotación o demanda errática',
}

export const usePutawayDialog = () => {
  const state = useWmsStore()
  const { putawayItem } = state
  const { locationCode } = useStoreHelpers()
  const { operator } = useCurrentOperator()

  const dialog = useDialogState<PutawayDialogData>()
  const [selectedLocation, setSelectedLocation] = useState('')

  const recommendations = useMemo(
    () => selectSlottingRecommendations(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems, state.locations, state.demandStats]
  )

  const abc = useMemo(() => abcByProduct(state), [state.demandStats, state.settings])
  const xyz = useMemo(() => xyzByProduct(state), [state.demandStats, state.settings])

  const allLocations = useMemo(
    () =>
      state.locations.filter(
        (l) => l.type === 'pick' || l.type === 'staging' || l.type === 'reserve'
      ),
    [state.locations]
  )

  // Compatibility for every candidate in the manual dropdown, computed once per
  // open() call against the ASN's actual product — used to grey out/annotate
  // invalid options instead of letting the operator pick a destination that will
  // be rejected by putawayItem.
  const compatFor = useCallback(
    (productId: string): Record<string, { compatible: boolean; reasons: string[] }> => {
      const product = state.products.find((p) => p.id === productId)
      const abcClass: AbcClass = (abc[productId] ?? 'C') as AbcClass
      const result: Record<string, { compatible: boolean; reasons: string[] }> = {}
      if (!product) return result
      for (const loc of allLocations) {
        const rackType = loc.rackTypeId ? state.rackTypes.find((r) => r.id === loc.rackTypeId) : undefined
        const hasOtherLotAtLocation =
          product.trackBy === 'lot' &&
          state.inventoryItems.some(
            (i) => i.locationId === loc.id && i.productId === productId && i.onHandQuantity > 0 && i.lot !== undefined
          )
        result[loc.id] = validatePutawayDestination({
          product,
          destination: loc,
          rackType,
          hasOtherLotAtLocation,
          rules: state.putawayRules,
          abcClass,
        })
      }
      return result
    },
    [allLocations, abc, state.products, state.rackTypes, state.inventoryItems, state.putawayRules]
  )

  const getSuggestion = useCallback(
    (
      asnId: string,
      compat: Record<string, { compatible: boolean; reasons: string[] }>
    ): { locationId: string | null; reason: string } => {
      const asn = state.asnRecords.find((a) => a.id === asnId)
      if (!asn) return { locationId: null, reason: '' }
      const product = state.products.find((p) => p.id === asn.productId)

      // Tier 1: an active slotting recommendation for this product — re-validated
      // against the current restrictions before being trusted (it may have been
      // computed before the product/location gained a hazmat/cold-chain flag).
      const rec = recommendations.find((r) => r.productId === asn.productId)
      if (rec && compat[rec.suggestedLocationId]?.compatible) {
        const loc = state.locations.find((l) => l.id === rec.suggestedLocationId)
        return {
          locationId: rec.suggestedLocationId,
          reason: `Calculada por slotting (score ${rec.score}/100) — ahorra ~${Math.round(rec.estimatedDistanceSavedM)} m por ciclo hacia ${loc?.code ?? ''}`,
        }
      }

      // Tier 2: the ASN's static seed suggestion — same re-validation.
      if (asn.suggestedPutawayLocationId && compat[asn.suggestedPutawayLocationId]?.compatible) {
        return {
          locationId: asn.suggestedPutawayLocationId,
          reason: 'Sugerencia estática del ASN (sin recomendación de slotting activa)',
        }
      }

      // Tier 3: the full putaway engine (ABC/XYZ + PutawayRule + restrictions).
      if (product) {
        const abcClass: AbcClass = (abc[asn.productId] ?? 'C') as AbcClass
        const xyzClass: XyzClass = (xyz[asn.productId] ?? 'Z') as XyzClass
        const suggestion = suggestPutawayLocation({
          product,
          abcClass,
          xyzClass,
          locations: allLocations,
          inventoryItems: state.inventoryItems,
          rules: state.putawayRules,
          rackTypes: state.rackTypes,
          warehouseId: 'wh-bog',
        })
        if (suggestion) return { locationId: suggestion.location.id, reason: suggestion.reason }
      }

      return { locationId: null, reason: 'Sin sugerencia disponible — selecciona manualmente.' }
    },
    [
      state.asnRecords,
      state.locations,
      state.products,
      state.inventoryItems,
      state.putawayRules,
      state.rackTypes,
      recommendations,
      abc,
      xyz,
      allLocations,
    ]
  )

  const open = (
    asnId: string,
    asnCode: string,
    productName: string,
    rawAbcClass: string,
    isCrossDocking: boolean
  ) => {
    const asn = state.asnRecords.find((a) => a.id === asnId)
    const abcClass: AbcClass = (abc[asn?.productId ?? ''] ?? rawAbcClass ?? 'C') as AbcClass
    const xyzClass: XyzClass = (xyz[asn?.productId ?? ''] ?? 'Z') as XyzClass
    const tier = idealLocationTier(abcClass, xyzClass)
    const locationCompat = compatFor(asn?.productId ?? '')
    const { locationId, reason } = getSuggestion(asnId, locationCompat)

    dialog.open({
      asnId,
      asnCode,
      productName,
      suggestedLocationId: locationId,
      abcClass,
      xyzClass,
      tierLabel: TIER_LABEL[tier] ?? tier,
      suggestionReason: reason,
      isCrossDocking,
      locationCompat,
    })
    setSelectedLocation(locationId ?? '')
  }

  const handleSubmit = () => {
    if (!dialog.data) return
    if (!selectedLocation) {
      dialog.setError('Selecciona una ubicación.')
      return
    }
    try {
      putawayItem(dialog.data.asnId, selectedLocation, operator?.name ?? 'Operador')
      dialog.close()
      setSelectedLocation('')
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error en putaway')
    }
  }

  return {
    dialog,
    open,
    handleSubmit,
    selectedLocation,
    setSelectedLocation: (v: string) => {
      setSelectedLocation(v)
      dialog.clearError?.()
    },
    allLocations,
    locationCode,
  }
}
```

- [ ] **Step 2: Annotate/disable options in `putaway-dialog.tsx`**

In `src/app/(app)/receiving/_components/putaway-dialog.tsx`, add imports for the new icons used below:

```ts
import { ArrowRight, CheckCircle2, ClipboardCheck, MapPin, Snowflake, TriangleAlert, Zap } from 'lucide-react'
```

Find the `<SelectContent>` block:

```tsx
                <SelectContent>
                  {allLocations.map((l) => {
                    const isSuggested = l.id === dialog.data?.suggestedLocationId
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="flex items-center gap-2">
                          {isSuggested && <span className="font-bold text-emerald-500">★</span>}
                          <span className="font-mono">{l.code}</span>
                          <span className="text-muted-foreground">— Zona {l.zone}</span>
                          {l.golden && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 px-1 py-0 text-[10px] text-amber-600"
                            >
                              Golden
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
```

Replace with:

```tsx
                <SelectContent>
                  {allLocations.map((l) => {
                    const isSuggested = l.id === dialog.data?.suggestedLocationId
                    const compat = dialog.data?.locationCompat[l.id]
                    const isInvalid = compat ? !compat.compatible : false
                    return (
                      <SelectItem key={l.id} value={l.id} disabled={isInvalid}>
                        <span className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            {isSuggested && <span className="font-bold text-emerald-500">★</span>}
                            <span className="font-mono">{l.code}</span>
                            <span className="text-muted-foreground">— Zona {l.zone}</span>
                            {l.golden && (
                              <Badge
                                variant="outline"
                                className="border-amber-300 px-1 py-0 text-[10px] text-amber-600"
                              >
                                Golden
                              </Badge>
                            )}
                            {l.temperatureZone && l.temperatureZone !== 'ambient' && (
                              <Snowflake className="size-3 text-sky-500" />
                            )}
                            {l.hazardApproved && <Zap className="size-3 text-amber-500" />}
                          </span>
                          {isInvalid && (
                            <span className="flex items-center gap-1 text-[11px] text-destructive">
                              <TriangleAlert className="size-3" />
                              {compat?.reasons.join('. ')}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
```

- [ ] **Step 3: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev` (leave running)

1. Go to `/admin?tab=products`, edit **Batería de Litio Recargable 5000mAh** — this product doesn't have an existing ASN yet, so instead: go to `/admin?tab=products`, edit **Nevera No Frost 320L** (`p-nevera`) — wait, that product has no hazmat checkbox yet at this point (Task 8 adds the admin UI). For this task's manual check, instead directly verify via the browser console is not appropriate — **skip product-level hazmat toggling here**; that full end-to-end check happens in Task 8's manual verification once the admin checkboxes exist. For *this* task, verify only the non-restricted path:
2. Go to `/receiving`, open the **"Putaway staging"** tab.
3. Click **"Asignar ubicación"** on the row for ASN `ASN-001`/`p-nevera` (`asn-1`, status `completed`).
4. Confirm the dialog opens, shows a recommended location card, and the manual dropdown lists locations with the new ❄️/⚡ icons where applicable (none should show for this product yet) and no options disabled.
5. Confirm the location `B-02-04` still appears selectable (it now has `allowsLotMixing: false`, but `p-nevera` is `trackBy: 'serial'`, not `'lot'`, so the restriction doesn't apply to it — expected).
6. Submit and confirm the ASN moves to "Ubicado".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/receiving/_hooks/use-putaway-dialog.ts" "src/app/(app)/receiving/_components/putaway-dialog.tsx"
git commit -m "$(cat <<'EOF'
feat(putaway): show compatibility badges and disable invalid destinations

The manual location dropdown now greys out options that fail hazmat/
cold-chain/lot-mixing/capacity checks with an inline reason, and the
recommended-location card re-validates before trusting a stale slotting
recommendation or static ASN suggestion.
EOF
)"
```

---

### Task 7: `/putaway-settings` page + `PutawayRuleDialog` + nav entry

**Files:**
- Create: `src/app/(app)/putaway-settings/page.tsx`
- Create: `src/app/(app)/putaway-settings/_components/putaway-rule-dialog.tsx`
- Modify: `src/components/navigation/sidebar/sidebar-items.ts`

**Interfaces:**
- Consumes: `state.putawayRules`, `createPutawayRule`/`updatePutawayRule`/`togglePutawayRule`/`deletePutawayRule` (Task 4); `state.settings.putawayFreezeActive`, `updateSettings` (existing action); `SLOTTING_MATCH_TYPE_LABELS`, `SLOTTING_DIRECTIVE_LABELS`, `SLOTTING_TIER_LABELS`, `describeDirective`, `isHardDirective`, `LOCATION_TYPE_LABELS` (existing, reused as-is for display copy — same vocabulary, not policy).

- [ ] **Step 1: Create `PutawayRuleDialog`**

This is a near-verbatim clone of `src/app/(app)/slotting-settings/_components/slotting-rule-dialog.tsx`, retyped for `PutawayRule`/`PutawayDirective` and pointed at the putaway store actions. Create `src/app/(app)/putaway-settings/_components/putaway-rule-dialog.tsx`:

```tsx
'use client'

import { useEffect, useMemo } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { SLOTTING_DIRECTIVE_LABELS, SLOTTING_MATCH_TYPE_LABELS, SLOTTING_TIER_LABELS } from '@/lib/rules/slotting'
import { LOCATION_TYPE_LABELS } from '@/lib/rules/locations'
import type {
  AbcClass,
  LocationType,
  Product,
  PutawayDirective,
  PutawayDirectiveKind,
  PutawayRule,
  PutawayRuleMatchType,
  SlottingTier,
} from '@/types/wms'

const MATCH_TYPES = Object.keys(SLOTTING_MATCH_TYPE_LABELS) as PutawayRuleMatchType[]
const TIERS = Object.keys(SLOTTING_TIER_LABELS) as SlottingTier[]
const DIRECTIVE_KINDS = Object.keys(SLOTTING_DIRECTIVE_LABELS) as PutawayDirectiveKind[]
const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
const ABC_CLASSES: AbcClass[] = ['A', 'B', 'C']
const TRACK_BY_LABELS: Record<Product['trackBy'], string> = {
  none: 'Sin trazabilidad',
  lot: 'Lote',
  serial: 'Serie',
}

const KINDS_WITHOUT_VALUE = new Set<PutawayDirectiveKind>([
  'requireGolden',
  'forbidGolden',
  'requireRackCompatible',
])

type DirectiveRow = { kind: PutawayDirectiveKind; value: string }

const toRow = (d: PutawayDirective): DirectiveRow => {
  switch (d.kind) {
    case 'preferTier':
      return { kind: d.kind, value: d.tier }
    case 'requireLocationType':
      return { kind: d.kind, value: d.locationType }
    case 'requireZone':
      return { kind: d.kind, value: d.zone }
    case 'maxLevel':
      return { kind: d.kind, value: String(d.level) }
    default:
      return { kind: d.kind, value: '' }
  }
}

const toTypedDirective = (row: DirectiveRow): PutawayDirective | null => {
  switch (row.kind) {
    case 'preferTier':
      return row.value ? { kind: 'preferTier', tier: row.value as SlottingTier } : null
    case 'requireLocationType':
      return row.value ? { kind: 'requireLocationType', locationType: row.value as LocationType } : null
    case 'requireZone':
      return row.value.trim() ? { kind: 'requireZone', zone: row.value.trim() } : null
    case 'maxLevel': {
      const n = parseInt(row.value, 10)
      return Number.isFinite(n) && n >= 0 ? { kind: 'maxLevel', level: n } : null
    }
    case 'requireGolden':
      return { kind: 'requireGolden' }
    case 'forbidGolden':
      return { kind: 'forbidGolden' }
    case 'requireRackCompatible':
      return { kind: 'requireRackCompatible' }
    default:
      return null
  }
}

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  matchType: z.string().min(1, 'Requerido'),
  matchValue: z.string().min(1, 'Requerido'),
  priority: z.string().min(1, 'Requerido'),
  active: z.boolean(),
  directives: z
    .array(z.object({ kind: z.string(), value: z.string() }))
    .min(1, 'Agrega al menos una directiva'),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (rule: PutawayRule | null): FormValues => ({
  code: rule?.code ?? '',
  name: rule?.name ?? '',
  description: rule?.description ?? '',
  matchType: rule?.matchType ?? 'category',
  matchValue: rule?.matchValue ?? '',
  priority: String(rule?.priority ?? 50),
  active: rule?.active ?? true,
  directives: rule?.directives.map(toRow) ?? [{ kind: 'requireZone', value: '' }],
})

const DirectiveRowFields = ({
  control,
  index,
  zones,
  setValue,
  onRemove,
}: {
  control: Control<FormValues>
  index: number
  zones: string[]
  setValue: UseFormSetValue<FormValues>
  onRemove: () => void
}) => {
  const kind = useWatch({ control, name: `directives.${index}.kind` }) as PutawayDirectiveKind
  const hasValue = !KINDS_WITHOUT_VALUE.has(kind)

  const renderValue = () => {
    if (kind === 'maxLevel') {
      return (
        <Controller
          control={control}
          name={`directives.${index}.value`}
          render={({ field }) => (
            <Input type="number" min={0} placeholder="2" className="w-24" {...field} />
          )}
        />
      )
    }

    const options =
      kind === 'preferTier'
        ? TIERS.map((t) => ({ value: t, label: SLOTTING_TIER_LABELS[t] }))
        : kind === 'requireLocationType'
          ? LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABELS[t] }))
          : zones.map((z) => ({ value: z, label: `Zona ${z}` }))

    return (
      <Controller
        control={control}
        name={`directives.${index}.value`}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="min-w-40">
              <SelectValue placeholder="Valor…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Controller
        control={control}
        name={`directives.${index}.kind`}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v)
              setValue(`directives.${index}.value`, '')
            }}
          >
            <SelectTrigger className="min-w-52 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIVE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SLOTTING_DIRECTIVE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {hasValue ? renderValue() : <span className="text-xs text-muted-foreground">sin valor</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0 text-muted-foreground"
        onClick={onRemove}
        aria-label="Quitar directiva"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

interface Props {
  open: boolean
  rule: PutawayRule | null
  onClose: () => void
}

export const PutawayRuleDialog = ({ open, rule, onClose }: Props) => {
  const { products, locations, createPutawayRule, updatePutawayRule } = useWmsStore()

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  )
  const zones = useMemo(
    () => Array.from(new Set(locations.map((l) => l.zone))).sort(),
    [locations]
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(rule),
  })

  const directivesArray = useFieldArray({ control, name: 'directives' })

  useEffect(() => {
    if (open) reset(toDefaults(rule))
  }, [open, rule, reset])

  const matchType = useWatch({ control, name: 'matchType' }) as PutawayRuleMatchType

  const onSubmit = (values: FormValues) => {
    try {
      const directives = values.directives
        .map((r) => toTypedDirective(r as DirectiveRow))
        .filter((d): d is PutawayDirective => d !== null)

      if (directives.length !== values.directives.length) {
        setError('directives', { message: 'Completa el valor de todas las directivas.' })
        return
      }

      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        matchType: values.matchType as PutawayRuleMatchType,
        matchValue: values.matchValue.trim(),
        directives,
        priority: Math.max(0, parseInt(values.priority, 10) || 0),
        active: values.active,
      }
      if (rule) updatePutawayRule(rule.id, payload)
      else createPutawayRule(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al guardar la regla',
      })
    }
  }

  const renderMatchValue = () => {
    if (matchType === 'weightAboveKg') {
      return (
        <Input
          id="pwr-value"
          type="number"
          min={0}
          step="0.1"
          placeholder="60"
          {...register('matchValue')}
        />
      )
    }

    const options =
      matchType === 'category'
        ? categories.map((c) => ({ value: c, label: c }))
        : matchType === 'abcClass'
          ? ABC_CLASSES.map((c) => ({ value: c, label: `Clase ${c}` }))
          : (Object.keys(TRACK_BY_LABELS) as Product['trackBy'][]).map((t) => ({
              value: t,
              label: TRACK_BY_LABELS[t],
            }))

    return (
      <Controller
        control={control}
        name="matchValue"
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger id="pwr-value">
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regla de putaway' : 'Nueva regla de putaway'}</DialogTitle>
          <DialogDescription>
            Una regla aplica a los productos que hacen match una preferencia de zona (blanda) y/o
            restricciones duras de destino. Su efecto se ve al instante en la sugerencia de
            /receiving → Putaway staging.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="pwr-code">Código</FieldLabel>
              <Input id="pwr-code" placeholder="PWR-04" {...register('code')} />
              <FieldError errors={[errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pwr-priority">Prioridad</FieldLabel>
              <Input id="pwr-priority" type="number" min={0} {...register('priority')} />
              <FieldError errors={[errors.priority]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="pwr-name">Nombre</FieldLabel>
            <Input id="pwr-name" placeholder="Electrónica siempre en zona A" {...register('name')} />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Condición — si el producto cumple
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pwr-match">Atributo</FieldLabel>
                <Controller
                  control={control}
                  name="matchType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        setValue('matchValue', '')
                      }}
                    >
                      <SelectTrigger id="pwr-match">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATCH_TYPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {SLOTTING_MATCH_TYPE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pwr-value">
                  {matchType === 'weightAboveKg' ? 'Umbral (kg)' : 'Valor'}
                </FieldLabel>
                {renderMatchValue()}
                <FieldError errors={[errors.matchValue]} />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Entonces — directivas de destino
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => directivesArray.append({ kind: 'requireZone', value: '' })}
              >
                <Plus className="mr-1.5 size-3.5" />
                Directiva
              </Button>
            </div>
            <div className="space-y-2">
              {directivesArray.fields.map((f, i) => (
                <DirectiveRowFields
                  key={f.id}
                  control={control}
                  index={i}
                  zones={zones}
                  setValue={setValue}
                  onRemove={() => directivesArray.remove(i)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              «Preferir zona» es una preferencia blanda. El resto son restricciones duras: un
              candidato que las viola nunca se sugiere ni se acepta al confirmar el putaway.
            </p>
            <FieldError errors={[errors.directives?.root ?? errors.directives]} />
          </div>

          <Field>
            <FieldLabel htmlFor="pwr-desc">Descripción</FieldLabel>
            <Textarea id="pwr-desc" rows={2} placeholder="Motivo de negocio de la regla…" {...register('description')} />
          </Field>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="pwr-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="pwr-active" className="text-sm">
              Activa (afecta la sugerencia y validación de putaway)
            </Label>
          </div>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{rule ? 'Guardar cambios' : 'Crear regla'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create the settings page**

Create `src/app/(app)/putaway-settings/page.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { MapPin, MoreHorizontal, Pencil, Plus, Snowflake, Trash2, Zap, ClipboardCheck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeDirective, isHardDirective } from '@/lib/rules/slotting'
import { cn } from '@/lib/utils'
import type { PutawayRule } from '@/types/wms'
import { PutawayRuleDialog } from './_components/putaway-rule-dialog'

const describeCondition = (rule: PutawayRule): string => {
  switch (rule.matchType) {
    case 'category':
      return `Categoría = ${rule.matchValue}`
    case 'abcClass':
      return `Clase ABC = ${rule.matchValue}`
    case 'weightAboveKg':
      return `Peso ≥ ${rule.matchValue} kg`
    case 'trackBy':
      return `Trazabilidad = ${rule.matchValue === 'serial' ? 'Serie' : rule.matchValue === 'lot' ? 'Lote' : 'Sin trazabilidad'}`
  }
}

export default function PutawaySettingsPage() {
  const state = useWmsStore()
  const {
    settings,
    putawayRules,
    products,
    locations,
    asnRecords,
    updateSettings,
    togglePutawayRule,
    deletePutawayRule,
  } = state

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PutawayRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<PutawayRule | null>(null)

  const activeRules = putawayRules.filter((r) => r.active)
  const hazardApprovedCount = useMemo(() => locations.filter((l) => l.hazardApproved).length, [locations])
  const coldChainCount = useMemo(
    () => locations.filter((l) => l.temperatureZone && l.temperatureZone !== 'ambient').length,
    [locations]
  )
  const pendingPutawayCount = useMemo(
    () =>
      asnRecords.filter(
        (a) =>
          (a.status === 'completed' || a.status === 'partial' || a.status === 'short_received') &&
          !a.requiresQualityControl
      ).length,
    [asnRecords]
  )

  const handleOpenCreate = () => {
    setEditingRule(null)
    setRuleDialogOpen(true)
  }
  const handleOpenEdit = (rule: PutawayRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }
  const handleConfirmDelete = () => {
    if (deletingRule) deletePutawayRule(deletingRule.id)
    setDeletingRule(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Almacenamiento y Putaway"
        description="Gobierno del módulo de putaway: congelamiento, reglas de ubicación (zona/tipo/ABC/capacidad) y visibilidad de las restricciones siempre activas (hazmat, cadena de frío, mezcla de lotes). Los cambios afectan /receiving → Putaway staging al instante."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <ClipboardCheck className="size-3.5" /> Pendientes de putaway
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{pendingPutawayCount}</p>
            <p className="mt-1 text-xs text-zinc-500">ASNs listas para ubicar</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Zap className="size-3.5" /> Reglas activas
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{activeRules.length}</p>
            <p className="mt-1 text-xs text-zinc-500">de {putawayRules.length} reglas configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Zap className="size-3.5" /> Aprobadas hazmat
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{hazardApprovedCount}</p>
            <p className="mt-1 text-xs text-zinc-500">de {locations.length} ubicaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Snowflake className="size-3.5" /> Cadena de frío
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{coldChainCount}</p>
            <p className="mt-1 text-xs text-zinc-500">ubicaciones con temperatura controlada</p>
          </CardContent>
        </Card>
      </div>

      <Card
        className={cn(
          settings.putawayFreezeActive && 'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Congelar operaciones de putaway</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bloquea confirmar ubicación (putawayItem) y asignar operario. No afecta la
              configuración de reglas — puedes seguir ajustándolas mientras el módulo está congelado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.putawayFreezeActive && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                Congelado
              </Badge>
            )}
            <Switch
              checked={settings.putawayFreezeActive}
              onCheckedChange={(v) => updateSettings({ putawayFreezeActive: v })}
              aria-label="Congelar putaway"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="size-4" />
                Reglas de putaway
              </CardTitle>
              <CardDescription>
                Directivas de ubicación por zona/tipo/ABC. Las restricciones de hazmat, cadena de
                frío y mezcla de lotes están siempre activas y no se configuran aquí — dependen de
                los atributos del producto/ubicación editados en /admin y /locations.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-1.5 size-3.5" />
              Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {putawayRules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">
                Sin reglas configuradas. La sugerencia usa solo la clasificación ABC/XYZ y las
                restricciones siempre activas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regla</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead>Directivas</TableHead>
                  <TableHead className="text-right">Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...putawayRules]
                  .sort((a, b) => b.priority - a.priority)
                  .map((rule) => (
                    <TableRow key={rule.id} className="border-border/60">
                      <TableCell className="max-w-[280px]">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{rule.code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{describeCondition(rule)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.directives.map((d, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn('gap-1 font-normal', isHardDirective(d) && 'border-dashed')}
                            >
                              {describeDirective(d)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{rule.priority}</TableCell>
                      <TableCell>
                        {rule.active ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Switch
                            checked={rule.active}
                            onCheckedChange={() => togglePutawayRule(rule.id)}
                            aria-label={rule.active ? 'Desactivar regla' : 'Activar regla'}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="size-8 p-0">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                                <Pencil className="mr-2 size-3.5" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => togglePutawayRule(rule.id)}>
                                {rule.active ? 'Desactivar' : 'Activar'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeletingRule(rule)}>
                                <Trash2 className="mr-2 size-3.5" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PutawayRuleDialog open={ruleDialogOpen} rule={editingRule} onClose={() => setRuleDialogOpen(false)} />

      <Dialog open={deletingRule !== null} onOpenChange={(o) => !o && setDeletingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar regla</DialogTitle>
            <DialogDescription>
              ¿Eliminar la regla «{deletingRule?.name}»? La sugerencia de putaway dejará de
              considerarla. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRule(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Add the nav entry**

In `src/components/navigation/sidebar/sidebar-items.ts`, add `MapPin` (or reuse an existing icon — `PackageCheck` is already imported for `config-packing`; import a fresh one) to the lucide import block: find

```ts
  MapPinned,
  Package,
  PackageCheck,
```

and add `Warehouse` (not currently imported) right after `PackageCheck`:

```ts
  MapPinned,
  Package,
  PackageCheck,
  Warehouse,
```

Then find the `config` item's `subItems` array and add a new entry after `config-locations` (before `config-slotting`, since putaway sits between receiving and slotting in the domain flow):

```ts
          {
            id: 'config-locations',
            title: 'Ubicaciones',
            url: '/location-settings',
            icon: MapPinned,
          },
          { id: 'config-putaway', title: 'Putaway', url: '/putaway-settings', icon: Warehouse },
          { id: 'config-slotting', title: 'Slotting', url: '/slotting-settings', icon: Grid3x3 },
```

- [ ] **Step 4: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 5: Manual verification in the dev server**

Run: `npm run dev` (leave running)

1. Go to `/putaway-settings` (or navigate via sidebar → Sistema → Configuración → Putaway).
2. Confirm the KPI cards render real numbers (pending putaway count, active rules = 3, hazard-approved = 1, cold-chain = 1).
3. Confirm the rules table lists the 3 seeded `PutawayRule`s (`PWR-01`/`02`/`03`) with their directive chips.
4. Click "Nueva regla", fill it out (e.g. category = Accesorios, directive = requireZone → any zone), save, confirm it appears in the table.
5. Toggle it inactive/active via the row `Switch`, confirm the badge updates.
6. Delete it via the dropdown, confirm the confirmation dialog and removal.
7. Toggle "Congelar operaciones de putaway" on, then go to `/receiving` → Putaway staging → try to confirm a location on `asn-1` → confirm it's rejected with the frozen-module message. Toggle the freeze back off before continuing to other tasks' manual checks.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/putaway-settings" "src/components/navigation/sidebar/sidebar-items.ts"
git commit -m "$(cat <<'EOF'
feat(putaway): add /putaway-settings page with rule CRUD and freeze toggle

Mirrors /slotting-settings' layout and PutawayRuleDialog mirrors
SlottingRuleDialog — same react-hook-form/zod/useFieldArray pattern, wired
to the independent PutawayRule store slice. Nav entry added under
Sistema → Configuración, next to Ubicaciones/Slotting.
EOF
)"
```

---

### Task 8: Admin editing surfaces — hazmat/cold-chain on Product, restrictions on Location

**Files:**
- Modify: `src/app/(app)/admin/page.tsx`
- Modify: `src/app/(app)/locations/_components/location-form-dialog.tsx`

**Interfaces:**
- Consumes: `Product.isHazardous`/`requiresColdChain`, `StorageLocation.hazardApproved`/`temperatureZone`/`allowsLotMixing` (Task 1); `updateProduct`, `createLocation`/`updateLocation` (existing store actions, unchanged signatures — `Partial<...>` payloads already accept any subset of fields).

- [ ] **Step 1: Add the `Switch` import to `admin/page.tsx`**

Find the `import { Input } from '@/components/ui/input'` line and add right after it:

```ts
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
```

- [ ] **Step 2: Extend `PRODUCT_BLANK` and the product form state**

Find:

```ts
const PRODUCT_BLANK = { rotationStrategy: undefined as Product['rotationStrategy'], minStockUnits: '' as number | '', maxStockUnits: '' as number | '' }
```

Replace with:

```ts
const PRODUCT_BLANK = {
  rotationStrategy: undefined as Product['rotationStrategy'],
  minStockUnits: '' as number | '',
  maxStockUnits: '' as number | '',
  isHazardous: false,
  requiresColdChain: false,
}
```

Find:

```ts
  const handleOpenProductEdit = (product: Product) => {
    setProductEditId(product.id)
    setProductForm({
      rotationStrategy: product.rotationStrategy,
      minStockUnits: product.minStockUnits ?? '',
      maxStockUnits: product.maxStockUnits ?? '',
    })
    setProductEditOpen(true)
  }

  const handleSaveProduct = () => {
    if (!productEditId) return
    updateProduct(productEditId, {
      rotationStrategy: productForm.rotationStrategy,
      minStockUnits: productForm.minStockUnits === '' ? undefined : Number(productForm.minStockUnits),
      maxStockUnits: productForm.maxStockUnits === '' ? undefined : Number(productForm.maxStockUnits),
    })
    setProductEditOpen(false)
  }
```

Replace with:

```ts
  const handleOpenProductEdit = (product: Product) => {
    setProductEditId(product.id)
    setProductForm({
      rotationStrategy: product.rotationStrategy,
      minStockUnits: product.minStockUnits ?? '',
      maxStockUnits: product.maxStockUnits ?? '',
      isHazardous: product.isHazardous ?? false,
      requiresColdChain: product.requiresColdChain ?? false,
    })
    setProductEditOpen(true)
  }

  const handleSaveProduct = () => {
    if (!productEditId) return
    updateProduct(productEditId, {
      rotationStrategy: productForm.rotationStrategy,
      minStockUnits: productForm.minStockUnits === '' ? undefined : Number(productForm.minStockUnits),
      maxStockUnits: productForm.maxStockUnits === '' ? undefined : Number(productForm.maxStockUnits),
      isHazardous: productForm.isHazardous,
      requiresColdChain: productForm.requiresColdChain,
    })
    setProductEditOpen(false)
  }
```

- [ ] **Step 3: Add the checkboxes to the product edit dialog JSX**

Find the closing of the min/max stock `<div className="grid grid-cols-2 gap-3">...</div>` block inside the product dialog (right before `</div>` that closes `<div className="space-y-4 py-1">`):

```tsx
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="min-stock">Stock mínimo (uds)</Label>
                    <Input
                      id="min-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.minStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, minStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-stock">Stock máximo (uds)</Label>
                    <Input
                      id="max-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.maxStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, maxStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
```

Replace with (adds a new row after the stock inputs, still inside the same wrapping `<div className="space-y-4 py-1">`):

```tsx
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="min-stock">Stock mínimo (uds)</Label>
                    <Input
                      id="min-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.minStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, minStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-stock">Stock máximo (uds)</Label>
                    <Input
                      id="max-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.maxStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, maxStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Restricciones de putaway</p>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Material peligroso (hazmat)
                    <Switch
                      checked={productForm.isHazardous}
                      onCheckedChange={(v) => setProductForm((f) => ({ ...f, isHazardous: v }))}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Requiere cadena de frío
                    <Switch
                      checked={productForm.requiresColdChain}
                      onCheckedChange={(v) => setProductForm((f) => ({ ...f, requiresColdChain: v }))}
                    />
                  </label>
                </div>
              </div>
```

- [ ] **Step 4: Extend `location-form-dialog.tsx`'s schema, defaults, and payload**

In `src/app/(app)/locations/_components/location-form-dialog.tsx`, find the `schema` object and add three fields right after `golden: z.boolean(),`:

```ts
  isPickFace: z.boolean(),
  golden: z.boolean(),
  hazardApproved: z.boolean(),
  temperatureZone: z.string(),
  allowsLotMixing: z.boolean(),
```

Find `toDefaults` and add right after `golden: loc?.golden ?? false,`:

```ts
  isPickFace: loc?.isPickFace ?? true,
  golden: loc?.golden ?? false,
  hazardApproved: loc?.hazardApproved ?? false,
  temperatureZone: loc?.temperatureZone ?? 'ambient',
  allowsLotMixing: loc?.allowsLotMixing ?? true,
```

Find the `onSubmit` payload object and add right after `golden: values.golden,`:

```ts
        isPickFace: values.isPickFace,
        golden: values.golden,
        hazardApproved: values.hazardApproved,
        temperatureZone: values.temperatureZone as 'ambient' | 'refrigerated' | 'frozen',
        allowsLotMixing: values.allowsLotMixing,
```

- [ ] **Step 5: Add the fields to the form JSX**

Find the "Rack + flags" block:

```tsx
          {/* Rack + flags */}
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="loc-racktype">Tipo de estiba</FieldLabel>
              <Controller
                control={control}
                name="rackTypeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="loc-racktype">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_RACK}>Sin asignar</SelectItem>
                      {availableRacks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="flex items-end gap-6 pb-1.5">
              <Controller
                control={control}
                name="isPickFace"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Pick-face
                  </label>
                )}
              />
              <Controller
                control={control}
                name="golden"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="flex items-center gap-1">
                      <Star className="size-3.5 text-amber-500" /> Golden
                    </span>
                  </label>
                )}
              />
            </div>
          </div>
```

Add a new block right after it (before the "Atributos numéricos" block):

```tsx
          {/* Restricciones de putaway (módulo #3) */}
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Restricciones de putaway
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Controller
                control={control}
                name="hazardApproved"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Aprobada hazmat
                  </label>
                )}
              />
              <Controller
                control={control}
                name="allowsLotMixing"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Permite mezcla de lotes
                  </label>
                )}
              />
              <Field>
                <FieldLabel htmlFor="loc-temp" className="text-xs">Zona de temperatura</FieldLabel>
                <Controller
                  control={control}
                  name="temperatureZone"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="loc-temp">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ambient">Ambiente</SelectItem>
                        <SelectItem value="refrigerated">Refrigerado</SelectItem>
                        <SelectItem value="frozen">Congelado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </div>
```

- [ ] **Step 6: Verify clean typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 7: Manual end-to-end verification in the dev server**

Run: `npm run dev` (leave running)

1. Go to `/admin?tab=products`, edit **Nevera No Frost 320L** (`p-nevera`), toggle **"Material peligroso (hazmat)"** on, save.
2. Go to `/receiving` → **Putaway staging** tab → click **"Asignar ubicación"** on the `asn-1`/`p-nevera` row.
3. Confirm the manual dropdown now shows the previously-fine location(s) as **disabled** with a reason like "requiere una ubicación aprobada para materiales peligrosos", and `HZ-01-01` (⚡ badge) is selectable.
4. Select `HZ-01-01`, confirm, verify the ASN moves to "Ubicado" without error.
5. Go back to `/admin?tab=products`, toggle the hazmat flag back off on `p-nevera` (restore demo state for future runs — the ASN is already consumed, so this only matters for a fresh reseed, not required but good hygiene).
6. Go to `/locations`, edit any pick-face location, confirm the new "Restricciones de putaway" section renders (aprobada hazmat / permite mezcla de lotes switches, zona de temperatura select), toggle one, save, confirm no console errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/admin/page.tsx" "src/app/(app)/locations/_components/location-form-dialog.tsx"
git commit -m "$(cat <<'EOF'
feat(admin): edit hazmat/cold-chain on Product and restrictions on Location

Product edit dialog gains isHazardous/requiresColdChain switches;
StorageLocation edit dialog gains hazardApproved/allowsLotMixing switches
and a temperatureZone select — the attributes checkPutawayCompatibility
reads from.
EOF
)"
```

---

### Task 9: Final documentation

**Files:**
- Create: `docs/modulo_almacenamiento_putaway.md`

**Interfaces:**
- Consumes: nothing (documentation only) — references file paths/line anchors from Tasks 1–8.

- [ ] **Step 1: Write the module doc**

Create `docs/modulo_almacenamiento_putaway.md`, following the exact structure of `docs/modulo_reabastecimiento.md`/`docs/modulo_slotting.md`:

```md
# Módulo: Almacenamiento y Putaway

**Fecha:** 2026-07-23
**Alcance:** Niveles 🟢 Base y 🔵 Estándar del catálogo de referencia (`docs/funcionalidades_base_wms.md`, sección 3). MVP de demo con persistencia local (Zustand + IndexedDB), sin backend.

> Este documento describe qué hace el módulo, dónde vive en el código, qué datos de ejemplo se sembraron para la demo, y un guion paso a paso para presentarlo.

---

## 1. Para qué sirve

Decide y ejecuta *dónde guardar* la mercancía recién recibida, moviéndola desde la zona de
staging/QC a su ubicación definitiva. Coloca cada producto en la mejor posición posible según
reglas de negocio (zona, tipo de producto, clase ABC) y restricciones físicas/de seguridad
siempre activas (peligrosidad, cadena de frío, mezcla de lotes, compatibilidad de rack), para
densificar el uso del espacio y acortar los futuros recorridos de picking. Un buen putaway es la
base de un picking eficiente.

---

## 2. Checklist de funcionalidades cubiertas

### 🟢 Base

| # | Funcionalidad | Cómo está implementada |
|---|---|---|
| 1 | Putaway manual con validación de ubicación destino | `putawayItem()` (`src/store/wms-store.ts`) ahora llama `validatePutawayDestination()` (`src/lib/rules/putaway.ts`) antes de mutar inventario — rechaza ubicaciones bloqueadas, sin capacidad de peso/volumen, con rack incompatible, o que violan una restricción/regla activa. UI: `PutawayDialog` (`src/app/(app)/receiving/_components/putaway-dialog.tsx`) muestra el motivo en el banner de error si el envío falla. |
| 2 | Registro del movimiento con trazabilidad | Sin cambios — `putawayItem()` sigue registrando un `StockMovement` (`type: 'putaway'`) por cada unidad/serial movido, con `fromLocationId`/`toLocationId`/`operatorName`. Ahora el `operatorName` es el operario realmente autenticado (antes era el literal `'Operador'`), vía `useCurrentOperator()`. |

### 🔵 Estándar

| # | Funcionalidad | Cómo está implementada |
|---|---|---|
| 1 | Putaway dirigido por sistema | `suggestPutawayLocation()` (`src/lib/rules/putaway.ts`) resuelve la mejor ubicación disponible combinando clase ABC/XYZ, reglas `PutawayRule` activas y las restricciones siempre activas, con preferencia por consolidar en una ubicación que ya tenga el mismo producto. `usePutawayDialog` (`src/app/(app)/receiving/_hooks/use-putaway-dialog.ts`) prioriza: recomendación de slotting activa (re-validada) → sugerencia estática del ASN (re-validada) → este motor → selección manual. |
| 2 | Reglas de ubicación por zona, tipo de producto, ABC, capacidad | Nuevo tipo `PutawayRule` (`src/types/wms.ts`) — mismo shape que `SlottingRule` (matchType + directivas + prioridad) pero independiente, para que ajustar slotting nunca cambie el comportamiento de putaway. CRUD completo en **`/putaway-settings`** (`src/app/(app)/putaway-settings/page.tsx` + `PutawayRuleDialog`). 3 reglas sembradas: zona por categoría, preferencia de tier por clase ABC, compatibilidad de rack por categoría. |
| 3 | Restricciones: temperatura, peligrosidad, compatibilidad de producto, mezcla de lotes | `checkPutawayCompatibility()` (`src/lib/rules/putaway.ts`) — siempre activas, no configurables (son restricciones físicas/de seguridad, no reglas de negocio ajustables). Nuevos campos: `Product.isHazardous`/`requiresColdChain`, `StorageLocation.hazardApproved`/`temperatureZone`/`allowsLotMixing`. Reutiliza `checkRackCompatibility()` ya existente para la compatibilidad de producto/rack. |

---

## 3. Modelo de datos

```
PutawayRule                — regla de gobierno de destino (independiente de SlottingRule)
├── matchType: 'category' | 'abcClass' | 'weightAboveKg' | 'trackBy'
├── matchValue: string
├── directives: PutawayDirective[]   — preferTier | requireLocationType | requireZone |
│                                      requireGolden | forbidGolden | maxLevel | requireRackCompatible
├── priority: number
└── active: boolean

Product (campos nuevos)
├── isHazardous?: boolean
└── requiresColdChain?: boolean

StorageLocation (campos nuevos)
├── hazardApproved?: boolean
├── temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'
└── allowsLotMixing?: boolean          — default true cuando está ausente

WmsSettings (campo nuevo)
└── putawayFreezeActive: boolean       — congela putawayItem/assignPutaway (no el CRUD de reglas)
```

---

## 4. Dónde vive en el código

| Capa | Archivo |
|---|---|
| Tipos | `src/types/wms.ts` — `PutawayRule`/`PutawayDirective`, campos nuevos en `Product`/`StorageLocation`/`WmsSettings` |
| Reglas puras | `src/lib/rules/putaway.ts` — `checkPutawayCompatibility`, `validatePutawayDestination`, `suggestPutawayLocation`, `activePutawayMatchingRules` |
| Store | `src/store/wms-store.ts` — `putawayItem` (endurecido), `assignPutaway` (guardia de congelamiento), slice `putawayRules` + CRUD, `version: 9` |
| UI operativa | `src/app/(app)/receiving/_hooks/use-putaway-dialog.ts` + `_components/putaway-dialog.tsx` — sugerencia re-validada, dropdown con candidatos inválidos deshabilitados |
| UI de configuración | `src/app/(app)/putaway-settings/page.tsx` + `_components/putaway-rule-dialog.tsx` |
| Admin | `src/app/(app)/admin/page.tsx` (Producto: hazmat/cadena de frío), `src/app/(app)/locations/_components/location-form-dialog.tsx` (Ubicación: hazmat/temperatura/mezcla de lotes) |
| Navegación | `src/components/navigation/sidebar/sidebar-items.ts` — `config-putaway` bajo Sistema → Configuración |

---

## 5. Datos sembrados para la demo

- **Productos:** `p-bateria-litio` (Batería de Litio, `isHazardous: true`), `p-gas-refrigerante` (Cilindro de Gas Refrigerante, `requiresColdChain: true`).
- **Ubicaciones:** `loc-hazmat-01` (`HZ-01-01`, `hazardApproved: true`), `loc-cold-01` (`CC-01-01`, `temperatureZone: 'refrigerated'`); `loc-b0204` (`B-02-04`, ya existente) gana `allowsLotMixing: false` para demostrar la restricción de mezcla de lotes sobre un pick face ordinario.
- **Reglas:** `PWR-01` (Electrónica → zona A), `PWR-02` (Clase A → preferir golden), `PWR-03` (Línea Blanca → requiere rack compatible).
- **Ajuste puntual para el guion de demo:** ninguno de los productos existentes con ASN pendiente de putaway parte marcado como hazmat/cold-chain — el guion de abajo lo activa a propósito sobre `p-nevera` (`asn-1`) para mostrar el rechazo en vivo.

---

## 6. Guion de demo paso a paso

1. Abrir `/putaway-settings` — mostrar los 3 KPIs (pendientes, reglas activas, hazmat/cadena de frío) y la tabla de reglas.
2. Abrir `/admin?tab=products`, editar **Nevera No Frost 320L**, activar **"Material peligroso (hazmat)"**, guardar.
3. Ir a `/receiving` → pestaña **"Putaway staging"** → clic en **"Asignar ubicación"** sobre el ASN de la nevera.
4. Mostrar que la ubicación previamente sugerida ahora aparece deshabilitada en el desplegable, con el motivo "requiere una ubicación aprobada para materiales peligrosos" — y que `HZ-01-01` (badge ⚡) sí es seleccionable.
5. Confirmar el putaway hacia `HZ-01-01`; el ASN pasa a "Ubicado" y el movimiento queda en el libro de auditoría con el operario real (no `'Operador'`).
6. Volver a `/putaway-settings`, crear una regla nueva (ej. "Accesorios solo en zona A"), guardarla, mostrar que aparece en la tabla y se puede activar/desactivar/eliminar.
7. Activar el switch **"Congelar operaciones de putaway"**, volver a `/receiving` e intentar confirmar otra ubicación — mostrar el mensaje de módulo congelado. Desactivar el freeze al terminar.

---

## 7. Brechas conocidas (fuera de alcance de este trabajo)

- Las restricciones de hazmat/cadena de frío/mezcla de lotes solo se aplican en el flujo de
  putaway desde recepción (`putawayItem`) — **no** se retroalimentan en `/slotting` (reubicación de
  stock ya existente vía `relocateInventory`) ni en `/internal-moves`. Un producto podría, en
  teoría, terminar reubicado a una posición no apta por esas vías.
- `putawayItem` sigue asumiendo `warehouseId: 'wh-bog'` — no hay putaway multi-almacén en
  recepción (simplificación de alcance preexistente, no introducida por este trabajo).
- No existe un `PutawayTask` desacoplado del `Asn` con su propia máquina de estados — el putaway
  sigue viviendo como la transición `completed`/`short_received` → `putaway_done` del ASN.

---

*Generado con Claude Code — Módulo Almacenamiento y Putaway — 2026-07-23*
```

- [ ] **Step 2: Commit**

```bash
git add docs/modulo_almacenamiento_putaway.md
git commit -m "docs: add Almacenamiento y Putaway module documentation"
```

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage:** Base #1 (validation) → Task 5. Base #2 (traceability) → already existed, operator-identity fix in Task 5. Estándar #1 (system-directed) → Task 2 + 6. Estándar #2 (configurable rules) → Task 1/3/4/7. Estándar #3 (restrictions) → Task 1/2/3/8. IndexedDB persistence → already existed, version bump in Task 4. Settings under Sistema → Configuración → Task 7 Step 3. Final doc → Task 9. All covered.
- **Placeholder scan:** no TBDs; every step has literal code or an exact manual-test script.
- **Type consistency:** `PutawayRule`/`PutawayDirective`/`PutawayRuleMatchType`/`PutawayDirectiveKind` (Task 1) match the names used in Task 2 (engine), Task 4 (store), Task 6 (dialog), Task 7 (settings page + dialog) — verified no renames slipped in across tasks.
