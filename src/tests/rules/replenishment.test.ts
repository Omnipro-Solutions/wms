import { describe, it, expect } from 'vitest'
import {
  needsReplenishment,
  replenishmentPriority,
  suggestedReplenishmentQuantity,
} from '@/lib/rules/replenishment'

describe('replenishmentPriority', () => {
  it('is high below 50% of min', () => {
    expect(replenishmentPriority(4, 10)).toBe('high')
  })
  it('is medium below min', () => {
    expect(replenishmentPriority(8, 10)).toBe('medium')
  })
  it('is low at or above min', () => {
    expect(replenishmentPriority(12, 10)).toBe('low')
  })
})

describe('suggestedReplenishmentQuantity', () => {
  it('fills up to max', () => {
    expect(suggestedReplenishmentQuantity(3, 10)).toBe(7)
  })
  it('never negative', () => {
    expect(suggestedReplenishmentQuantity(15, 10)).toBe(0)
  })
})

describe('needsReplenishment', () => {
  it('true below min', () => {
    expect(needsReplenishment(5, 10)).toBe(true)
  })
})
