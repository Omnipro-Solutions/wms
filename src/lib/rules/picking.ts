import type { BatchTask, ClusterTask, PickingTask, ProductivityRow } from '@/types/wms'

export function pickingProgress(picked: number, requested: number): number {
  if (requested <= 0) return 0
  return Math.min(100, Math.round((picked / requested) * 100))
}

export function missingQuantity(requested: number, picked: number): number {
  return Math.max(0, requested - picked)
}

// Clamp a pick confirmation so it never exceeds requested (prevents over-picking).
export function clampPickedQuantity(picked: number, requested: number): number {
  return Math.max(0, Math.min(picked, requested))
}

// Order picking tasks so the most accessible locations are picked first.
export function orderTasksByAccessibility<T extends { accessibilityScore: number }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => b.accessibilityScore - a.accessibilityScore)
}

const COMPLETED_STATUSES: PickingTask['status'][] = [
  'completed',
  'partial_approved',
  'partially_picked',
  'partial_with_shortage',
]

// Group tasks by product+location to build batch candidates.
// Returns groups that have more than one order, sorted by total quantity desc.
export function groupTasksForBatch(
  tasks: PickingTask[]
): { productId: string; locationId: string; taskIds: string[]; totalQty: number }[] {
  const map = new Map<string, { taskIds: string[]; totalQty: number }>()
  for (const task of tasks) {
    if (task.status !== 'pending' && task.status !== 'assigned') continue
    const key = `${task.productId}::${task.locationId}`
    const entry = map.get(key) ?? { taskIds: [], totalQty: 0 }
    entry.taskIds.push(task.id)
    entry.totalQty += task.requestedQuantity
    map.set(key, entry)
  }
  return [...map.entries()]
    .filter(([, v]) => v.taskIds.length > 1)
    .map(([key, v]) => {
      const [productId, locationId] = key.split('::')
      return { productId, locationId, ...v }
    })
    .sort((a, b) => b.totalQty - a.totalQty)
}

export function batchProgress(batch: BatchTask): number {
  return pickingProgress(batch.totalPickedQuantity, batch.totalRequestedQuantity)
}

// Compute overall cluster completion as % of deposited items vs total requested.
export function clusterProgress(cluster: ClusterTask): number {
  let total = 0
  let deposited = 0
  for (const slot of cluster.slots) {
    for (const item of slot.items) {
      total += item.requested
      deposited += item.deposited
    }
  }
  return pickingProgress(deposited, total)
}

export function clusterSlotsCompleted(cluster: ClusterTask): number {
  return cluster.slots.filter((s) => s.completed).length
}

export function productivityByOperator(tasks: PickingTask[]): ProductivityRow[] {
  const byOperator = new Map<string, ProductivityRow>()
  for (const task of tasks) {
    const name = task.operatorName ?? 'Sin asignar'
    const row =
      byOperator.get(name) ??
      ({
        operatorName: name,
        picksCompleted: 0,
        unitsPicked: 0,
        partialCount: 0,
        issueCount: 0,
      } satisfies ProductivityRow)
    if (COMPLETED_STATUSES.includes(task.status)) {
      row.picksCompleted += 1
      row.unitsPicked += task.pickedQuantity
    }
    if (
      task.status === 'partially_picked' ||
      task.status === 'partial_with_shortage' ||
      task.status === 'partial_approved' ||
      task.status === 'partial_rejected'
    ) {
      row.partialCount += 1
    }
    if (task.status === 'with_issue') row.issueCount += 1
    byOperator.set(name, row)
  }
  return [...byOperator.values()].sort((a, b) => b.unitsPicked - a.unitsPicked)
}

// Suggests a priority level from hours remaining until dispatch deadline.
// Pure default — callers may still let the user override it manually.
export function derivePriorityFromSla(
  dispatchDeadline: string,
  now: Date,
  settings: { pickingSlaUrgentHours: number; pickingSlaWarningHours: number }
): 'low' | 'medium' | 'high' {
  const deadline = new Date(dispatchDeadline)
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursRemaining < settings.pickingSlaUrgentHours) return 'high'
  if (hoursRemaining < settings.pickingSlaWarningHours) return 'medium'
  return 'low'
}
