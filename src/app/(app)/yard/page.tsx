'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CircleParking,
  Clock,
  DoorOpen,
  Snowflake,
  TriangleAlert,
  Truck,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectDockBoard, selectYardKpis, type DockBoardRow } from '@/store/selectors'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { DOCK_TYPE_LABELS, WEEKDAY_LABELS } from '@/lib/rules/yard'
import type { Asn, DockAppointment, LoadManifest } from '@/types/wms'
import { buildAppointmentColumns, type AppointmentRow } from './columns'
import { CreateAppointmentDialog, type CreateAppointmentInitial } from './_components/create-appointment-dialog'
import { AssignDockDialog } from './_components/assign-dock-dialog'

// Reading the clock is a side effect — never called inline during render, and
// setState only fires from the timer callback so a stale "at risk" flag clears
// live without requiring a store mutation.
const useNow = (): number => {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const initial = setTimeout(tick, 0)
    const id = setInterval(tick, 60_000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [])
  return now ?? 0
}

// Local calendar date (not toISOString(), which is UTC and can land on the
// wrong day for timezones ahead of/behind UTC near midnight).
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const referenceLabel = (appointment: DockAppointment, asnRecords: Asn[], loadManifests: LoadManifest[]) => {
  if (appointment.asnId) return asnRecords.find((a) => a.id === appointment.asnId)?.code ?? appointment.asnId
  if (appointment.manifestId)
    return loadManifests.find((m) => m.id === appointment.manifestId)?.code ?? appointment.manifestId
  return '—'
}

const DockStatusBadge = ({ status }: { status: string }) =>
  status === 'active' ? null : <StatusBadge status={status} />

