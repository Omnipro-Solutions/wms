'use client'

import { useMemo, useCallback, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  FileText,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useWmsStore } from '@/store/wms-store'
import { abcByProduct } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/data-table'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import {
  buildAppointmentColumns,
  buildPoColumns,
  buildReceivingColumns,
  buildQcColumns,
  buildPutawayColumns,
  type AsnRow,
  type PoRow,
  type ActionType,
} from './columns'
import { useReceiveDialog } from './_hooks/use-receive-dialog'
import { useReceptionSheet } from './_hooks/use-reception-sheet'
import { ReceiveDialog } from './_components/receive-dialog'
import { CloseAsnDialog, useCloseAsnDialog } from './_components/close-asn-dialog'
import { QcDialog, useQcDialog } from './_components/qc-dialog'
import { PutawayDialog, usePutawayDialog } from './_components/putaway-dialog'
import { ReceptionSheet } from './_components/reception-sheet'
import { EmptyState } from './_components/empty-state'
import { TabPanel } from './_components/tab-panel'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabValue = 'ordenes' | 'citas' | 'recibiendo' | 'qc' | 'putaway'

const PO_STATUS_OPTIONS: { value: string; label: string; active: string }[] = [
  { value: 'confirmed', label: 'Confirmada', active: 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-100' },
  { value: 'partial',   label: 'Parcial',    active: 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-100' },
  { value: 'received',  label: 'Recibida',   active: 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  { value: 'cancelled', label: 'Cancelada',  active: 'border-red-300 bg-red-100 text-red-700 hover:bg-red-100' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const ReceivingPage = () => {
  const state = useWmsStore()
  const { productName: getProductName } = useStoreHelpers()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [poStatusFilter, setPoStatusFilter] = useState<Set<string>>(new Set())

  const activeTab = (searchParams.get('tab') as TabValue) ?? 'ordenes'

  const abc = useMemo(() => abcByProduct(state), [state])

  const receiveDialogState = useReceiveDialog()
  const closeDialogState = useCloseAsnDialog()
  const qcDialogState = useQcDialog()
  const putawayDialogState = usePutawayDialog()
  const sheetState = useReceptionSheet()

  // ── ASN rows ──────────────────────────────────────────────────────────────
  const rows = useMemo<AsnRow[]>(
    () => {
      const today = new Date().toISOString().slice(0, 10)
      return state.asnRecords.map((asn) => {
        const product = state.products.find((p) => p.id === asn.productId)
        return {
          id: asn.id,
          code: asn.code,
          supplierName: asn.supplierName,
          productName: getProductName(asn.productId),
          productId: asn.productId,
          productCategory: product?.category ?? 'Otros',
          abcClass: abc[asn.productId] ?? 'C',
          appointmentDate: asn.appointmentDate,
          expectedQuantity: asn.expectedQuantity,
          receivedQuantity: asn.receivedQuantity,
          damagedQuantity: asn.damagedQuantity,
          pendingQuantity: asn.expectedQuantity - asn.receivedQuantity,
          progressPct: Math.round((asn.receivedQuantity / asn.expectedQuantity) * 100),
          status: asn.status,
          requiresQualityControl: asn.requiresQualityControl,
          crossDocking: asn.crossDocking,
          deliveryCount: asn.deliveryCount,
          canReceive:
            asn.status === 'pending' || asn.status === 'partial' || asn.status === 'in_progress',
          canClose: asn.status === 'partial' || asn.status === 'in_progress',
          canPutaway:
            asn.status === 'completed' || (!asn.requiresQualityControl && asn.status === 'partial'),
          canQc:
            asn.requiresQualityControl &&
            (asn.status === 'partial' || asn.status === 'in_progress'),
          isOverdue:
            asn.appointmentDate < today &&
            asn.status !== 'completed' &&
            asn.status !== 'putaway_done' &&
            asn.status !== 'cancelled' &&
            asn.status !== 'short_received',
          requiresSerial: product?.trackBy === 'serial',
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.asnRecords, state.products]
  )

  // Single pass derives all tab subsets and KPI counts
  const { appointmentRows, receivingRows, qcRows, putawayRows, overdueCount, completedToday } =
    useMemo(() => {
      const appointmentRows: AsnRow[] = []
      const receivingRows: AsnRow[] = []
      const qcRows: AsnRow[] = []
      const putawayRows: AsnRow[] = []
      let overdueCount = 0
      let completedToday = 0

      for (const r of rows) {
        if (r.status === 'pending' || r.status === 'partial') appointmentRows.push(r)
        if (r.status === 'in_progress') receivingRows.push(r)
        if (r.requiresQualityControl && (r.status === 'partial' || r.status === 'in_progress'))
          qcRows.push(r)
        if (r.status === 'completed' || (!r.requiresQualityControl && r.status === 'partial'))
          putawayRows.push(r)
        if (r.isOverdue) overdueCount++
        if (
          r.status === 'putaway_done' ||
          r.status === 'completed' ||
          r.status === 'short_received'
        )
          completedToday++
      }

      return { appointmentRows, receivingRows, qcRows, putawayRows, overdueCount, completedToday }
    }, [rows])

  // ── Typed action dispatch map ─────────────────────────────────────────────
  const ACTION_HANDLERS: Record<ActionType, (row: AsnRow) => void> = useMemo(
    () => ({
      confirm: (row) => state.confirmArrival(row.id),
      receive: (row) =>
        receiveDialogState.open({
          asnId: row.id,
          asnCode: row.code,
          productName: row.productName,
          supplierName: row.supplierName,
          expectedTotal: row.expectedQuantity,
          receivedSoFar: row.receivedQuantity,
          pendingQty: row.pendingQuantity,
          deliveryCount: row.deliveryCount,
          requiresQC: row.requiresQualityControl,
          isCrossDocking: row.crossDocking,
          requiresSerial: row.requiresSerial,
          productId: row.productId,
        }),
      close: (row) =>
        closeDialogState.open({
          asnId: row.id,
          asnCode: row.code,
          productName: row.productName,
          supplierName: row.supplierName,
          expectedTotal: row.expectedQuantity,
          receivedSoFar: row.receivedQuantity,
          missingQty: row.pendingQuantity,
        }),
      putaway: (row) =>
        putawayDialogState.open(row.id, row.code, row.productName, row.abcClass, row.crossDocking),
      qc: (row) =>
        qcDialogState.dialog.open({
          asnId: row.id,
          productName: row.productName,
          asnCode: row.code,
          blockedQty: row.receivedQuantity,
          supplierName: row.supplierName,
        }),
    }),
    [state, receiveDialogState, closeDialogState, putawayDialogState, qcDialogState]
  )

  const handleAction = useCallback(
    (type: ActionType, row: AsnRow) => ACTION_HANDLERS[type](row),
    [ACTION_HANDLERS]
  )

  // ── PO rows ───────────────────────────────────────────────────────────────
  const poRows = useMemo<PoRow[]>(
    () => {
      const today = new Date().toISOString().slice(0, 10)
      return state.purchaseOrders.map((po) => {
        const totalOrdered = po.lines.reduce((s, l) => s + l.orderedQty, 0)
        const totalReceived = po.lines.reduce((s, l) => s + l.receivedQty, 0)
        const pendingQty = totalOrdered - totalReceived
        const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0
        return {
          id: po.id,
          code: po.code,
          supplierName: po.supplierName,
          status: po.status,
          expectedDate: po.expectedDate,
          lineCount: po.lines.length,
          totalOrdered,
          totalReceived,
          pendingQty,
          progressPct,
          isOverdue:
            po.expectedDate < today && po.status !== 'received' && po.status !== 'cancelled',
          canCreateReception: po.status === 'confirmed' || po.status === 'partial',
        }
      })
    },
    [state.purchaseOrders]
  )

  const pendingPoCount = useMemo(
    () => poRows.filter((r) => r.status === 'confirmed' || r.status === 'partial').length,
    [poRows]
  )

  const filteredPoRows = useMemo(() => {
    if (poStatusFilter.size === 0) return poRows
    return poRows.filter((r) => poStatusFilter.has(r.status))
  }, [poRows, poStatusFilter])

  const handlePoStatusToggle = useCallback((value: string) => {
    setPoStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }, [])

  // ── SubNav items ──────────────────────────────────────────────────────────
  const RECEIVING_TABS: SubNavItem[] = [
    { value: 'ordenes', label: 'Órdenes de compra', count: pendingPoCount },
    { value: 'citas', label: 'Citas ASN', count: appointmentRows.length },
    { value: 'recibiendo', label: 'Recibiendo activo', count: receivingRows.length },
    { value: 'qc', label: 'Control de calidad', count: qcRows.length },
    { value: 'putaway', label: 'Putaway staging', count: putawayRows.length },
  ]

  // ── Column definitions (memoized) ─────────────────────────────────────────
  const poCols = useMemo(() => buildPoColumns(sheetState.open), [sheetState.open])
  const appointmentCols = useMemo(() => buildAppointmentColumns(handleAction), [handleAction])
  const receivingCols = useMemo(() => buildReceivingColumns(handleAction), [handleAction])
  const qcCols = useMemo(() => buildQcColumns(handleAction), [handleAction])
  const putawayCols = useMemo(() => buildPutawayColumns(handleAction), [handleAction])

  return (
    <>
      <PageHeader
        title="Recepción — Inbound"
        description="Flujo completo de entrada de mercancía: programación de citas, conteo físico, inspección de calidad y ubicación en almacén."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard
          icon={FileText}
          value={pendingPoCount}
          label="Órdenes de compra"
          sublabel="Confirmadas con recepción pendiente"
          tone="neutral"
          onClick={() => router.push(pathname)}
        />
        <KpiCard
          icon={Truck}
          value={appointmentRows.length}
          label="Llegadas programadas"
          sublabel="Pendientes y parciales"
          tone="blue"
          onClick={() => router.push(pathname + '?tab=citas')}
        />
        <KpiCard
          icon={AlertTriangle}
          value={overdueCount}
          label="Entregas con atraso"
          sublabel={overdueCount > 0 ? 'Requieren atención' : 'Sin atrasos'}
          tone={overdueCount > 0 ? 'red' : 'neutral'}
          alert
          onClick={overdueCount > 0 ? () => router.push(pathname + '?tab=citas') : undefined}
        />
        <KpiCard
          icon={ShieldCheck}
          value={qcRows.length}
          label="En inspección de calidad"
          sublabel="Lotes bloqueados hasta aprobación"
          tone={qcRows.length > 0 ? 'amber' : 'neutral'}
          onClick={qcRows.length > 0 ? () => router.push(pathname + '?tab=qc') : undefined}
        />
        <KpiCard
          icon={PackageCheck}
          value={completedToday}
          label="Recepciones cerradas"
          sublabel="Completadas o cerradas con diferencia"
          tone="green"
          onClick={() => router.push(pathname + '?tab=putaway')}
        />
      </div>

      <SubNav items={RECEIVING_TABS} defaultValue="ordenes" className="mb-4" />

      {activeTab === 'ordenes' && (
          <TabPanel
            icon={FileText}
            iconClass="text-zinc-500"
            title="Órdenes de compra"
            description="Órdenes confirmadas con el proveedor. Crea una recepción desde una PO para generar el ASN y programar la cita de entrega."
          >
            {poRows.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Sin órdenes de compra"
                description="Las órdenes confirmadas con el proveedor aparecerán aquí."
              />
            ) : (
              <DataTable
                columns={poCols}
                data={filteredPoRows}
                searchColumn="code"
                searchPlaceholder="Buscar por N° orden o proveedor…"
                emptyMessage="Sin órdenes de compra registradas."
                rowClassName={(row: PoRow) =>
                  row.status === 'received' || row.status === 'cancelled'
                    ? 'opacity-50'
                    : ''
                }
                filters={
                  <div className="flex flex-wrap gap-1.5">
                    {PO_STATUS_OPTIONS.map(({ value, label, active }) => (
                      <Button
                        key={value}
                        variant="outline"
                        size="sm"
                        className={cn('h-8 text-xs transition-colors', poStatusFilter.has(value) && active)}
                        onClick={() => handlePoStatusToggle(value)}
                      >
                        {label}
                      </Button>
                    ))}
                    {poStatusFilter.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-8 text-xs"
                        onClick={() => setPoStatusFilter(new Set())}
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>
                }
              />
            )}
          </TabPanel>
      )}

      {activeTab === 'citas' && (
          <TabPanel
            icon={Truck}
            iconClass="text-blue-500"
            title="Llegadas programadas"
            description="ASNs confirmados con el proveedor. Los marcados como «Entrega parcial» ya tienen una recepción previa — el proveedor enviará más mercancía. Inicia una nueva entrega cuando llegue el camión."
          >
            {appointmentRows.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="Sin llegadas programadas"
                description="Todos los avisos están en proceso o completados."
              />
            ) : (
              <DataTable
                columns={appointmentCols}
                data={appointmentRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto o proveedor…"
                emptyMessage="Sin llegadas programadas."
              />
            )}
          </TabPanel>
      )}

      {activeTab === 'recibiendo' && (
          <TabPanel
            icon={PackageCheck}
            iconClass="text-blue-500"
            title="Conteo físico activo"
            description="Camiones actualmente en el muelle. Registra las unidades contadas en esta entrega. Si el proveedor no enviará más, usa «Cerrar ASN con diferencia» para documentar la falta y generar el reporte OTIF."
          >
            {receivingRows.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Sin recepciones activas en el muelle"
                description="Inicia una recepción desde «Llegadas programadas» cuando llegue el camión."
              />
            ) : (
              <DataTable
                columns={receivingCols}
                data={receivingRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto o proveedor…"
                emptyMessage="Sin recepciones activas."
              />
            )}
          </TabPanel>
      )}

      {activeTab === 'qc' && (
          <TabPanel
            icon={ShieldCheck}
            iconClass="text-amber-500"
            title="Inspección de calidad (QC)"
            description="Mercancía bloqueada en zona de calidad. Debe ser aprobada antes de ingresar al inventario disponible."
          >
            {qcRows.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Sin lotes pendientes de inspección"
                description="Los lotes con bandera QC aparecerán aquí al ser recibidos."
              />
            ) : (
              <DataTable
                columns={qcCols}
                data={qcRows}
                searchColumn="productName"
                searchPlaceholder="Buscar…"
                emptyMessage="Sin lotes pendientes de QC."
              />
            )}
          </TabPanel>
      )}

      {activeTab === 'putaway' && (
          <TabPanel
            icon={MapPin}
            iconClass="text-emerald-600"
            title="Ubicación en almacén (Putaway)"
            description="Mercancía lista para ser ubicada. El sistema recomienda la posición óptima según rotación del producto."
          >
            {putawayRows.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Sin mercancía esperando ubicación"
                description="La mercancía recibida y aprobada aparecerá aquí lista para ser ubicada."
              />
            ) : (
              <DataTable
                columns={putawayCols}
                data={putawayRows}
                searchColumn="productName"
                searchPlaceholder="Buscar…"
                emptyMessage="Sin mercancía esperando ubicación."
                rowClassName={(row: AsnRow) =>
                  row.status === 'putaway_done' ? 'opacity-50' : ''
                }
              />
            )}
          </TabPanel>
      )}

      <ReceiveDialog state={receiveDialogState} />
      <CloseAsnDialog state={closeDialogState} />
      <QcDialog state={qcDialogState} />
      <PutawayDialog state={putawayDialogState} />
      <ReceptionSheet state={sheetState} />
    </>
  )
}

export default ReceivingPage
