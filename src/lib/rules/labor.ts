import type { Asn, LaborQueueItem, PickingTask, ReplenishmentTask } from '@/types/wms'

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
