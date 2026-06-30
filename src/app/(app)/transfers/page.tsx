'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, Clock, Plus, Truck, Warehouse } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import { buildTransferColumns, type TransferRow } from './columns'
import { TransferDetailSheet } from './_components/transfer-detail-sheet'
import { CreateTransferDialog } from './_components/create-transfer-dialog'

const TERMINAL_STATUSES = new Set(['completed', 'cancelled'])

export default function TransfersPage() {
  const state = useWmsStore()
  const { warehouseName, getProduct } = useStoreHelpers()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const detailSheet = useDialogState<{ id: string }>()
  const createDialog = useDialogState()

  const rows = useMemo<TransferRow[]>(
    () =>
      state.transfers.map((t) => {
        const currentLeg = t.legs[t.currentLegIndex]
        return {
          id: t.id,
          code: t.code,
          type: t.type,
          originName: warehouseName(t.originId),
          destinationName: warehouseName(t.destinationId),
          currentNodeName: currentLeg
            ? warehouseName(currentLeg.destinationId)
            : warehouseName(t.destinationId),
          legsProgress: `${t.currentLegIndex + 1}/${t.legs.length}`,
          isMultiLeg: t.isMultiLeg,
          linesCount: t.items.length,
          estimatedArrivalDate: t.estimatedArrivalDate,
          status: t.status,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.transfers]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        return true
      }),
    [rows, typeFilter, statusFilter]
  )

  const inTransitCount = state.transfers.filter((t) => t.status === 'in_transit').length
  const pendingCount = state.transfers.filter(
    (t) => t.status === 'draft' || t.status === 'pending'
  ).length
  const completedCount = state.transfers.filter((t) => t.status === 'completed').length
  const inTransitWarehouseCount = state.transfers.filter(
    (t) => t.status === 'partial_received'
  ).length
  const multiLegActiveCount = state.transfers.filter(
    (t) => t.isMultiLeg && !TERMINAL_STATUSES.has(t.status)
  ).length

  const handleRowClick = (row: TransferRow) => {
    detailSheet.open({ id: row.id })
  }

  const selectedTransfer = detailSheet.data
    ? state.transfers.find((t) => t.id === detailSheet.data!.id) ?? null
    : null

  const columns = useMemo(() => buildTransferColumns(), [])

  const filtersNode = (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="dc_to_store">DC → Tienda</SelectItem>
          <SelectItem value="store_to_store">Tienda → Tienda</SelectItem>
          <SelectItem value="store_to_dc">Tienda → DC</SelectItem>
          <SelectItem value="dc_to_dc">DC → DC</SelectItem>
          <SelectItem value="multi_leg">Multi-tramo</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En preparación</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="partial_received">Recibido parcial</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traslados"
        description="Movimientos entre bodegas y tiendas. Soporta itinerarios multi-tramo con bodegas transitorias."
        actions={
          <Button size="sm" onClick={() => createDialog.open(undefined)}>
            <Plus className="mr-1.5 size-4" />
            Nuevo traslado
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <KpiCard icon={Truck} value={formatNumber(inTransitCount)} label="En tránsito" tone="blue" />
        <KpiCard
          icon={Clock}
          value={formatNumber(pendingCount)}
          label="Pendientes / preparación"
          tone="amber"
        />
        <KpiCard
          icon={CheckCircle2}
          value={formatNumber(completedCount)}
          label="Completados"
          tone="green"
        />
        <KpiCard
          icon={Warehouse}
          value={formatNumber(inTransitWarehouseCount)}
          label="En bodega transitoria"
          tone={inTransitWarehouseCount > 0 ? 'amber' : 'neutral'}
          sublabel="Esperando re-despacho"
        />
        <KpiCard
          icon={ArrowRightLeft}
          value={formatNumber(multiLegActiveCount)}
          label="Multi-tramo activos"
          tone={multiLegActiveCount > 0 ? 'blue' : 'neutral'}
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="size-4" /> Órdenes de traslado
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="code"
            searchPlaceholder="Buscar código..."
            filters={filtersNode}
            emptyMessage="No hay traslados con los filtros seleccionados."
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      <TransferDetailSheet
        transfer={selectedTransfer}
        originName={selectedTransfer ? warehouseName(selectedTransfer.originId) : ''}
        destinationName={selectedTransfer ? warehouseName(selectedTransfer.destinationId) : ''}
        getProduct={getProduct}
        getWarehouseName={warehouseName}
        open={!!detailSheet.data}
        onClose={detailSheet.close}
      />

      <CreateTransferDialog
        open={!!createDialog.data}
        onClose={createDialog.close}
      />
    </div>
  )
}
