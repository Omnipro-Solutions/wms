// Yard/Dock management (#8) — pure rules. No store/React imports.
import type { Dock, DockAppointment, DockAppointmentType, DockType, WmsSettings } from '@/types/wms'

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
