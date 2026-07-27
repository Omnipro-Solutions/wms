// Yard/Dock management (#8) — pure rules. No store/React imports.
import type {
  Asn,
  Dock,
  DockAppointment,
  DockAppointmentStatus,
  DockAppointmentType,
  DockType,
  StorageLocation,
  WmsSettings,
} from '@/types/wms'

export const DOCK_TYPE_LABELS: Record<DockType, string> = {
  inbound: 'Entrada',
  outbound: 'Salida',
  mixed: 'Mixto',
}

export const APPOINTMENT_TYPE_LABELS: Record<DockAppointmentType, string> = {
  inbound: 'Llegada',
  outbound: 'Salida',
}

export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

// A dock only serves appointments matching its declared traffic direction,
// unless it's 'mixed' (serves both inbound and outbound).
export const isDockCompatible = (dock: Pick<Dock, 'type'>, appointmentType: DockAppointmentType): boolean =>
  dock.type === 'mixed' || dock.type === appointmentType

// 'HH:mm' extracted from the time portion of an ISO datetime string.
const timeOf = (isoDateTime: string): string => isoDateTime.slice(11, 16)

export const isWithinOperatingHours = (
  scheduledStart: string,
  scheduledEnd: string,
  settings: Pick<WmsSettings, 'yardOperatingHoursStart' | 'yardOperatingHoursEnd'>
): boolean =>
  timeOf(scheduledStart) >= settings.yardOperatingHoursStart &&
  timeOf(scheduledEnd) <= settings.yardOperatingHoursEnd

// Reads only the calendar-date portion (YYYY-MM-DD) and anchors it at UTC
// midnight — immune to the runtime's local timezone or to whether
// isoDateTime itself carries a time/zone suffix.
export const isWorkingDay = (isoDateTime: string, workingDays: number[]): boolean => {
  const [year, month, day] = isoDateTime.slice(0, 10).split('-').map(Number)
  return workingDays.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
}

// Two time ranges overlap when one starts before the other ends, both ways.
const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart < bEnd && aEnd > bStart

const ACTIVE_APPOINTMENT_STATUSES = new Set<DockAppointment['status']>([
  'scheduled',
  'arrived',
  'in_progress',
])

// Whether assigning `dockId` to a new/edited appointment in [start, end) would
// collide with another still-active appointment already on that dock.
export const hasDockConflict = (
  appointments: DockAppointment[],
  dockId: string,
  start: string,
  end: string,
  excludeAppointmentId?: string
): boolean =>
  appointments.some(
    (a) =>
      a.id !== excludeAppointmentId &&
      a.dockId === dockId &&
      ACTIVE_APPOINTMENT_STATUSES.has(a.status) &&
      rangesOverlap(start, end, a.scheduledStart, a.scheduledEnd)
  )

// An appointment is "at risk" once it's past its scheduled start by the
// configured late threshold and no truck has checked in yet.
export const isAppointmentAtRisk = (
  appointment: Pick<DockAppointment, 'status' | 'scheduledStart'>,
  nowMs: number,
  lateThresholdMinutes: number
): boolean => {
  if (appointment.status !== 'scheduled') return false
  const scheduledMs = new Date(appointment.scheduledStart).getTime()
  return nowMs - scheduledMs > lateThresholdMinutes * 60_000
}

// ─── Sugerencia automática de muelle ──────────────────────────────────────────
// Manhattan asigna el muelle por tipo de mercancía, urgencia y zona destino.
// Mismo patrón que suggestPutawayLocation: se puntúa cada candidato y se
// devuelve el ranking; la decisión final sigue siendo del operario.

export interface DockScore {
  dock: Dock
  score: number // 0–100
  reasons: string[]
}

// Distancia media al despacho de las ubicaciones de una zona — proxy de cuán
// cerca queda ese muelle del destino final de la mercancía.
const avgDistanceOfZone = (locations: StorageLocation[], zone: string): number | undefined => {
  const inZone = locations.filter((l) => l.zone === zone)
  if (inZone.length === 0) return undefined
  return inZone.reduce((sum, l) => sum + l.distanceToDispatchM, 0) / inZone.length
}

