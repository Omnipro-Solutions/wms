// Centralized status -> variant + Spanish label mapping. Do not duplicate
// this logic across pages; use the StatusBadge component which reads from here.

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'progress'

interface StatusMeta {
  label: string
  variant: StatusVariant
}

// Covers OperationalStatus, ReturnStatus, PickingTaskStatus and other unions.
const STATUS_MAP: Record<string, StatusMeta> = {
  // OperationalStatus
  draft: { label: 'Borrador', variant: 'neutral' },
  pending: { label: 'Pendiente', variant: 'warning' },
  assigned: { label: 'Asignado', variant: 'info' },
  in_progress: { label: 'En progreso', variant: 'progress' },
  partial: { label: 'Parcial', variant: 'warning' },
  completed: { label: 'Completado', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
  in_transit: { label: 'En tránsito', variant: 'info' },
  on_hold: { label: 'En espera', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
  synced: { label: 'Sincronizado', variant: 'success' },

  // ReturnStatus
  requested: { label: 'Solicitada', variant: 'neutral' },
  received_at_store: { label: 'Recibida en tienda', variant: 'info' },
  in_transit_to_dc: { label: 'En tránsito a CEDI', variant: 'info' },
  received_at_dc: { label: 'Recibida en CEDI', variant: 'info' },
  under_validation: { label: 'En validación', variant: 'progress' },
  sent_to_quality_control: { label: 'En control de calidad', variant: 'progress' },
  reentered: { label: 'Reingresada', variant: 'success' },
  sent_to_repair: { label: 'En reparación', variant: 'warning' },
  sent_to_scrap: { label: 'En descarte', variant: 'danger' },
  rejected: { label: 'Rechazada', variant: 'danger' },
  closed: { label: 'Cerrada', variant: 'neutral' },

  // PickingTaskStatus
  partially_picked: { label: 'Parcialmente preparado', variant: 'warning' },
  partial_with_shortage: { label: 'Parcial con faltante', variant: 'warning' },
  partial_approved: { label: 'Parcial aprobado', variant: 'success' },
  partial_rejected: { label: 'Parcial rechazado', variant: 'danger' },
  with_issue: { label: 'Con incidencia', variant: 'danger' },

  // Inventory item status
  available: { label: 'Disponible', variant: 'success' },
  reserved: { label: 'Reservado', variant: 'info' },
  expired: { label: 'Vencido', variant: 'danger' },
  damaged: { label: 'Dañado', variant: 'danger' },

  // Integration status
  active: { label: 'Activo', variant: 'success' },
  inactive: { label: 'Inactivo', variant: 'neutral' },
  pending_configuration: { label: 'Pendiente configuración', variant: 'warning' },

  // OTIF
  on_time: { label: 'A tiempo', variant: 'success' },
  at_risk: { label: 'En riesgo', variant: 'warning' },
  late: { label: 'Tarde', variant: 'danger' },

  // Packing verification
  verified: { label: 'Verificado', variant: 'success' },
  mismatch: { label: 'Discrepancia', variant: 'danger' },
  labelled: { label: 'Etiquetado', variant: 'progress' },
  dispatched: { label: 'Despachado', variant: 'success' },
}

export function statusMeta(status: string): StatusMeta {
  return STATUS_MAP[status] ?? { label: status, variant: 'neutral' }
}

export function statusLabel(status: string): string {
  return statusMeta(status).label
}

export function statusVariant(status: string): StatusVariant {
  return statusMeta(status).variant
}
