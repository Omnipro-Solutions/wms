'use client'

import type { MouseEvent, ReactNode } from 'react'
import { Check, LogIn, Play, Truck, UserX, Warehouse as WarehouseIcon, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import {
  APPOINTMENT_TYPE_LABELS,
  DOCK_TYPE_LABELS,
  appointmentActionFlags,
  blockGeometry,
  isAppointmentAtRisk,
  minutesOfDay,
} from '@/lib/rules/yard'
import type { Dock, DockAppointment, DockAppointmentStatus } from '@/types/wms'

export interface DockLane {
  dock: Dock
  appointments: DockAppointment[]
}

export interface DockTimelineActions {
  onCheckIn: (id: string) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onNoShow: (id: string) => void
  onCancel: (id: string) => void
  onAssignDock: (appointment: DockAppointment) => void
  onCreateAt: (dockId: string, startMinutes: number) => void
}

export interface DockTimelineProps {
  lanes: DockLane[]
  unassigned: DockAppointment[]
  openMinutes: number
  closeMinutes: number
  nowMs: number | null
  lateThresholdMinutes: number
  resolveReference: (a: DockAppointment) => string
  actions?: DockTimelineActions
}

const HOUR_PX = 64 // ancho de una hora en la pista
const ROW_PX = 40 // alto de una sub-fila de citas
const LABEL_PX = 140 // ancho de la columna fija de muelles

const timeOf = (iso: string) => iso.slice(11, 16)

const BLOCK_CLASSES: Record<DockAppointmentStatus, string> = {
  scheduled: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  arrived: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  in_progress:
    'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
  completed:
    'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  no_show: 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  cancelled:
    'border-gray-300 bg-gray-100 text-gray-600 line-through dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400',
}

// Reparte las citas del carril en sub-filas: cada cita ocupa la primera fila
// cuya última cita ya terminó, de modo que las solapadas no se pisen.
const packRows = (appointments: DockAppointment[]): Map<string, number> => {
  const sorted = [...appointments].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
  const rowEnds: string[] = []
  const byId = new Map<string, number>()
  for (const appt of sorted) {
    let row = rowEnds.findIndex((end) => end <= appt.scheduledStart)
    if (row === -1) {
      row = rowEnds.length
      rowEnds.push(appt.scheduledEnd)
    } else {
      rowEnds[row] = appt.scheduledEnd
    }
    byId.set(appt.id, row)
  }
  return byId
}

const AppointmentBlock = ({
  appointment,
  leftPct,
  widthPct,
  top,
  atRisk,
  resolveReference,
  actions,
}: {
  appointment: DockAppointment
  leftPct: number
  widthPct: number
  top: number
  atRisk: boolean
  resolveReference: (a: DockAppointment) => string
  actions?: DockTimelineActions
}) => {
  const flags = appointmentActionFlags(appointment.status)
  const showActions = !!actions && Object.values(flags).some(Boolean)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'absolute flex min-w-[2.75rem] flex-col justify-center overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition hover:brightness-95',
            BLOCK_CLASSES[appointment.status],
            atRisk && 'border-dashed ring-2 ring-red-400 dark:ring-red-500'
          )}
          style={{ left: `${leftPct}%`, width: `${widthPct}%`, top, height: ROW_PX - 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate font-medium">
            {atRisk ? '⚠ ' : ''}
            {appointment.code}
          </span>
          {appointment.carrierName && <span className="truncate opacity-80">{appointment.carrierName}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{appointment.code}</p>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="text-muted-foreground space-y-1 text-xs">
          <p className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {APPOINTMENT_TYPE_LABELS[appointment.type]}
            </Badge>
            {resolveReference(appointment)}
          </p>
          <p className="tabular-nums">
            {timeOf(appointment.scheduledStart)}–{timeOf(appointment.scheduledEnd)}
          </p>
          {appointment.carrierName && (
            <p className="flex items-center gap-1.5">
              <Truck className="size-3.5" />
              {appointment.carrierName}
              {appointment.driverName ? ` · ${appointment.driverName}` : ''}
              {appointment.vehiclePlate ? ` · ${appointment.vehiclePlate}` : ''}
            </p>
          )}
        </div>
        {showActions && (
          <div className="flex flex-wrap justify-end gap-1.5 pt-1">
            {flags.canAssignDock && (
              <Button size="sm" variant="outline" onClick={() => actions!.onAssignDock(appointment)}>
                <WarehouseIcon className="mr-1 size-3.5" />
                {appointment.dockId ? 'Reasignar' : 'Asignar muelle'}
              </Button>
            )}
            {flags.canCheckIn && (
              <Button size="sm" variant="outline" onClick={() => actions!.onCheckIn(appointment.id)}>
                <LogIn className="mr-1 size-3.5" />
                Llegó
              </Button>
            )}
            {flags.canStart && (
              <Button
                size="sm"
                onClick={() => actions!.onStart(appointment.id)}
                disabled={!appointment.dockId}
                title={!appointment.dockId ? 'Asigna un muelle antes de iniciar' : undefined}
              >
                <Play className="mr-1 size-3.5" />
                Iniciar
              </Button>
            )}
            {flags.canComplete && (
              <Button size="sm" onClick={() => actions!.onComplete(appointment.id)}>
                <Check className="mr-1 size-3.5" />
                Completar
              </Button>
            )}
            {flags.canNoShow && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => actions!.onNoShow(appointment.id)}
              >
                <UserX className="mr-1 size-3.5" />
                No-show
              </Button>
            )}
            {flags.canCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => actions!.onCancel(appointment.id)}
              >
                <X className="mr-1 size-3.5" />
                Cancelar
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const TimelineRow = ({
  label,
  appointments,
  openMinutes,
  closeMinutes,
  trackWidth,
  nowLeftPct,
  atRiskIds,
  inactive,
  inactiveNote,
  emptyHint,
  resolveReference,
  actions,
  onTrackClick,
}: {
  label: ReactNode
  appointments: DockAppointment[]
  openMinutes: number
  closeMinutes: number
  trackWidth: number
  nowLeftPct: number | null
  atRiskIds: Set<string>
  inactive?: boolean
  inactiveNote?: string
  emptyHint?: string
  resolveReference: (a: DockAppointment) => string
  actions?: DockTimelineActions
  onTrackClick?: (startMinutes: number) => void
}) => {
  const rowById = packRows(appointments)
  const rowCount = Math.max(1, ...Array.from(rowById.values()).map((r) => r + 1))
  const laneHeight = rowCount * ROW_PX + 8

  const handleTrackClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onTrackClick || inactive) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const minutes = openMinutes + pct * (closeMinutes - openMinutes)
    onTrackClick(Math.round(minutes / 30) * 30)
  }

  return (
    <div className="flex border-t">
      <div
        className="bg-background sticky left-0 z-10 flex flex-col justify-center gap-1 border-r px-3 py-2"
        style={{ width: LABEL_PX, minWidth: LABEL_PX }}
      >
        {label}
      </div>
      <div
        className={cn('relative', inactive ? 'bg-muted/40' : onTrackClick && 'cursor-pointer')}
        style={{ width: trackWidth, height: laneHeight }}
        onClick={handleTrackClick}
      >
        {inactive ? (
          <p className="text-muted-foreground absolute inset-0 flex items-center justify-center px-3 text-center text-xs">
            {inactiveNote ?? 'Fuera de servicio'}
          </p>
        ) : (
          <>
            {appointments.map((a) => {
              const { leftPct, widthPct } = blockGeometry(
                minutesOfDay(a.scheduledStart),
                minutesOfDay(a.scheduledEnd),
                openMinutes,
                closeMinutes
              )
              return (
                <AppointmentBlock
                  key={a.id}
                  appointment={a}
                  leftPct={leftPct}
                  widthPct={widthPct}
                  top={(rowById.get(a.id) ?? 0) * ROW_PX + 4}
                  atRisk={atRiskIds.has(a.id)}
                  resolveReference={resolveReference}
                  actions={actions}
                />
              )
            })}
            {appointments.length === 0 && emptyHint && (
              <p className="text-muted-foreground/60 absolute inset-0 flex items-center justify-center text-xs">
                {emptyHint}
              </p>
            )}
          </>
        )}
        {nowLeftPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-500"
            style={{ left: `${nowLeftPct}%` }}
          />
        )}
      </div>
    </div>
  )
}

