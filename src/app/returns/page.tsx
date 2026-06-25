'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Hash,
  PackageCheck,
  Settings2,
  Trash2,
  TriangleAlert,
  Undo2,
  Wrench,
  MapPin,
  User,
  Tag,
  ChevronRight,
  Search,
} from 'lucide-react'

import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatNumber } from '@/lib/formatters'
import { InspectReturnDialog } from './_components/inspect-return-dialog'
import { SetDispositionDialog } from './_components/set-disposition-dialog'
import { ReentryDialog } from './_components/reentry-dialog'
import { ScrapDialog } from './_components/scrap-dialog'
import { RepairDialog } from './_components/repair-dialog'
import { RepairReturnDialog } from './_components/repair-return-dialog'
import { buildReturnColumns, DISPOSITION_LABELS, DISPOSITION_COLORS, TYPE_LABELS, type ReturnRow } from './columns'
import type {
  ReentryLine,
  RepairTicket,
  RepairTicketLine,
  RepairType,
  ReturnItemInspection,
  ReturnOrder,
  ScrapLine,
  ScrapMethod,
} from '@/types/wms'

interface AdvanceReturnDialogData {
  returnId: string
  rmaCode: string
  customerName: string
  currentStatus: string
  nextStatus: string
  disposition: string
}

interface ReturnActionDialogData {
  returnId: string
  rmaCode: string
  customerName: string
  items: ReturnOrder['items']
}

interface DispositionDialogData {
  returnId: string
  rmaCode: string
  customerName: string
  currentDisposition: ReturnOrder['disposition']
}

interface RepairReturnDialogData {
  ticket: RepairTicket
}

const NEXT_STATUS_MAP: Partial<Record<string, string>> = {
  requested: 'received_at_store',
  received_at_store: 'in_transit_to_dc',
  in_transit_to_dc: 'received_at_dc',
  received_at_dc: 'under_validation',
  under_validation: 'next_by_disposition',
  sent_to_quality_control: 'next_by_disposition',
  sent_to_repair: 'reentered',
  reentered: 'closed',
  sent_to_scrap: 'closed',
  rejected: 'closed',
}

const TERMINAL_STATUSES = new Set(['closed', 'rejected'])

export const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  received_at_store: 'Recibida en tienda',
  in_transit_to_dc: 'En tránsito al DC',
  received_at_dc: 'Recibida en DC',
  under_validation: 'En validación',
  sent_to_quality_control: 'En control calidad',
  reentered: 'Reingresada',
  sent_to_repair: 'En reparación',
  sent_to_scrap: 'En desecho',
  rejected: 'Rechazada',
  closed: 'Cerrada',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  defective: 'Defectuoso',
}

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-green-100 text-green-800',
  like_new: 'bg-emerald-100 text-emerald-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
  defective: 'bg-red-100 text-red-800',
}

const RESULT_LABELS: Record<string, string> = {
  pass: 'Aprobada',
  partial_pass: 'Aprobación parcial',
  fail: 'Rechazada',
}

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-800 border-green-200',
  partial_pass: 'bg-amber-100 text-amber-800 border-amber-200',
  fail: 'bg-red-100 text-red-800 border-red-200',
}

const resolveNextStatus = (ret: ReturnOrder): string | null => {
  const raw = NEXT_STATUS_MAP[ret.status]
  if (!raw) return null
  if (raw !== 'next_by_disposition') return raw
  if (ret.disposition === 'restock') return 'reentered'
  if (ret.disposition === 'scrap') return 'sent_to_scrap'
  if (ret.disposition === 'repair') return 'sent_to_repair'
  return 'sent_to_quality_control'
}

const daysInStatus = (ret: ReturnOrder): string =>
  formatDistanceToNow(parseISO(ret.createdAt), { locale: es, addSuffix: false })

/* ─── Action banner por estado ────────────────────────────────────────── */

