import type { OperationalStatus, PickingTaskStatus, ReturnStatus } from '@/types/wms'

export function canTransition<T extends string>(map: Record<string, T[]>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false
}

export const asnTransitions: Record<string, OperationalStatus[]> = {
  pending: ['in_progress', 'partial', 'completed', 'cancelled'],
  in_progress: ['partial', 'completed', 'cancelled', 'short_received'],
  partial: ['in_progress', 'completed', 'cancelled', 'short_received'],
  completed: ['putaway_done'],
  putaway_done: [],
  cancelled: [],
  short_received: [],
}

export const transferTransitions: Record<string, OperationalStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  in_progress: ['in_transit'],
  in_transit: ['partial_received', 'completed', 'cancelled'],
  partial_received: ['in_transit', 'completed', 'cancelled'],
  partial: ['completed'],
  completed: [],
  cancelled: [],
}

export const legTransitions: Record<string, string[]> = {
  pending: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export const commerceTransitions: Record<string, OperationalStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['partial', 'completed', 'ready_for_pickup', 'cancelled'],
  partial: ['completed', 'ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'], // BOPIS/Ship-from-Store: customer confirms pickup
  completed: [],
  cancelled: [],
}

export const returnTransitions: Record<string, ReturnStatus[]> = {
  requested: ['received_at_store', 'rejected'],
  received_at_store: ['in_transit_to_dc', 'under_validation', 'rejected'],
  in_transit_to_dc: ['received_at_dc'],
  received_at_dc: ['under_validation'],
  under_validation: [
    'sent_to_quality_control',
    'reentered',
    'sent_to_repair',
    'sent_to_scrap',
    'rejected',
  ],
  sent_to_quality_control: ['reentered', 'sent_to_repair', 'sent_to_scrap', 'rejected'],
  reentered: ['closed'],
  sent_to_repair: ['reentered', 'sent_to_scrap', 'closed'],
  sent_to_scrap: ['closed'],
  rejected: ['closed'],
  closed: [],
}

export const pickingTaskTransitions: Record<string, PickingTaskStatus[]> = {
  pending: ['assigned', 'with_issue'],
  assigned: ['in_progress', 'with_issue'],
  in_progress: ['partially_picked', 'completed', 'with_issue'],
  partially_picked: ['partial_with_shortage', 'partial_approved', 'partial_rejected', 'completed'],
  partial_with_shortage: ['partial_approved', 'partial_rejected'],
  partial_approved: ['completed'],
  partial_rejected: ['in_progress'],
  completed: [],
  with_issue: ['in_progress'],
}

export const waveTransitions: Record<string, OperationalStatus[]> = {
  draft: ['in_progress', 'cancelled'], // released
  in_progress: ['partial', 'completed', 'on_hold', 'cancelled'], // paused = on_hold
  on_hold: ['in_progress', 'cancelled'],
  partial: ['completed'],
  completed: [],
  cancelled: [],
}

export const sapRouteTransitions: Record<string, OperationalStatus[]> = {
  pending: ['synced'], // created in SAP -> synced
  synced: ['in_progress'], // planned/loading
  in_progress: ['in_transit'],
  in_transit: ['completed'],
  completed: [],
}
