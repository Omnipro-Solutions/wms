import type { PickingTask, ProductivityRow } from '@/types/wms'

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