const STATUS_BANNERS: Partial<Record<string, { color: string; message: string }>> = {
  under_validation: {
    color: 'border-amber-200 bg-amber-50 text-amber-800',
    message: 'Pendiente de inspección y asignación de disposición antes de avanzar.',
  },
  reentered: {
    color: 'border-green-200 bg-green-50 text-green-800',
    message: 'Lista para ejecutar el reingreso al inventario.',
  },
  sent_to_repair: {
    color: 'border-orange-200 bg-orange-50 text-orange-800',
    message: 'Crear un ticket con el taller y recibir el retorno cuando esté listo.',
  },
  sent_to_scrap: {
    color: 'border-red-200 bg-red-50 text-red-800',
    message: 'Confirmar la baja definitiva para cerrar esta devolución.',
  },
}

export default function ReturnsPage() {
  const state = useWmsStore()
  const {
    advanceReturn,
    inspectReturn,
    setReturnDisposition,
    executeReentry,
    executeScrap,
    createRepairTicket,
    receiveRepairReturn,
  } = state
  const { warehouseName, productName, getProduct } = useStoreHelpers()

  const [dispositionFilter, setDispositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const advanceDialog = useDialogState<AdvanceReturnDialogData>()
  const inspectDialog = useDialogState<ReturnActionDialogData>()
  const dispositionDialog = useDialogState<DispositionDialogData>()
  const reentryDialog = useDialogState<ReturnActionDialogData>()
  const scrapDialog = useDialogState<ReturnActionDialogData>()
  const repairDialog = useDialogState<ReturnActionDialogData>()
  const repairReturnDialog = useDialogState<RepairReturnDialogData>()

  const rows = useMemo<ReturnRow[]>(
    () =>
      state.returnOrders.map((ret) => {
        const reason = state.reasons.find((r) => r.id === ret.reasonId)
        const next = resolveNextStatus(ret)
        return {
          id: ret.id,
          rmaCode: ret.rmaCode,
          customerName: ret.customerName,
          type: ret.type,
          originName: warehouseName(ret.originId),
          destinationName: warehouseName(ret.destinationId),
          disposition: ret.disposition,
          reasonLabel: reason?.label ?? '',
          status: ret.status,
          canAdvance: !TERMINAL_STATUSES.has(ret.status) && !!next,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.returnOrders]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (dispositionFilter !== 'all' && r.disposition !== dispositionFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (search.trim()) {
          const q = search.toLowerCase()
          if (!r.rmaCode.toLowerCase().includes(q) && !r.customerName.toLowerCase().includes(q))
            return false
        }
        return true
      }),
    [rows, dispositionFilter, statusFilter, search]
  )

  const activeReturns = useMemo(
    () => state.returnOrders.filter((r) => !TERMINAL_STATUSES.has(r.status)),
    [state.returnOrders]
  )

  const { inTransitCount, validationCount, reenteredCount, scrapCount, repairCount, closedCount } = useMemo(() => {
    let inTransit = 0, validation = 0, reentered = 0, scrap = 0, repair = 0, closed = 0
    for (const r of state.returnOrders) {
      if (r.status === 'in_transit_to_dc') inTransit++
      else if (r.status === 'under_validation' || r.status === 'sent_to_quality_control') validation++
      else if (r.status === 'reentered') reentered++
      else if (r.status === 'sent_to_scrap') scrap++
      else if (r.status === 'sent_to_repair') repair++
      else if (r.status === 'closed') closed++
    }
    return { inTransitCount: inTransit, validationCount: validation, reenteredCount: reentered, scrapCount: scrap, repairCount: repair, closedCount: closed }
  }, [state.returnOrders])
  const openRepairTickets = useMemo(
    () => state.repairTickets.filter((t) => t.status !== 'completed' && t.status !== 'failed').length,
    [state.repairTickets]
  )
  const inspectedCount = state.returnInspections.length

  const handleOpenAdvance = (row: ReturnRow) => {
    const ret = state.returnOrders.find((r) => r.id === row.id)
    if (!ret) return
    const next = resolveNextStatus(ret)
    if (!next) return
    advanceDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      currentStatus: ret.status,
      nextStatus: next,
      disposition: ret.disposition,
    })
  }

  const handleOpenInspect = (ret: ReturnOrder) => {
    inspectDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })
  }

  const handleOpenDisposition = (ret: ReturnOrder) => {
    dispositionDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      currentDisposition: ret.disposition,
    })
  }

  const handleOpenReentry = (ret: ReturnOrder) => {
    reentryDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })
  }

  const handleOpenRepair = (ret: ReturnOrder) => {
    repairDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })
  }

  const handleCreateRepair = (
    vendorName: string,
    repairType: RepairType,
    lines: RepairTicketLine[],
    expectedReturnDate: string,
    operatorName: string
  ) => {
    if (!repairDialog.data) return
    try {
      createRepairTicket(
        repairDialog.data.returnId,
        vendorName,
        repairType,
        lines,
        expectedReturnDate,
        operatorName
      )
      repairDialog.close()
    } catch (e: unknown) {
      repairDialog.setError(e instanceof Error ? e.message : 'Error al crear ticket de reparación')
    }
  }

  const handleOpenRepairReturn = (ticket: RepairTicket) => {
    repairReturnDialog.open({ ticket })
  }

  const handleReceiveRepair = (
    outcome: RepairTicket['outcome'],
    finalCostUsd: number,
    outcomeNotes: string,
    targetLocationId?: string
  ) => {
    if (!repairReturnDialog.data) return
    try {
      receiveRepairReturn(
        repairReturnDialog.data.ticket.id,
        outcome,
        finalCostUsd,
        outcomeNotes,
        targetLocationId
      )
      repairReturnDialog.close()
    } catch (e: unknown) {
      repairReturnDialog.setError(e instanceof Error ? e.message : 'Error al recibir reparación')
    }
  }

  const handleOpenScrap = (ret: ReturnOrder) => {
    scrapDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })
  }

  const handleScrap = (
    lines: ScrapLine[],
    disposalMethod: ScrapMethod,
    operatorName: string,
    referenceDoc: string,
    notes: string
  ) => {
    if (!scrapDialog.data) return
    try {
      executeScrap(scrapDialog.data.returnId, lines, disposalMethod, operatorName, referenceDoc, notes)
      scrapDialog.close()
    } catch (e: unknown) {
      scrapDialog.setError(e instanceof Error ? e.message : 'Error al ejecutar baja')
    }
  }

  const handleReentry = (lines: ReentryLine[], operatorName: string) => {
    if (!reentryDialog.data) return
    try {
      executeReentry(reentryDialog.data.returnId, lines, operatorName)
      reentryDialog.close()
    } catch (e: unknown) {
      reentryDialog.setError(e instanceof Error ? e.message : 'Error al ejecutar reingreso')
    }
  }

  const handleAdvance = () => {
    if (!advanceDialog.data) return
    try {
      advanceReturn(advanceDialog.data.returnId, 'Operador')
      advanceDialog.close()
    } catch (e: unknown) {
      advanceDialog.setError(e instanceof Error ? e.message : 'Error al avanzar devolución')
    }
  }

  const handleInspect = (
    inspectorName: string,
    items: ReturnItemInspection[],
    notes: string
  ) => {
    if (!inspectDialog.data) return
    try {
      inspectReturn(inspectDialog.data.returnId, inspectorName, items, notes)
      inspectDialog.close()
    } catch (e: unknown) {
      inspectDialog.setError(e instanceof Error ? e.message : 'Error al registrar inspección')
    }
  }

  const handleSetDisposition = (disposition: ReturnOrder['disposition']) => {
    if (!dispositionDialog.data) return
    try {
      setReturnDisposition(dispositionDialog.data.returnId, disposition)
      dispositionDialog.close()
    } catch (e: unknown) {
      dispositionDialog.setError(
        e instanceof Error ? e.message : 'Error al actualizar disposición'
      )
    }
  }

  const columns = useMemo(
    () => buildReturnColumns(handleOpenAdvance),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const filtersNode = (
    <>
      <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Disposición" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las disposiciones</SelectItem>
          <SelectItem value="restock">Reingresar</SelectItem>
          <SelectItem value="scrap">Desecho</SelectItem>
          <SelectItem value="quality_control">Control calidad</SelectItem>
          <SelectItem value="repair">Reparación</SelectItem>
          <SelectItem value="rejected">Rechazada</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-52">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <SelectItem key={val} value={val}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Devoluciones"
        description="Flujo de 11 estados: desde la solicitud del cliente hasta el cierre (reingreso, desecho o reparación)."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="En tránsito al DC" value={inTransitCount} icon={Undo2} tone="blue" />
        <KpiCard label="En validación" value={validationCount} icon={ClipboardCheck} tone="amber" />
        <KpiCard label="Inspeccionadas" value={inspectedCount} icon={ClipboardCheck} tone="green" />
        <KpiCard label="Para reingresar" value={reenteredCount} icon={PackageCheck} tone="green" />
        <KpiCard
          label="En reparación"
          value={repairCount}
          icon={Wrench}
          tone="amber"
          sublabel={
            openRepairTickets > 0
              ? `${openRepairTickets} ticket${openRepairTickets > 1 ? 's' : ''} abierto${openRepairTickets > 1 ? 's' : ''}`
              : undefined
          }
        />
        <KpiCard label="Para desecho" value={scrapCount} icon={Trash2} tone="red" />
        <KpiCard label="Cerradas" value={closedCount} icon={CheckCircle2} tone="neutral" />
      </div>

      {/* Tabla principal */}
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Undo2 className="size-4" /> Todas las devoluciones (RMA)
          </div>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por RMA o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            filters={filtersNode}
            emptyMessage="No hay devoluciones con los filtros seleccionados."
          />
        </CardContent>
      </Card>

      {/* Cards de RMAs activas — requieren acción */}
      {activeReturns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Requieren acción</h2>
            <Badge variant="outline" className="tabular-nums">
              {activeReturns.length}
            </Badge>
          </div>

          {activeReturns.map((ret) => {
            const inspection = ret.inspectionId
              ? state.returnInspections.find((i) => i.id === ret.inspectionId)
              : undefined
            const reason = state.reasons.find((r) => r.id === ret.reasonId)
            const banner = STATUS_BANNERS[ret.status]
            const openTicket = state.repairTickets.find(
              (t) =>
                t.returnOrderId === ret.id &&
                t.status !== 'completed' &&
                t.status !== 'failed'
            )

            return (
              <Card key={ret.id} className="overflow-hidden">
                {/* Header de la card */}
                <CardHeader className="pb-0 pt-4 px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Identidad del RMA */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base">{ret.rmaCode}</span>
                        <StatusBadge status={ret.status} />
                        <Badge
                          variant="outline"
                          className={`text-xs ${DISPOSITION_COLORS[ret.disposition]}`}
                        >
                          {DISPOSITION_LABELS[ret.disposition]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3" /> {ret.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {warehouseName(ret.originId)}
                          <ChevronRight className="size-3" />
                          {warehouseName(ret.destinationId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="size-3" /> {TYPE_LABELS[ret.type]}
                        </span>
                        {reason && (
                          <span className="flex items-center gap-1">
                            <TriangleAlert className="size-3" /> {reason.label}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {format(parseISO(ret.createdAt), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-foreground/70">
                          <Clock className="size-3" />
                          {daysInStatus(ret)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones principales */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {ret.status === 'under_validation' && (
                        <>
                          <Button
                            size="sm"
                            variant={inspection ? 'outline' : 'default'}
                            onClick={() => handleOpenInspect(ret)}
                          >
                            <ClipboardCheck className="mr-1.5 size-3.5" />
                            {inspection ? 'Re-inspeccionar' : 'Inspeccionar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenDisposition(ret)}>
                            <Settings2 className="mr-1.5 size-3.5" /> Disposición
                          </Button>
                        </>
                      )}

                      {ret.status === 'reentered' && (
                        <Button size="sm" onClick={() => handleOpenReentry(ret)}>
                          <PackageCheck className="mr-1.5 size-3.5" /> Reingresar al stock
                        </Button>
                      )}

                      {ret.status === 'sent_to_repair' && (
                        <>
                          {!openTicket && (
                            <Button size="sm" variant="outline" onClick={() => handleOpenRepair(ret)}>
                              <Wrench className="mr-1.5 size-3.5" /> Crear ticket
                            </Button>
                          )}
                          {openTicket && (
                            <Button size="sm" onClick={() => handleOpenRepairReturn(openTicket)}>
                              <PackageCheck className="mr-1.5 size-3.5" /> Recibir del taller
                            </Button>
                          )}
                        </>
                      )}

                      {ret.status === 'sent_to_scrap' && (
                        <Button size="sm" variant="destructive" onClick={() => handleOpenScrap(ret)}>
                          <Trash2 className="mr-1.5 size-3.5" /> Confirmar baja
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-4 pt-3 space-y-3">
                  {/* Banner contextual de estado */}
                  {banner && (
                    <div className={`rounded-lg border px-3 py-2 text-xs ${banner.color}`}>
                      {banner.message}
                    </div>
                  )}

                  {/* Tabla de ítems */}
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Producto</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs w-20">Uds.</th>
                          {inspection && (
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-32">Condición</th>
                          )}
                          {inspection && (
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-40">Disposición rec.</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ret.items.map((line) => {
                          const itemInspection = inspection?.items.find(
                            (i) => i.returnLineId === line.id
                          )
                          return (
                            <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-2">{productName(line.productId)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatNumber(line.requestedQuantity)}
                              </td>
                              {inspection && (
                                <td className="px-3 py-2">
                                  {itemInspection ? (
                                    <Badge
                                      className={CONDITION_COLORS[itemInspection.conditionRating]}
                                      variant="outline"
                                    >
                                      {CONDITION_LABELS[itemInspection.conditionRating]}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              )}
                              {inspection && (
                                <td className="px-3 py-2 text-muted-foreground text-xs">
                                  {itemInspection
                                    ? DISPOSITION_LABELS[
                                        itemInspection.recommendedDisposition as ReturnOrder['disposition']
                                      ] ?? itemInspection.recommendedDisposition
                                    : '—'}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Resultado de inspección */}
                  {inspection && (
                    <div className="space-y-2">
                      <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${RESULT_STYLES[inspection.overallResult]}`}>
                        <p className="text-xs font-medium">
                          Inspección por{' '}
                          <span className="font-semibold">{inspection.inspectorName}</span>
                          {inspection.notes && (
                            <span className="font-normal"> — {inspection.notes}</span>
                          )}
                        </p>
                        <Badge
                          variant="outline"
                          className={`shrink-0 font-semibold ${RESULT_STYLES[inspection.overallResult]}`}
                        >
                          {RESULT_LABELS[inspection.overallResult]}
                        </Badge>
                      </div>
                      {/* Serial validation results */}
                      {inspection.items.some((i) => i.serial) && (
                        <div className="space-y-1">
                          {inspection.items.filter((i) => i.serial).map((item) => (
                            <div
                              key={item.returnLineId}
                              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                                item.serialMatchesDispatch === false
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : item.serialMatchesDispatch === true
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-border bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              <Hash className="size-3 shrink-0" />
                              <span className="font-mono font-semibold">{item.serial}</span>
                              <span className="text-[10px]">
                                {item.serialMatchesDispatch === true && '✓ Serial verificado contra despacho'}
                                {item.serialMatchesDispatch === false && '⚠ Serial NO encontrado en historial de despachos'}
                                {item.serialMatchesDispatch === undefined && '— Sin verificación de despacho'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info del ticket de reparación activo */}
                  {openTicket && ret.status === 'sent_to_repair' && (
                    <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
                      <div className="space-y-0.5">
                        <p className="font-medium text-xs">
                          Ticket con <span className="font-semibold">{openTicket.vendorName}</span>
                        </p>
                        <p className="text-xs opacity-80">
                          Retorno esperado: {openTicket.expectedReturnDate}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-orange-300 bg-orange-100 text-orange-800 text-xs">
                        {openTicket.repairType === 'cosmetic' ? 'Cosmética' : openTicket.repairType === 'functional' ? 'Funcional' : 'Garantía'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Advance dialog */}
      <Dialog
        open={!!advanceDialog.data}
        onOpenChange={(o) => { if (!o) advanceDialog.close() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avanzar devolución</DialogTitle>
            <DialogDescription className="sr-only">
              Confirmar avance de estado del RMA
            </DialogDescription>
          </DialogHeader>
          {advanceDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">RMA</span>
                  <span className="font-medium">{advanceDialog.data.rmaCode}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{advanceDialog.data.customerName}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Disposición</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${DISPOSITION_COLORS[advanceDialog.data.disposition as ReturnOrder['disposition']]}`}
                  >
                    {DISPOSITION_LABELS[advanceDialog.data.disposition as ReturnOrder['disposition']] ?? advanceDialog.data.disposition}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-center gap-4 rounded-xl border p-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Estado actual</p>
                  <StatusBadge status={advanceDialog.data.currentStatus} />
                </div>
                <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Nuevo estado</p>
                  <StatusBadge status={advanceDialog.data.nextStatus} />
                </div>
              </div>

              {advanceDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {advanceDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={advanceDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleAdvance}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar avance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect dialog */}
      {inspectDialog.data && (
        <InspectReturnDialog
          open={!!inspectDialog.data}
          rmaCode={inspectDialog.data.rmaCode}
          customerName={inspectDialog.data.customerName}
          items={inspectDialog.data.items}
          productName={productName}
          getProduct={getProduct}
          onConfirm={handleInspect}
          onClose={inspectDialog.close}
          error={inspectDialog.error}
        />
      )}

      {/* Set disposition dialog */}
      {dispositionDialog.data && (
        <SetDispositionDialog
          open={!!dispositionDialog.data}
          rmaCode={dispositionDialog.data.rmaCode}
          customerName={dispositionDialog.data.customerName}
          currentDisposition={dispositionDialog.data.currentDisposition}
          onConfirm={handleSetDisposition}
          onClose={dispositionDialog.close}
          error={dispositionDialog.error}
        />
      )}

      {/* Repair dialog */}
      {repairDialog.data && (
        <RepairDialog
          open={!!repairDialog.data}
          rmaCode={repairDialog.data.rmaCode}
          customerName={repairDialog.data.customerName}
          items={repairDialog.data.items}
          productName={productName}
          onConfirm={handleCreateRepair}
          onClose={repairDialog.close}
          error={repairDialog.error}
        />
      )}

      {/* Repair return dialog */}
      {repairReturnDialog.data && (
        <RepairReturnDialog
          open={!!repairReturnDialog.data}
          ticket={repairReturnDialog.data.ticket}
          availableLocations={state.locations.filter((l) => !l.isBlocked)}
          productName={productName}
          onConfirm={handleReceiveRepair}
          onClose={repairReturnDialog.close}
          error={repairReturnDialog.error}
        />
      )}

      {/* Scrap dialog */}
      {scrapDialog.data && (
        <ScrapDialog
          open={!!scrapDialog.data}
          rmaCode={scrapDialog.data.rmaCode}
          customerName={scrapDialog.data.customerName}
          items={scrapDialog.data.items}
          scrapReasons={state.reasons.filter((r) => r.context === 'scrap' && r.active)}
          productName={productName}
          onConfirm={handleScrap}
          onClose={scrapDialog.close}
          error={scrapDialog.error}
        />
      )}

      {/* Reentry dialog */}
      {reentryDialog.data && (
        <ReentryDialog
          open={!!reentryDialog.data}
          rmaCode={reentryDialog.data.rmaCode}
          customerName={reentryDialog.data.customerName}
          items={reentryDialog.data.items}
          availableLocations={state.locations.filter((l) => !l.isBlocked)}
          productName={productName}
          onConfirm={handleReentry}
          onClose={reentryDialog.close}
          error={reentryDialog.error}
        />
      )}
    </>
  )
}
