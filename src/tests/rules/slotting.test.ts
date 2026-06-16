import { describe, it, expect } from 'vitest'
import {
  buildAffinityMatrix,
  classifyAbc,
  classifyXyz,
  estimatedDistanceSaved,
  slottingScore,
} from '@/lib/rules/slotting'
import type { CommerceOrder } from '@/types/wms'

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
  it('rewards moving an AX item to a golden, closer, more accessible location', () => {
    const score = slottingScore({
      abcClass: 'A',
      xyzClass: 'X',
      product: { unitWeightKg: 1 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    })
    expect(score).toBeGreaterThan(0)
  })
  it('returns 0 when the product exceeds candidate max weight', () => {
    const score = slottingScore({
      abcClass: 'A',
      xyzClass: 'X',
      product: { unitWeightKg: 10 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    })
    expect(score).toBe(0)
  })
  it('returns 0 for AZ items being moved to golden zone (erratic demand wastes prime space)', () => {
    const score = slottingScore({
      abcClass: 'A',
      xyzClass: 'Z',
      product: { unitWeightKg: 1 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    })
    expect(score).toBe(0)
  })
  it('scores AX higher than AY for same location move', () => {
    const base = {
      product: { unitWeightKg: 1 },
      current: { accessibilityScore: 20, golden: false, distanceToDispatchM: 50 },
      candidate: { accessibilityScore: 90, golden: true, distanceToDispatchM: 10, maxWeightKg: 5 },
    }
    const ax = slottingScore({ abcClass: 'A', xyzClass: 'X', ...base })
    const ay = slottingScore({ abcClass: 'A', xyzClass: 'Y', ...base })
    expect(ax).toBeGreaterThan(ay)
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

describe('buildAffinityMatrix', () => {
  const makeOrder = (id: string, productIds: string[]): CommerceOrder => ({
    id,
    orderNumber: id,
    channel: 'ecommerce',
    customerName: 'Test',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    promisedDeliveryDate: '2026-01-02',
    fulfillmentType: 'ship_from_dc',
    items: productIds.map((pid, i) => ({
      id: `${id}-${i}`,
      productId: pid,
      requestedQuantity: 1,
    })),
  })

  it('returns empty for orders with single products', () => {
    const orders = [makeOrder('o1', ['p1']), makeOrder('o2', ['p2'])]
    expect(buildAffinityMatrix(orders)).toHaveLength(0)
  })

  it('detects a co-occurring pair', () => {
    const orders = [
      makeOrder('o1', ['p1', 'p2']),
      makeOrder('o2', ['p1', 'p2']),
      makeOrder('o3', ['p1']),
    ]
    const matrix = buildAffinityMatrix(orders)
    expect(matrix).toHaveLength(1)
    expect(matrix[0].coOccurrences).toBe(2)
    expect(matrix[0].proximityScore).toBeGreaterThan(0)
  })

  it('ranks pairs with higher proximity score first', () => {
    const orders = [
      makeOrder('o1', ['p1', 'p2']),
      makeOrder('o2', ['p1', 'p2']),
      makeOrder('o3', ['p1', 'p2']),
      makeOrder('o4', ['p3', 'p4']),
    ]
    const matrix = buildAffinityMatrix(orders)
    // Result must be sorted descending by proximityScore
    for (let i = 1; i < matrix.length; i++) {
      expect(matrix[i - 1].proximityScore).toBeGreaterThanOrEqual(matrix[i].proximityScore)
    }
  })

  it('lift is above 1 when pair appears more than expected by chance', () => {
    const orders = [
      makeOrder('o1', ['p1', 'p2']),
      makeOrder('o2', ['p1', 'p2']),
      makeOrder('o3', ['p3']),
      makeOrder('o4', ['p4']),
    ]
    const matrix = buildAffinityMatrix(orders)
    const pair = matrix.find(
      (m) =>
        (m.productA === 'p1' && m.productB === 'p2') ||
        (m.productA === 'p2' && m.productB === 'p1')
    )
    expect(pair?.liftScore).toBeGreaterThan(1)
  })
})
