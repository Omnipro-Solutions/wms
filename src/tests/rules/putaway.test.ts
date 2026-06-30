import { describe, it, expect } from 'vitest'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
import type { StorageLocation } from '@/types/wms'

const makeLocation = (overrides: Partial<StorageLocation>): StorageLocation => ({
  id: 'loc-1', code: 'A-01-01', barcode: 'LOC-A-A0101', warehouseId: 'wh-1', zone: 'A',
  type: 'pick', isPickFace: false, golden: false, isBlocked: false,
  accessibilityScore: 50, maxWeightKg: 500, volumeCapacityM3: 2.0, maxVolumeM3: 2.0,
  distanceToDispatchM: 10,
  ...overrides,
})

describe('suggestPutawayLocation', () => {
  const locations: StorageLocation[] = [
    makeLocation({ id: 'loc-golden', golden: true, accessibilityScore: 90, distanceToDispatchM: 5 }),
    makeLocation({ id: 'loc-std',    golden: false, accessibilityScore: 60, distanceToDispatchM: 20 }),
    makeLocation({ id: 'loc-remote', golden: false, accessibilityScore: 20, distanceToDispatchM: 80 }),
    makeLocation({ id: 'loc-blocked', golden: true, isBlocked: true }),
    makeLocation({ id: 'loc-full', golden: false, maxWeightKg: 10, accessibilityScore: 70, distanceToDispatchM: 15 }),
  ]

  it('class A product: prefers golden location', () => {
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 5, locations })
    expect(result?.id).toBe('loc-golden')
  })

  it('class C product: prefers remote (lowest accessibilityScore)', () => {
    const result = suggestPutawayLocation({ abcClass: 'C', productWeightKg: 5, locations })
    expect(result?.id).toBe('loc-remote')
  })

  it('excludes blocked locations', () => {
    const onlyBlocked = [makeLocation({ id: 'loc-blocked', isBlocked: true })]
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 5, locations: onlyBlocked })
    expect(result).toBeNull()
  })

  it('excludes locations where product exceeds maxWeightKg', () => {
    const heavyProduct = suggestPutawayLocation({ abcClass: 'B', productWeightKg: 600, locations })
    // loc-full has maxWeightKg: 10, loc-blocked is blocked — heavyProduct can't go there
    expect(heavyProduct?.id).not.toBe('loc-full')
  })

  it('returns null when no suitable location', () => {
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 99999, locations })
    expect(result).toBeNull()
  })
})
