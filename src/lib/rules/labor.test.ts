import { describe, it, expect } from 'vitest'
import { buildLaborQueue, suggestInterleavedRoutes, productivityByAllSources } from './labor'
import type { PickingTask, ReplenishmentTask, Asn } from '@/types/wms'

const pickingTask = (overrides: Partial<PickingTask> = {}): PickingTask => ({
  id: 'pt-1',
  code: 'PICK-001',
  orderId: 'order-1',
  productId: 'prod-1',
  locationId: 'loc-1',
  zone: 'A',
  requestedQuantity: 10,
  pickedQuantity: 0,
  pendingQuantity: 10,
  status: 'pending',
  priority: 'high',
  ...overrides,
})

const replenishmentTask = (overrides: Partial<ReplenishmentTask> = {}): ReplenishmentTask => ({
  id: 'rt-1',
  productId: 'prod-2',
  originLocationId: 'loc-reserve-1',
  destinationLocationId: 'loc-2',
  currentStock: 5,
  minStock: 10,
  maxStock: 40,
  suggestedQuantity: 20,
  priority: 'medium',
  status: 'pending',
  ...overrides,
})

const asn = (overrides: Partial<Asn> = {}): Asn => ({
  id: 'asn-1',
  code: 'ASN-001',
  supplierName: 'Proveedor X',
  appointmentDate: '2026-07-20T10:00:00.000Z',
  expectedQuantity: 100,
  receivedQuantity: 100,
  damagedQuantity: 0,
  status: 'completed',
  requiresQualityControl: false,
  crossDocking: false,
  productId: 'prod-3',
  deliveryCount: 1,
  sourceType: 'purchase',
  ...overrides,
})

describe('buildLaborQueue', () => {
  it('returns an empty array when there are no source tasks', () => {
    expect(buildLaborQueue([], [], [])).toEqual([])
  })

  it('maps a pending picking task to a queue item', () => {
    const result = buildLaborQueue([pickingTask()], [], [])
    expect(result).toEqual([
      {
        id: 'pt-1',
        sourceType: 'picking',
        code: 'PICK-001',
        productId: 'prod-1',
        locationId: 'loc-1',
        zone: 'A',
        priority: 'high',
        status: 'pending',
        operatorName: undefined,
      },
    ])
  })

  it('maps a pending replenishment task to a queue item using destinationLocationId', () => {
    const result = buildLaborQueue([], [replenishmentTask()], [])
    expect(result).toEqual([
      {
        id: 'rt-1',
        sourceType: 'replenishment',
        code: 'rt-1',
        productId: 'prod-2',
        locationId: 'loc-2',
        zone: undefined,
        priority: 'medium',
        status: 'pending',
        operatorName: undefined,
      },
    ])
  })

  it('maps a completed ASN (pending putaway) to a queue item using suggestedPutawayLocationId', () => {
    const result = buildLaborQueue([], [], [asn({ suggestedPutawayLocationId: 'loc-3' })])
    expect(result).toEqual([
      {
        id: 'asn-1',
        sourceType: 'putaway',
        code: 'ASN-001',
        productId: 'prod-3',
        locationId: 'loc-3',
        zone: undefined,
        priority: 'medium',
        status: 'completed',
        operatorName: undefined,
      },
    ])
  })

  it('excludes ASNs not yet ready for putaway (still in_progress) and already put away (putaway_done)', () => {
    const result = buildLaborQueue(
      [],
      [],
      [asn({ id: 'asn-2', status: 'in_progress' }), asn({ id: 'asn-3', status: 'putaway_done' })]
    )
    expect(result).toEqual([])
  })

  it('excludes completed picking tasks and completed replenishment tasks', () => {
    const result = buildLaborQueue(
      [pickingTask({ status: 'completed' })],
      [replenishmentTask({ status: 'completed' })],
      []
    )
    expect(result).toEqual([])
  })

  it('carries operatorName and assignedOperatorName through as operatorName', () => {
    const result = buildLaborQueue(
      [pickingTask({ operatorName: 'Juan' })],
      [],
      [asn({ assignedOperatorName: 'Ana', id: 'asn-4' })]
    )
    expect(result.find((i) => i.sourceType === 'picking')?.operatorName).toBe('Juan')
    expect(result.find((i) => i.sourceType === 'putaway')?.operatorName).toBe('Ana')
  })

  it('mixes all three source types into one array', () => {
    const result = buildLaborQueue([pickingTask()], [replenishmentTask()], [asn()])
    expect(result).toHaveLength(3)
    expect(result.map((i) => i.sourceType).sort()).toEqual(['picking', 'putaway', 'replenishment'])
  })
})

describe('suggestInterleavedRoutes', () => {
  const locations: Record<string, { distanceToDispatchM: number }> = {
    'loc-1': { distanceToDispatchM: 10 },
    'loc-2': { distanceToDispatchM: 15 },
    'loc-far': { distanceToDispatchM: 200 },
  }
  const getLocation = (id: string) => locations[id]

  it('does not group items for different operators', () => {
    const items = [
      { ...pickingTask(), id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', operatorName: 'Juan', priority: 'high' as const, status: 'pending' },
      { ...pickingTask(), id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', operatorName: 'Ana', priority: 'medium' as const, status: 'pending' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('does not group items of the same operator if distance exceeds maxDistanceM', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-far', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('groups two different-type items for the same operator within maxDistanceM', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result[0].suggestedRouteId).toBeDefined()
    expect(result[0].suggestedRouteId).toBe(result[1].suggestedRouteId)
  })

  it('does not group two items of the same sourceType even for the same operator nearby', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'picking' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('does not group unassigned items (no operatorName)', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })
})

describe('productivityByAllSources', () => {
  it('returns an empty array when nothing is completed', () => {
    expect(productivityByAllSources([], [], [])).toEqual([])
  })

  it('counts completed picking tasks per operator', () => {
    const tasks = [
      pickingTask({ id: 'p1', status: 'completed', operatorName: 'Juan', pickedQuantity: 10 }),
      pickingTask({ id: 'p2', status: 'completed', operatorName: 'Juan', pickedQuantity: 5 }),
    ]
    const result = productivityByAllSources(tasks, [], [])
    expect(result).toEqual([
      { operatorName: 'Juan', picksCompleted: 2, unitsPicked: 15, partialCount: 0, issueCount: 0 },
    ])
  })

  it('adds completed replenishment and putaway counts to the same operator row as extra units', () => {
    const tasks = [pickingTask({ id: 'p1', status: 'completed', operatorName: 'Juan', pickedQuantity: 10 })]
    const repl = [
      replenishmentTask({ id: 'r1', status: 'completed', operatorName: 'Juan', suggestedQuantity: 20 }),
    ]
    const asnsCompleted = [asn({ id: 'a1', status: 'putaway_done', assignedOperatorName: 'Juan', receivedQuantity: 30 })]
    const result = productivityByAllSources(tasks, repl, asnsCompleted)
    expect(result).toEqual([
      { operatorName: 'Juan', picksCompleted: 2, unitsPicked: 60, partialCount: 0, issueCount: 0 },
    ])
  })
})
