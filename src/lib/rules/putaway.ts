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
