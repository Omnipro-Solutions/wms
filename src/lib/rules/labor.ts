import type { Asn, LaborQueueItem, PickingTask, ReplenishmentTask } from '@/types/wms'
import type { ProductivityRow } from '@/types/wms'

const PICKING_ACTIVE_STATUSES: PickingTask['status'][] = [
  'pending',
  'assigned',
  'in_progress',
  'partially_picked',
  'partial_with_shortage',
  'with_issue',
]

const REPLENISHMENT_ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress']

// An ASN is ready for putaway once receiving is done (`completed` / `short_received`)
// and hasn't been put away yet (`putaway_done` excluded).
const ASN_READY_FOR_PUTAWAY_STATUSES = ['completed', 'short_received']

export function buildLaborQueue(
  pickingTasks: PickingTask[],
  replenishmentTasks: ReplenishmentTask[],
  asns: Asn[]
): LaborQueueItem[] {
  const pickingItems: LaborQueueItem[] = pickingTasks
    .filter((t) => PICKING_ACTIVE_STATUSES.includes(t.status))
    .map((t) => ({
      id: t.id,
      sourceType: 'picking',
      code: t.code,
      productId: t.productId,
      locationId: t.locationId,
      zone: t.zone,
      priority: t.priority,
      status: t.status,
      operatorName: t.operatorName,
    }))

  const replenishmentItems: LaborQueueItem[] = replenishmentTasks
    .filter((t) => REPLENISHMENT_ACTIVE_STATUSES.includes(t.status))
    .map((t) => ({
      id: t.id,
      sourceType: 'replenishment',
      code: t.id,
      productId: t.productId,
      locationId: t.destinationLocationId,
      priority: t.priority,
      status: t.status,
      operatorName: t.operatorName,
    }))

  const putawayItems: LaborQueueItem[] = asns
    .filter((a) => ASN_READY_FOR_PUTAWAY_STATUSES.includes(a.status))
    .map((a) => ({
      id: a.id,
      sourceType: 'putaway',
      code: a.code,
      productId: a.productId,
      locationId: a.suggestedPutawayLocationId ?? '',
      priority: 'medium' as const,
      status: a.status,
      operatorName: a.assignedOperatorName,
    }))

  return [...pickingItems, ...replenishmentItems, ...putawayItems]
}

export function suggestInterleavedRoutes(
  items: LaborQueueItem[],
  getLocation: (id: string) => { distanceToDispatchM: number } | undefined,
  maxDistanceM: number
): LaborQueueItem[] {
  const byOperator = new Map<string, LaborQueueItem[]>()
  for (const item of items) {
    if (!item.operatorName) continue
    const bucket = byOperator.get(item.operatorName) ?? []
    bucket.push(item)
    byOperator.set(item.operatorName, bucket)
  }

  const routeIdByItemId = new Map<string, string>()
  let routeCounter = 0

  for (const [operatorName, bucket] of byOperator) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]
        const b = bucket[j]
        if (a.sourceType === b.sourceType) continue
        if (routeIdByItemId.has(a.id) && routeIdByItemId.has(b.id)) continue

        const locA = getLocation(a.locationId)
        const locB = getLocation(b.locationId)
        if (!locA || !locB) continue

        const distance = Math.abs(locA.distanceToDispatchM - locB.distanceToDispatchM)
        if (distance > maxDistanceM) continue

        const existingRouteId = routeIdByItemId.get(a.id) ?? routeIdByItemId.get(b.id)
        const routeId = existingRouteId ?? `route-${operatorName}-${routeCounter++}`
        routeIdByItemId.set(a.id, routeId)
        routeIdByItemId.set(b.id, routeId)
      }
    }
  }

  return items.map((item) =>
    routeIdByItemId.has(item.id) ? { ...item, suggestedRouteId: routeIdByItemId.get(item.id) } : item
  )
}

export function productivityByAllSources(
  pickingTasks: PickingTask[],
  replenishmentTasks: ReplenishmentTask[],
  asns: Asn[]
): ProductivityRow[] {
  const byOperator = new Map<string, ProductivityRow>()

  const getRow = (operatorName: string): ProductivityRow => {
    const existing = byOperator.get(operatorName)
    if (existing) return existing
    const row: ProductivityRow = { operatorName, picksCompleted: 0, unitsPicked: 0, partialCount: 0, issueCount: 0 }
    byOperator.set(operatorName, row)
    return row
  }

  for (const t of pickingTasks) {
    if (t.status !== 'completed' || !t.operatorName) continue
    const row = getRow(t.operatorName)
    row.picksCompleted += 1
    row.unitsPicked += t.pickedQuantity
  }

  for (const t of replenishmentTasks) {
    if (t.status !== 'completed' || !t.operatorName) continue
    const row = getRow(t.operatorName)
    row.unitsPicked += t.suggestedQuantity
  }

  for (const a of asns) {
    if (a.status !== 'putaway_done' || !a.assignedOperatorName) continue
    const row = getRow(a.assignedOperatorName)
    row.unitsPicked += a.receivedQuantity
  }

  return Array.from(byOperator.values())
}