const DockCard = ({ row, onOpenCreate }: { row: DockBoardRow; onOpenCreate: () => void }) => {
  const { dock, currentAppointment, nextAppointment } = row
  const occupied = !!currentAppointment
  return (
    <Card
      className={cn(
        dock.status !== 'active' && 'opacity-70',
        occupied && 'border-blue-300 dark:border-blue-900/60'
      )}
    >
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{dock.name}</p>
            <p className="text-muted-foreground font-mono text-xs">{dock.code}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-xs">
              {DOCK_TYPE_LABELS[dock.type]}
            </Badge>
            <DockStatusBadge status={dock.status} />
          </div>
        </div>

        {dock.status !== 'active' ? (
          <p className="text-muted-foreground text-xs">{dock.notes ?? 'Fuera de servicio.'}</p>
        ) : occupied ? (
          <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs dark:bg-blue-950/30">
            <p className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-300">
              <Truck className="size-3.5" />
              {currentAppointment!.code}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {currentAppointment!.carrierName ?? 'Transportista sin especificar'}
              {currentAppointment!.driverName ? ` · ${currentAppointment!.driverName}` : ''}
            </p>
          </div>
        ) : nextAppointment ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" />
            Próxima: {nextAppointment.scheduledStart.slice(11, 16)} · {nextAppointment.code}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Libre — sin citas agendadas.</p>
        )}

        {dock.status === 'active' && !occupied && (
          <Button size="sm" variant="outline" className="mt-1 self-start" onClick={onOpenCreate}>
            <CalendarPlus className="mr-1.5 size-3.5" />
            Agendar cita
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

const YardPage = () => {
  const state = useWmsStore()
  const { warehouses, docks, dockAppointments, asnRecords, loadManifests, settings } = state
  const now = useNow()

  const [actionError, setActionError] = useState('')
  const [calendarDate, setCalendarDate] = useState(todayStr())
  const [calendarWarehouseId, setCalendarWarehouseId] = useState<string>('all')

  const createDialog = useDialogState<CreateAppointmentInitial>()
  const assignDialog = useDialogState<AppointmentRow>()

  const board = useMemo(() => selectDockBoard(state), [state])
  const boardByWarehouse = useMemo(() => {
    const groups = new Map<string, DockBoardRow[]>()
    for (const row of board) {
      const list = groups.get(row.dock.warehouseId) ?? []
      list.push(row)
      groups.set(row.dock.warehouseId, list)
    }
    return Array.from(groups.entries()).map(([warehouseId, rows]) => ({
      warehouseId,
      warehouseName: warehouses.find((w) => w.id === warehouseId)?.name ?? warehouseId,
      rows,
    }))
  }, [board, warehouses])
  const kpis = useMemo(() => selectYardKpis(state, now), [state, now])

  const toRow = (a: DockAppointment): AppointmentRow => {
    const dock = a.dockId ? docks.find((d) => d.id === a.dockId) : undefined
    return {
      id: a.id,
      code: a.code,
      warehouseId: a.warehouseId,
      warehouseName: warehouses.find((w) => w.id === a.warehouseId)?.name ?? a.warehouseId,
      type: a.type,
      status: a.status,
      dockId: a.dockId,
      dockLabel: dock ? `${dock.code} — ${dock.name}` : 'Sin asignar',
      referenceLabel: referenceLabel(a, asnRecords, loadManifests),
      carrierName: a.carrierName,
      driverName: a.driverName,
      vehiclePlate: a.vehiclePlate,
      scheduledStart: a.scheduledStart,
      scheduledEnd: a.scheduledEnd,
    }
  }

  const activeRows = useMemo(
    () =>
      dockAppointments
        .filter((a) => a.status === 'scheduled' || a.status === 'arrived' || a.status === 'in_progress')
        .slice()
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
        .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dockAppointments, docks, warehouses, asnRecords, loadManifests]
  )

  const historyRows = useMemo(
    () =>
      dockAppointments
        .filter((a) => a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled')
        .slice()
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))
        .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dockAppointments, docks, warehouses, asnRecords, loadManifests]
  )

  const run = (fn: () => void) => {
    try {
      setActionError('')
      fn()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Error al ejecutar la acción')
    }
  }

  const handlers = {
    onAssignDock: (row: AppointmentRow) => assignDialog.open(row),
    onCheckIn: (id: string) => run(() => state.checkInAppointment(id)),
    onStart: (id: string) => run(() => state.startAppointment(id)),
    onComplete: (id: string) => run(() => state.completeAppointment(id)),
    onNoShow: (id: string) => run(() => state.markAppointmentNoShow(id)),
    onCancel: (id: string) => run(() => state.cancelAppointment(id)),
  }

  const activeColumns = useMemo(() => buildAppointmentColumns(handlers), [])
  const historyColumns = useMemo(() => buildAppointmentColumns(), [])

  const calendarDayOfWeek = new Date(`${calendarDate}T00:00:00.000Z`).getUTCDay()
  const isNonWorkingDay = !settings.yardWorkingDays.includes(calendarDayOfWeek)

  const calendarAppointments = useMemo(
    () =>
      dockAppointments
        .filter((a) => a.scheduledStart.slice(0, 10) === calendarDate)
        .filter((a) => calendarWarehouseId === 'all' || a.warehouseId === calendarWarehouseId)
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    [dockAppointments, calendarDate, calendarWarehouseId]
  )
  const calendarDocks = docks.filter(
    (d) => calendarWarehouseId === 'all' || d.warehouseId === calendarWarehouseId
  )
  const unassignedCalendarAppointments = calendarAppointments.filter((a) => !a.dockId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patio y muelles"
        description="Coordinación de citas de llegada y salida, asignación de muelles y control del patio de carga/descarga."
        actions={
          <Button size="sm" onClick={() => createDialog.open({})}>
            <CalendarPlus className="mr-1.5 size-4" />
            Nueva cita
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CalendarClock}
          value={formatNumber(kpis.appointmentsToday)}
          label="Citas hoy"
          tone={kpis.appointmentsToday > 0 ? 'blue' : 'neutral'}
        />
        <KpiCard
          icon={CircleParking}
          value={`${kpis.docksAvailable}/${kpis.docksAvailable + kpis.docksOccupied}`}
          label="Muelles disponibles"
          sublabel={`${kpis.docksOutOfService} fuera de servicio`}
          tone={kpis.docksAvailable > 0 ? 'green' : 'amber'}
        />
        <KpiCard
          icon={TriangleAlert}
          value={formatNumber(kpis.atRiskCount)}
          label="Citas en riesgo"
          sublabel={`umbral ${settings.yardLateThresholdMinutes} min`}
          tone={kpis.atRiskCount > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          icon={DoorOpen}
          value={formatNumber(kpis.noShowToday)}
          label="No-show hoy"
          tone={kpis.noShowToday > 0 ? 'red' : 'neutral'}
        />
      </div>

      {settings.yardFreezeActive && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <Snowflake className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm">
            <p className="font-semibold text-red-800 dark:text-red-300">Patio y muelles congelado</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Crear, asignar y avanzar citas está bloqueado. Desactívalo en Configuración → Patio y muelles.
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {actionError}
        </div>
      )}

      <Tabs defaultValue="board" className="gap-4">
        <TabsList>
          <TabsTrigger value="board">Hoy</TabsTrigger>
          <TabsTrigger value="appointments">Citas ({activeRows.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="history">Historial ({historyRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="flex flex-col gap-5">
          {boardByWarehouse.map((group) => (
            <div key={group.warehouseId} className="flex flex-col gap-3">
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {group.warehouseName}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.rows.map((row) => (
                  <DockCard
                    key={row.dock.id}
                    row={row}
                    onOpenCreate={() => createDialog.open({ warehouseId: row.dock.warehouseId })}
                  />
                ))}
              </div>
            </div>
          ))}
          {board.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No hay muelles configurados. Créalos en Configuración → Patio y muelles.
            </p>
          )}
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="pt-4">
              <DataTable
                columns={activeColumns}
                data={activeRows}
                searchColumn="code"
                searchPlaceholder="Buscar cita..."
                emptyMessage="No hay citas activas."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">Fecha</p>
                  <Input
                    type="date"
                    value={calendarDate}
                    onChange={(e) => setCalendarDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">Bodega</p>
                  <Select value={calendarWarehouseId} onValueChange={setCalendarWarehouseId}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las bodegas</SelectItem>
                      {warehouses
                        .filter((w) => w.type !== 'transit')
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="mb-0.5 gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {WEEKDAY_LABELS[calendarDayOfWeek]}
                </Badge>
                {isNonWorkingDay && (
                  <Badge variant="outline" className="mb-0.5 border-amber-300 bg-amber-50 text-amber-700">
                    El patio no opera este día
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {calendarDocks.map((dock) => {
                  const dockAppointmentsForDay = calendarAppointments.filter((a) => a.dockId === dock.id)
                  return (
                    <div key={dock.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {dock.code} — {dock.name}
                          </p>
                          {calendarWarehouseId === 'all' && (
                            <p className="text-muted-foreground text-xs">
                              {warehouses.find((w) => w.id === dock.warehouseId)?.name ?? dock.warehouseId}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {DOCK_TYPE_LABELS[dock.type]}
                        </Badge>
                      </div>
                      {dockAppointmentsForDay.length === 0 ? (
                        <p className="text-muted-foreground text-xs">Sin citas ese día.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {dockAppointmentsForDay.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="tabular-nums">
                                {a.scheduledStart.slice(11, 16)}–{a.scheduledEnd.slice(11, 16)}
                              </span>
                              <span className="text-muted-foreground truncate">{a.code}</span>
                              <StatusBadge status={a.status} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>

              {unassignedCalendarAppointments.length > 0 && (
                <div className="rounded-md border border-dashed p-3">
                  <p className="mb-2 text-sm font-medium">Sin muelle asignado</p>
                  <ul className="space-y-1.5">
                    {unassignedCalendarAppointments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="tabular-nums">
                          {a.scheduledStart.slice(11, 16)}–{a.scheduledEnd.slice(11, 16)}
                        </span>
                        <span className="text-muted-foreground truncate">{a.code}</span>
                        <StatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {calendarAppointments.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No hay citas agendadas para esta fecha.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <DataTable
                columns={historyColumns}
                data={historyRows}
                searchColumn="code"
                searchPlaceholder="Buscar cita..."
                emptyMessage="Aún no hay citas completadas, canceladas o no-show."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateAppointmentDialog open={createDialog.data !== null} onClose={createDialog.close} initial={createDialog.data ?? undefined} />
      <AssignDockDialog appointment={assignDialog.data} open={assignDialog.data !== null} onClose={assignDialog.close} />
    </div>
  )
}

export default YardPage