export const scoreDock = (
  dock: Dock,
  appointment: Pick<DockAppointment, 'type' | 'scheduledStart' | 'scheduledEnd' | 'id'>,
  appointments: DockAppointment[],
  asn: Pick<Asn, 'crossDocking'> | undefined,
  locations: StorageLocation[]
): DockScore => {
  const reasons: string[] = []
  let score = 0

  if (!isDockCompatible(dock, appointment.type)) {
    return { dock, score: 0, reasons: ['tipo de muelle incompatible'] }
  }
  if (dock.status !== 'active') {
    return { dock, score: 0, reasons: [`muelle ${dock.status === 'blocked' ? 'bloqueado' : 'en mantenimiento'}`] }
  }

  // Base: compatible y operativo.
  score += 40
  reasons.push('compatible y operativo')

  // Sin solapamiento con otra cita activa.
  const conflict = hasDockConflict(
    appointments,
    dock.id,
    appointment.scheduledStart,
    appointment.scheduledEnd,
    appointment.id
  )
  if (conflict) {
    score -= 35
    reasons.push('ya tiene una cita solapada')
  } else {
    score += 25
    reasons.push('sin conflicto de agenda')
  }

  // Cross-dock: premia el muelle cercano al staging de salida, para no cruzar
  // la mercancía por todo el almacén cuando va directo a despacho.
  if (asn?.crossDocking) {
    const stagingDistance = avgDistanceOfZone(locations, 'staging')
    const dockZoneDistance = avgDistanceOfZone(locations, dock.code)
    if (stagingDistance !== undefined && dockZoneDistance !== undefined) {
      if (dockZoneDistance <= stagingDistance) {
        score += 20
        reasons.push('cercano al área de despacho (cross-dock)')
      }
    } else {
      score += 10
      reasons.push('marcado para cross-dock')
    }
  }

  // Un muelle dedicado (no mixto) rinde mejor que uno compartido.
  if (dock.type === appointment.type) {
    score += 15
    reasons.push('muelle dedicado a este tipo de tráfico')
  }

  return { dock, score: Math.max(0, Math.min(100, score)), reasons }
}

/**
 * Ranking de muelles para una cita, mejor primero. Los incompatibles quedan
 * con score 0 y al final — se devuelven igual para poder explicar el descarte.
 */
export const suggestDock = (
  appointment: Pick<DockAppointment, 'type' | 'scheduledStart' | 'scheduledEnd' | 'id' | 'warehouseId'>,
  docks: Dock[],
  appointments: DockAppointment[],
  asn: Pick<Asn, 'crossDocking'> | undefined,
  locations: StorageLocation[]
): DockScore[] =>
  docks
    .filter((d) => d.warehouseId === appointment.warehouseId)
    .map((d) => scoreDock(d, appointment, appointments, asn, locations))
    .sort((a, b) => b.score - a.score)

// ─── Geometría del tablero de línea de tiempo (/yard) ─────────────────────────

// Minutos desde medianoche. Acepta 'HH:mm' o un ISO datetime (troza la hora).
export const minutesOfDay = (value: string): number => {
  const hhmm = value.length > 5 ? value.slice(11, 16) : value
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Posición (left) y ancho de un bloque en el eje [openMin, closeMin], en %.
// Recorta a los bordes: una cita que empieza antes de abrir o termina después
// de cerrar nunca desborda la pista. widthPct nunca es negativo.
export const blockGeometry = (
  startMin: number,
  endMin: number,
  openMin: number,
  closeMin: number
): { leftPct: number; widthPct: number } => {
  const span = Math.max(1, closeMin - openMin)
  const clampedStart = Math.max(openMin, Math.min(startMin, closeMin))
  const clampedEnd = Math.max(openMin, Math.min(endMin, closeMin))
  const leftPct = ((clampedStart - openMin) / span) * 100
  const widthPct = Math.max(0, ((clampedEnd - clampedStart) / span) * 100)
  return { leftPct, widthPct }
}

// ─── Acciones disponibles por estado de la cita ───────────────────────────────
// Única fuente de verdad para qué botones mostrar; la consumen la tabla de
// /yard (ActionsCell) y el popover del tablero. Coincide con la FSM.

export interface AppointmentActionFlags {
  canAssignDock: boolean
  canCheckIn: boolean
  canStart: boolean
  canComplete: boolean
  canNoShow: boolean
  canCancel: boolean
}

export const appointmentActionFlags = (status: DockAppointmentStatus): AppointmentActionFlags => ({
  canAssignDock: status === 'scheduled' || status === 'arrived',
  canCheckIn: status === 'scheduled',
  canStart: status === 'arrived',
  canComplete: status === 'in_progress',
  canNoShow: status === 'scheduled',
  canCancel: status === 'scheduled' || status === 'arrived',
})
