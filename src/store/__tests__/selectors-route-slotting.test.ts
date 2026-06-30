import { describe, it, expect } from 'vitest'
import { selectRouteSlottingRecommendations } from '../selectors'
import * as seed from '@/data/seed'

const mockState = {
  ...seed,
  asnRecords: seed.asnRecords,
  // seed has loadManifests with sapRouteId 'sap-rt-001' and 'sap-rt-002'
}

describe('selectRouteSlottingRecommendations', () => {
  it('returns an array (may be empty with current seed)', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    expect(Array.isArray(recs)).toBe(true)
  })

  it('each recommendation has required fields', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    for (const rec of recs) {
      expect(rec).toHaveProperty('productId')
      expect(rec).toHaveProperty('routeCode')
      expect(rec).toHaveProperty('distanceGainM')
      expect(rec.score).toBeGreaterThanOrEqual(0)
      expect(rec.score).toBeLessThanOrEqual(100)
    }
  })

  it('excludes products without a dominant route (< 40%)', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    for (const rec of recs) {
      expect(rec.routePickFrequency).toBeGreaterThanOrEqual(0.4)
    }
  })
})