export const TimelineLegend = () => (
  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-blue-300 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50" />
      Agendada
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-amber-300 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50" />
      Llegó
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-violet-300 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50" />
      En curso
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-dashed border-red-400 ring-1 ring-red-400" />
      En riesgo
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-px bg-red-500" />
      Ahora
    </span>
  </div>
)

export const DockTimeline = ({
  lanes,
  unassigned,
  openMinutes,
  closeMinutes,
  nowMs,
  lateThresholdMinutes,
  resolveReference,
  actions,
}: DockTimelineProps) => {
  if (lanes.length === 0 && unassigned.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No hay muelles configurados en esta bodega.
      </p>
    )
  }

  const totalMinutes = Math.max(1, closeMinutes - openMinutes)
  const trackWidth = (totalMinutes / 60) * HOUR_PX

  const activeNow = nowMs !== null && nowMs > 0 ? nowMs : null

  const nowMinutes =
    activeNow === null ? null : new Date(activeNow).getHours() * 60 + new Date(activeNow).getMinutes()
  const nowLeftPct =
    nowMinutes === null || nowMinutes < openMinutes || nowMinutes > closeMinutes
      ? null
      : ((nowMinutes - openMinutes) / totalMinutes) * 100

  const atRiskIds = new Set(
    activeNow === null
      ? []
      : [...lanes.flatMap((l) => l.appointments), ...unassigned]
          .filter((a) => isAppointmentAtRisk(a, activeNow, lateThresholdMinutes))
          .map((a) => a.id)
  )

  const startHour = Math.floor(openMinutes / 60)
  const endHour = Math.ceil(closeMinutes / 60)
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div style={{ minWidth: LABEL_PX + trackWidth }}>
        {/* Eje de horas */}
        <div className="flex">
          <div
            className="bg-background sticky left-0 z-10 border-r"
            style={{ width: LABEL_PX, minWidth: LABEL_PX }}
          />
          <div className="text-muted-foreground relative h-6" style={{ width: trackWidth }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute -translate-x-1/2 text-[11px] tabular-nums"
                style={{ left: `${((h * 60 - openMinutes) / totalMinutes) * 100}%`, top: 4 }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>

        {/* Un carril por muelle */}
        {lanes.map(({ dock, appointments }) => {
          const inactive = dock.status !== 'active'
          return (
            <TimelineRow
              key={dock.id}
              label={
                <>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{dock.code}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {DOCK_TYPE_LABELS[dock.type]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">{dock.name}</p>
                  {inactive && <StatusBadge status={dock.status} />}
                </>
              }
              appointments={appointments}
              openMinutes={openMinutes}
              closeMinutes={closeMinutes}
              trackWidth={trackWidth}
              nowLeftPct={nowLeftPct}
              atRiskIds={atRiskIds}
              inactive={inactive}
              inactiveNote={dock.notes}
              emptyHint={actions ? 'Libre — clic para agendar' : 'Libre'}
              resolveReference={resolveReference}
              actions={actions}
              onTrackClick={actions ? (min) => actions.onCreateAt(dock.id, min) : undefined}
            />
          )
        })}

        {/* Citas sin muelle asignado */}
        {unassigned.length > 0 && (
          <TimelineRow
            label={<p className="text-muted-foreground text-sm font-medium">Sin muelle</p>}
            appointments={unassigned}
            openMinutes={openMinutes}
            closeMinutes={closeMinutes}
            trackWidth={trackWidth}
            nowLeftPct={nowLeftPct}
            atRiskIds={atRiskIds}
            resolveReference={resolveReference}
            actions={actions}
          />
        )}
      </div>
    </div>
  )
}
