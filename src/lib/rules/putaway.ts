import type { StorageLocation, AbcClass } from '@/types/wms'
import { idealLocationTier } from '@/lib/rules/slotting'

interface SuggestArgs {
  abcClass: AbcClass
  productWeightKg: number
  productVolumeM3?: number
  locations: StorageLocation[]
  warehouseId?: string
}

/**
 * Returns the best available putaway location for a product given its ABC class.
 * A → golden zone, B → standard, C → remote.
 * Filters blocked locations and weight/volume constraints.
 * Among candidates, picks the one with highest accessibilityScore for A/B,
 * and lowest for C (to preserve prime slots for fast movers).
 */
export function suggestPutawayLocation({
  abcClass,
  productWeightKg,
  productVolumeM3 = 0,
  locations,
  warehouseId,
}: SuggestArgs): StorageLocation | null {
  // ponytail: select xyz to map ABC→tier correctly for putaway:
  // A→golden (use X), B→standard (use X), C→remote (use Z)
  const xyzClass = abcClass === 'C' ? 'Z' : 'X'
  const tier = idealLocationTier(abcClass, xyzClass)

  const eligible = locations.filter(loc => {
    if (loc.isBlocked) return false
    if (warehouseId && loc.warehouseId !== warehouseId) return false
    if (loc.maxWeightKg > 0 && productWeightKg > loc.maxWeightKg) return false
    if (loc.maxVolumeM3 > 0 && productVolumeM3 > loc.maxVolumeM3) return false
    if (loc.type !== 'pick' && loc.type !== 'reserve') return false
    return true
  })

  if (eligible.length === 0) return null

  if (tier === 'golden') {
    const golden = eligible.filter(l => l.golden)
    const pool = golden.length > 0 ? golden : eligible
    return pool.sort((a, b) => b.accessibilityScore - a.accessibilityScore)[0]
  }

  if (tier === 'remote') {
    return eligible.sort((a, b) => a.accessibilityScore - b.accessibilityScore)[0]
  }

  // standard — mid-range: not golden, highest remaining score
  const nonGolden = eligible.filter(l => !l.golden)
  const pool = nonGolden.length > 0 ? nonGolden : eligible
  return pool.sort((a, b) => b.accessibilityScore - a.accessibilityScore)[0]
}
