'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardCheck,
  Filter,
  Hash,
  PackageCheck,
  Plus,
  Settings2,
  Snowflake,
  Timer,
  Trash2,
  TrendingDown,
  TriangleAlert,
  Undo2,
  Wrench,
  MapPin,
  User,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { statusLabel } from '@/lib/status'
import { selectReturnsKpis } from '@/store/selectors'
import {
  CONDITION_COLORS,
  CONDITION_LABELS,
  DISPOSITION_COLORS,
  DISPOSITION_LABELS,
  ITEM_DISPOSITION_LABELS,
  RESULT_LABELS,
  RESULT_STYLES,
  RETURN_STATUS_ORDER,
  RETURN_TYPE_LABELS,
  RETURN_TYPES,
  TERMINAL_RETURN_STATUSES,
  canRejectReturn,
  nextReturnStatus,
} from '@/lib/returns'
import { CreateReturnDialog } from './_components/create-return-dialog'
import { InspectReturnDialog } from './_components/inspect-return-dialog'
import { SetDispositionDialog } from './_components/set-disposition-dialog'
import { ReentryDialog } from './_components/reentry-dialog'
import { ScrapDialog } from './_components/scrap-dialog'
import { RepairDialog } from './_components/repair-dialog'
import { RepairReturnDialog } from './_components/repair-return-dialog'
import {
  InspectionsTable,
  ReentriesTable,
  RepairsTable,
  ScrapTable,
} from './_components/returns-registry-tables'
import { buildReturnColumns, type ReturnRow } from './columns'
import { ReturnDetailSheet } from './_components/return-detail-sheet'
import type {
  ItemDisposition,
  ReentryBatch,
  ReentryLine,
  RepairTicket,
  RepairTicketLine,
  RepairType,
  ReturnItemInspection,
  ReturnOrder,
  ScrapLine,
  ScrapMethod,
  ScrapRecord,
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

interface RejectDialogData {
  returnId: string
  rmaCode: string
  customerName: string
}

interface RepairReturnDialogData {
  ticket: RepairTicket
}

const daysInStatus = (ret: ReturnOrder): string =>
  formatDistanceToNow(parseISO(ret.createdAt), { locale: es, addSuffix: false })

/* ─── Action banner por estado ────────────────────────────────────────── */

const STATUS_BANNERS: Partial<Record<string, { color: string; message: string }>> = {
  under_validation: {
    color: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
    message: 'Pendiente de inspección y asignación de disposición antes de avanzar.',
  },
  reentered: {
    color: 'border-green-200 bg-green-50 text-green-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
    message: 'Lista para ejecutar el reingreso al inventario.',
  },
  sent_to_repair: {
    color: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200',
    message: 'Crear un ticket con el taller y recibir el retorno cuando esté listo.',
  },
  sent_to_scrap: {
    color: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200',
    message: 'Confirmar la baja definitiva para cerrar esta devolución.',
  },
}

const URGENCY_ORDER: Partial<Record<string, number>> = {
  sent_to_scrap: 0,
  under_validation: 1,
  sent_to_quality_control: 1,
  reentered: 2,
  sent_to_repair: 3,
  in_transit_to_dc: 4,
  received_at_dc: 5,
  received_at_store: 6,
  requested: 7,
}

const URGENCY_BORDER: Partial<Record<string, string>> = {
  sent_to_scrap: 'border-l-red-500',
  under_validation: 'border-l-amber-400',
  sent_to_quality_control: 'border-l-amber-400',
  reentered: 'border-l-green-500',
  sent_to_repair: 'border-l-orange-400',
  in_transit_to_dc: 'border-l-blue-400',
}

export default function ReturnsPage() {
  const state = useWmsStore()
  const {
    advanceReturn,
    rejectReturn,
    inspectReturn,
    setReturnDisposition,
    executeReentry,
    executeScrap,
    createRepairTicket,
    receiveRepairReturn,
  } = state
  const { warehouseName, productName, getProduct } = useStoreHelpers()

  const kpis = useMemo(() => selectReturnsKpis(state), [state])

  const [tab, setTab] = useState('orders')
  const [dispositionFilter, setDispositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [showAllTable, setShowAllTable] = useState(false)
  const [detailReturnId, setDetailReturnId] = useState<string | null>(null)
  const [actionSectionVisible, setActionSectionVisible] = useState(false)
  const actionSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = actionSectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setActionSectionVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [tab, showAllTable])

  const advanceDialog = useDialogState<AdvanceReturnDialogData>()
  const rejectDialog = useDialogState<RejectDialogData>()
  const inspectDialog = useDialogState<ReturnActionDialogData>()
  const dispositionDialog = useDialogState<DispositionDialogData>()
  const reentryDialog = useDialogState<ReturnActionDialogData>()
  const scrapDialog = useDialogState<ReturnActionDialogData>()
  const repairDialog = useDialogState<ReturnActionDialogData>()
  const repairReturnDialog = useDialogState<RepairReturnDialogData>()

  // Serials actually dispatched per product (pick movements) — offered as
  // suggestions in the inspection dialog so serial validation is demonstrable.
  const dispatchedSerialsByProduct = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const mv of state.stockMovements) {
      if (mv.type !== 'pick' || !mv.serial) continue
      if (!map.has(mv.productId)) map.set(mv.productId, new Set())
      map.get(mv.productId)!.add(mv.serial)
    }
    return map
  }, [state.stockMovements])

  const getDispatchedSerials = (productId: string): string[] =>
    Array.from(dispatchedSerialsByProduct.get(productId) ?? [])

  const rmaCode = (returnOrderId: string): string =>
    state.returnOrders.find((r) => r.id === returnOrderId)?.rmaCode ?? returnOrderId

  const rows = useMemo<ReturnRow[]>(
    () =>
      state.returnOrders.map((ret) => {
        const reason = state.reasons.find((r) => r.id === ret.reasonId)
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
          canAdvance: !TERMINAL_RETURN_STATUSES.has(ret.status) && !!nextReturnStatus(ret),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.returnOrders, state.reasons]
  )

  const returnById = useMemo(
    () => new Map(state.returnOrders.map((r) => [r.id, r])),
    [state.returnOrders]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (dispositionFilter !== 'all' && r.disposition !== dispositionFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (typeFilter !== 'all' && r.type !== typeFilter) return false
        if (warehouseFilter !== 'all') {
          const ret = returnById.get(r.id)
          if (ret && ret.originId !== warehouseFilter && ret.destinationId !== warehouseFilter)
            return false
        }
        if (search.trim()) {
          const q = search.toLowerCase()
          if (!r.rmaCode.toLowerCase().includes(q) && !r.customerName.toLowerCase().includes(q))
            return false
        }
        return true
      }),
    [rows, returnById, dispositionFilter, statusFilter, typeFilter, warehouseFilter, search]
  )

  const hasActiveFilters =
    dispositionFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    warehouseFilter !== 'all' ||
    search.trim() !== ''

  const handleClearFilters = () => {
    setDispositionFilter('all')
    setStatusFilter('all')
    setTypeFilter('all')
    setWarehouseFilter('all')
    setSearch('')
  }

  const activeReturns = useMemo(
    () => state.returnOrders.filter((r) => !TERMINAL_RETURN_STATUSES.has(r.status)),
    [state.returnOrders]
  )

  const detailReturn = useMemo(
    () => state.returnOrders.find((r) => r.id === detailReturnId) ?? null,
    [state.returnOrders, detailReturnId]
  )

  const detailInspection = useMemo(
    () =>
      detailReturn?.inspectionId
        ? state.returnInspections.find((i) => i.id === detailReturn.inspectionId)
        : undefined,
    [detailReturn, state.returnInspections]
  )

  const detailRepairTickets = useMemo(
    () => state.repairTickets.filter((t) => t.returnOrderId === detailReturnId),
    [state.repairTickets, detailReturnId]
  )

  const detailScrapRecord = useMemo(
    () => state.scrapRecords.find((s: ScrapRecord) => s.returnOrderId === detailReturnId),
    [state.scrapRecords, detailReturnId]
  )

  const detailReentryBatch = useMemo(
    () => state.reentryBatches.find((b: ReentryBatch) => b.returnOrderId === detailReturnId),
    [state.reentryBatches, detailReturnId]
  )

  const handleOpenAdvance = (row: ReturnRow) => {
    const ret = state.returnOrders.find((r) => r.id === row.id)
    if (!ret) return
    const next = nextReturnStatus(ret)
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

  const handleOpenInspect = (ret: ReturnOrder) =>
    inspectDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })

  const handleOpenDisposition = (ret: ReturnOrder) =>
    dispositionDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      currentDisposition: ret.disposition,
    })

  const handleOpenReentry = (ret: ReturnOrder) =>
    reentryDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })

  const handleOpenRepair = (ret: ReturnOrder) =>
    repairDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })

  const handleOpenReject = (ret: ReturnOrder) =>
    rejectDialog.open({ returnId: ret.id, rmaCode: ret.rmaCode, customerName: ret.customerName })

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

  const handleOpenRepairReturn = (ticket: RepairTicket) => repairReturnDialog.open({ ticket })

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

  const handleOpenScrap = (ret: ReturnOrder) =>
    scrapDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      items: ret.items,
    })

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

  const handleReject = () => {
    if (!rejectDialog.data) return
    try {
      rejectReturn(rejectDialog.data.returnId, 'Operador')
      rejectDialog.close()
    } catch (e: unknown) {
      rejectDialog.setError(e instanceof Error ? e.message : 'Error al rechazar devolución')
    }
  }

  const handleInspect = (inspectorName: string, items: ReturnItemInspection[], notes: string) => {
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
      dispositionDialog.setError(e instanceof Error ? e.message : 'Error al actualizar disposición')
    }
  }

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const toggleCard = (id: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const sortedActiveReturns = useMemo(
    () =>
      [...activeReturns].sort(
        (a, b) => (URGENCY_ORDER[a.status] ?? 99) - (URGENCY_ORDER[b.status] ?? 99)
      ),
    [activeReturns]
  )

  const columns = useMemo(
    () => buildReturnColumns(handleOpenAdvance, (row) => setDetailReturnId(row.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2.5 size-3.5" />
        <Input
          placeholder="Buscar por RMA o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-52 pl-8 text-sm"
        />
      </div>
      <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Disposición" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las disposiciones</SelectItem>
          {(Object.keys(DISPOSITION_LABELS) as ReturnOrder['disposition'][]).map((d) => (
            <SelectItem key={d} value={d}>
              {DISPOSITION_LABELS[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {RETURN_STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {RETURN_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {RETURN_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Bodega" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las bodegas</SelectItem>
          {state.warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Devoluciones"
        description="Flujo de 11 estados: desde la solicitud del cliente hasta el cierre (reingreso, desecho o reparación)."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={state.settings.returnsFreezeActive}
            title={
              state.settings.returnsFreezeActive
                ? 'Módulo congelado en Configuración → Devoluciones'
                : undefined
            }
          >
            <Plus className="mr-1.5 size-4" /> Nueva devolución
          </Button>
        }
      />

      {/* Banner de congelamiento */}
      {state.settings.returnsFreezeActive && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
          <Snowflake className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Devoluciones congeladas.</span> Toda operación (registrar,
            avanzar, inspeccionar, reingresar, reparar, dar de baja) está bloqueada. Desactívalo en{' '}
            <a href="/returns-settings" className="font-medium underline underline-offset-2">
              Configuración → Devoluciones
            </a>
            .
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total devoluciones" value={kpis.total} icon={Undo2} tone="neutral" />
        <KpiCard
          label="En proceso"
          value={kpis.active}
          icon={ClipboardCheck}
          tone={kpis.active > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Tasa devoluciones"
          value={`${kpis.returnRatePct.toFixed(1)}%`}
          icon={TrendingDown}
          tone="blue"
          sublabel="vs pedidos"
        />
        <KpiCard
          label="Tiempo de ciclo"
          value={kpis.avgCycleDays === null ? '—' : `${kpis.avgCycleDays} d`}
          icon={Timer}
          tone="neutral"
          sublabel={kpis.avgCycleDays === null ? undefined : 'prom.'}
        />
        <KpiCard
          label="En reparación"
          value={kpis.inRepair}
          icon={Wrench}
          tone={kpis.inRepair > 0 ? 'amber' : 'neutral'}
          sublabel={
            kpis.openRepairTickets > 0
              ? `${kpis.openRepairTickets} ticket${kpis.openRepairTickets > 1 ? 's' : ''}`
              : undefined
          }
        />
        <KpiCard label="Para desecho" value={kpis.toScrap} icon={Trash2} tone="red" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="orders">
            <Undo2 className="mr-1.5 size-3.5" /> Órdenes
            <Badge variant="secondary" className="ml-1.5 tabular-nums">
              {kpis.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="inspections">
            <ClipboardCheck className="mr-1.5 size-3.5" /> Inspecciones
            <Badge variant="secondary" className="ml-1.5 tabular-nums">
              {kpis.inspected}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reentries">
            <PackageCheck className="mr-1.5 size-3.5" /> Reingresos
            <Badge variant="secondary" className="ml-1.5 tabular-nums">
              {state.reentryBatches.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="repairs">
            <Wrench className="mr-1.5 size-3.5" /> Reparaciones
            <Badge variant="secondary" className="ml-1.5 tabular-nums">
              {state.repairTickets.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="scrap">
            <Trash2 className="mr-1.5 size-3.5" /> Bajas
            <Badge variant="secondary" className="ml-1.5 tabular-nums">
              {state.scrapRecords.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── Órdenes: cola de acción + tabla completa (colapsable) ─── */}
        <TabsContent value="orders" className="flex flex-col gap-6">
          {/* Cola "Requieren acción" */}
          {sortedActiveReturns.length > 0 ? (
            <div
              ref={actionSectionRef}
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-transparent"
            >
              <div className="flex items-center gap-2">
                <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Requieren acción
                </h2>
                <Badge className="border-0 bg-amber-500 text-xs text-white tabular-nums">
                  {sortedActiveReturns.length}
                </Badge>
              </div>

              {sortedActiveReturns.map((ret) => {
                const inspection = ret.inspectionId
                  ? state.returnInspections.find((i) => i.id === ret.inspectionId)
                  : undefined
                const reason = state.reasons.find((r) => r.id === ret.reasonId)
                const banner = STATUS_BANNERS[ret.status]
                const openTicket = state.repairTickets.find(
                  (t) =>
                    t.returnOrderId === ret.id && t.status !== 'completed' && t.status !== 'failed'
                )
                const isExpanded = expandedCards.has(ret.id)
                const urgencyBorder = URGENCY_BORDER[ret.status] ?? 'border-l-muted-foreground/30'

                return (
                  <Card key={ret.id} className={`overflow-hidden border-l-4 ${urgencyBorder}`}>
                    <CardHeader className="px-4 pt-3 pb-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setDetailReturnId(ret.id)}
                              className="text-sm font-semibold hover:underline"
                            >
                              {ret.rmaCode}
                            </button>
                            <StatusBadge status={ret.status} />
                            <Badge
                              variant="outline"
                              className={`text-xs ${DISPOSITION_COLORS[ret.disposition]}`}
                            >
                              {DISPOSITION_LABELS[ret.disposition]}
                            </Badge>
                          </div>
                          {banner && (
                            <p
                              className={`inline-block rounded-md border px-2 py-1 text-xs font-medium ${banner.color}`}
                            >
                              {banner.message}
                            </p>
                          )}
                          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="flex items-center gap-1">
                              <User className="size-3" /> {ret.customerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {warehouseName(ret.originId)}
                              <ChevronRight className="size-3" />
                              {warehouseName(ret.destinationId)}
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
                            <span className="text-foreground/70 flex items-center gap-1 font-medium">
                              <Clock className="size-3" />
                              {daysInStatus(ret)}
                            </span>
                          </div>
                        </div>

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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDisposition(ret)}
                              >
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenRepair(ret)}
                                >
                                  <Wrench className="mr-1.5 size-3.5" /> Crear ticket
                                </Button>
                              )}
                              {openTicket && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenRepairReturn(openTicket)}
                                >
                                  <PackageCheck className="mr-1.5 size-3.5" /> Recibir del taller
                                </Button>
                              )}
                            </>
                          )}
                          {ret.status === 'sent_to_scrap' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleOpenScrap(ret)}
                            >
                              <Trash2 className="mr-1.5 size-3.5" /> Confirmar baja
                            </Button>
                          )}
                          {canRejectReturn(ret.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleOpenReject(ret)}
                            >
                              <XCircle className="mr-1.5 size-3.5" /> Rechazar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleCard(ret.id)}
                            className="text-muted-foreground px-2"
                          >
                            <ChevronDown
                              className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                            <span className="ml-1 text-xs">
                              {ret.items.length} ítem{ret.items.length !== 1 ? 's' : ''}
                            </span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-3 px-4 pt-3 pb-4">
                        <div className="overflow-hidden rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="text-xs">Producto</TableHead>
                                <TableHead className="w-20 text-right text-xs">Uds.</TableHead>
                                {inspection && <TableHead className="w-32 text-xs">Condición</TableHead>}
                                {inspection && (
                                  <TableHead className="w-40 text-xs">Disposición rec.</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ret.items.map((line) => {
                                const itemInspection = inspection?.items.find(
                                  (i) => i.returnLineId === line.id
                                )
                                return (
                                  <TableRow key={line.id}>
                                    <TableCell className="text-sm">
                                      {productName(line.productId)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm tabular-nums">
                                      {formatNumber(line.requestedQuantity)}
                                    </TableCell>
                                    {inspection && (
                                      <TableCell>
                                        {itemInspection ? (
                                          <Badge
                                            variant="outline"
                                            className={CONDITION_COLORS[itemInspection.conditionRating]}
                                          >
                                            {CONDITION_LABELS[itemInspection.conditionRating]}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                      </TableCell>
                                    )}
                                    {inspection && (
                                      <TableCell className="text-muted-foreground text-xs">
                                        {itemInspection
                                          ? ITEM_DISPOSITION_LABELS[
                                              itemInspection.recommendedDisposition as ItemDisposition
                                            ]
                                          : '—'}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {inspection && (
                          <div className="space-y-2">
                            <div
                              className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${RESULT_STYLES[inspection.overallResult]}`}
                            >
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
                            {inspection.items.some((i) => i.serial) && (
                              <div className="space-y-1">
                                {inspection.items
                                  .filter((i) => i.serial)
                                  .map((item) => (
                                    <div
                                      key={item.returnLineId}
                                      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                                        item.serialMatchesDispatch === false
                                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                                          : item.serialMatchesDispatch === true
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                                            : 'border-border bg-muted/30 text-muted-foreground'
                                      }`}
                                    >
                                      <Hash className="size-3 shrink-0" />
                                      <span className="font-mono font-semibold">{item.serial}</span>
                                      <span className="text-[10px]">
                                        {item.serialMatchesDispatch === true &&
                                          '✓ Serial verificado contra despacho'}
                                        {item.serialMatchesDispatch === false &&
                                          '⚠ Serial NO encontrado en historial de despachos'}
                                        {item.serialMatchesDispatch === undefined &&
                                          '— Sin verificación de despacho'}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        {openTicket && ret.status === 'sent_to_repair' && (
                          <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200">
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium">
                                Ticket con <span className="font-semibold">{openTicket.vendorName}</span>
                              </p>
                              <p className="text-xs opacity-80">
                                Retorno esperado: {openTicket.expectedReturnDate}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">Todo al día</p>
              <p className="text-muted-foreground text-sm">
                No hay devoluciones pendientes de acción. Registra una con «Nueva devolución».
              </p>
            </div>
          )}

          {/* Tabla completa — colapsable para no alargar la vista */}
          <Card>
            <CardContent className="pt-4">
              <button
                onClick={() => setShowAllTable((v) => !v)}
                className="mb-2 flex w-full items-center justify-between text-base font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Undo2 className="size-4" /> Todas las devoluciones (RMA)
                  <Badge variant="secondary" className="tabular-nums">
                    {kpis.total}
                  </Badge>
                </span>
                <ChevronDown
                  className={`text-muted-foreground size-4 transition-transform ${showAllTable ? 'rotate-180' : ''}`}
                />
              </button>
              {showAllTable && (
                <DataTable
                  columns={columns}
                  data={filteredRows}
                  filters={filtersNode}
                  emptyState={
                    hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <Filter className="text-muted-foreground size-6" />
                        <p className="text-muted-foreground text-sm">
                          No hay devoluciones con los filtros seleccionados.
                        </p>
                        <Button variant="outline" size="sm" onClick={handleClearFilters}>
                          Limpiar filtros
                        </Button>
                      </div>
                    ) : undefined
                  }
                  emptyMessage="No hay devoluciones registradas."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardContent className="pt-4">
              <InspectionsTable
                inspections={state.returnInspections}
                rmaCode={rmaCode}
                onOpenReturn={setDetailReturnId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reentries">
          <Card>
            <CardContent className="pt-4">
              <ReentriesTable
                reentries={state.reentryBatches}
                rmaCode={rmaCode}
                onOpenReturn={setDetailReturnId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repairs">
          <Card>
            <CardContent className="pt-4">
              <RepairsTable
                tickets={state.repairTickets}
                rmaCode={rmaCode}
                onOpenReturn={setDetailReturnId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrap">
          <Card>
            <CardContent className="pt-4">
              <ScrapTable
                records={state.scrapRecords}
                rmaCode={rmaCode}
                onOpenReturn={setDetailReturnId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Advance dialog */}
      <Dialog
        open={!!advanceDialog.data}
        onOpenChange={(o) => {
          if (!o) advanceDialog.close()
        }}
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
                <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground">RMA</span>
                  <span className="font-medium">{advanceDialog.data.rmaCode}</span>
                </div>
                <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{advanceDialog.data.customerName}</span>
                </div>
                <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Disposición</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${DISPOSITION_COLORS[advanceDialog.data.disposition as ReturnOrder['disposition']]}`}
                  >
                    {DISPOSITION_LABELS[advanceDialog.data.disposition as ReturnOrder['disposition']] ??
                      advanceDialog.data.disposition}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-center gap-4 rounded-xl border p-4">
                <div className="space-y-1 text-center">
                  <p className="text-muted-foreground text-xs">Estado actual</p>
                  <StatusBadge status={advanceDialog.data.currentStatus} />
                </div>
                <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                <div className="space-y-1 text-center">
                  <p className="text-muted-foreground text-xs">Nuevo estado</p>
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

      {/* Reject dialog */}
      <Dialog
        open={!!rejectDialog.data}
        onOpenChange={(o) => {
          if (!o) rejectDialog.close()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar devolución</DialogTitle>
            <DialogDescription>
              La devolución {rejectDialog.data?.rmaCode} se marcará como rechazada y quedará cerrada.
              No reingresa stock ni continúa el flujo.
            </DialogDescription>
          </DialogHeader>
          {rejectDialog.error && (
            <p className="text-destructive flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {rejectDialog.error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={rejectDialog.close}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="mr-1 size-4" /> Rechazar devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create return dialog */}
      <CreateReturnDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Inspect dialog */}
      {inspectDialog.data && (
        <InspectReturnDialog
          open={!!inspectDialog.data}
          rmaCode={inspectDialog.data.rmaCode}
          customerName={inspectDialog.data.customerName}
          items={inspectDialog.data.items}
          productName={productName}
          getProduct={getProduct}
          autoDispositionEnabled={state.settings.returnAutoDispositionEnabled}
          gradingPolicy={state.settings.returnGradingPolicy}
          getDispatchedSerials={getDispatchedSerials}
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

      <ReturnDetailSheet
        open={!!detailReturnId}
        returnOrder={detailReturn}
        inspection={detailInspection}
        repairTickets={detailRepairTickets}
        scrapRecord={detailScrapRecord}
        reentryBatch={detailReentryBatch}
        returnWindowDays={state.settings.returnWindowDays}
        warehouseName={warehouseName}
        productName={productName}
        getProduct={getProduct}
        onClose={() => setDetailReturnId(null)}
      />

      {/* Floating pill — discreto, sin rebote; solo en la pestaña Órdenes */}
      {tab === 'orders' && sortedActiveReturns.length > 0 && !actionSectionVisible && (
        <button
          onClick={() =>
            actionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-500/95 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-amber-600"
        >
          <TriangleAlert className="size-4 shrink-0" />
          {sortedActiveReturns.length} requieren acción
          <ArrowDown className="size-4 shrink-0" />
        </button>
      )}
    </div>
  )
}
