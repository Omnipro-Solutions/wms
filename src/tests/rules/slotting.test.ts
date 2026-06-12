import { describe, it, expect } from 'vitest'
import {
  classifyAbc,
  classifyXyz,
  estimatedDistanceSaved,
  slottingScore,
} from '@/lib/rules/slotting'

describe('classifyAbc', () => {
  it('assigns A to the highest-rotation products', () => {
    const result = classifyAbc([
      { productId: 'p1', metric: 80 },
      { productId: 'p2', metric: 15 },
      { productId: 'p3', metric: 5 },
    ])
    expect(result.p1).toBe('A')
    expect(result.p2).toBe('B')
    expect(result.p3).toBe('C')
  })
  it('handles all-zero metrics as C', () => {
    const result = classifyAbc([{ productId: 'p1', metric: 0 }])
    expect(result.p1).toBe('C')
  })
})

describe('classifyXyz', () => {
  it('classifies stable demand as X', () => {
    expect(classifyXyz([10, 10, 10, 10])).toBe('X')
  })
  it('classifies erratic demand as Z', () => {
    expect(classifyXyz([0, 0, 50, 1])).toBe('Z')
  })
  it('returns Z for empty samples', () => {
    expect(classifyXyz([])).toBe('Z')
  })
})

describe('slottingScore', () => {
  it('rewards moving an A item to a golden, closer, more accessible location', () => {
    const score = slottingScore({
      abcClass: 'A',
      product: { unitWeightKg: 1 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    })
    expect(score).toBeGreaterThan(0)
  })
  it('returns 0 when the product exceeds candidate max weight', () => {
    const score = slottingScore({
      abcClass: 'A',
      product: { unitWeightKg: 10 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    })
    expect(score).toBe(0)
  })
})

describe('estimatedDistanceSaved', () => {
  it('multiplies distance delta by picking frequency', () => {
    expect(estimatedDistanceSaved(50, 10, 4)).toBe(160)
  })
  it('never returns negative', () => {
    expect(estimatedDistanceSaved(10, 50, 4)).toBe(0)
  })
})
