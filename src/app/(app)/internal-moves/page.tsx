'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Layers, Package, Plus, Shuffle, Truck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import {
  selectInternalMoveQueue,
  selectConsolidationOpportunities,
} from '@/store/selectors'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNumber } from '@/lib/formatters'
import { buildInternalMoveColumns, type InternalMoveRow } from './columns'
import { CreateMoveDialog, type CreateMoveInitial } from './_components/create-move-dialog'

const InternalMovesPage = () => {
  const state = useWmsStore()
  const { getProduct, locationCode, warehouseName } = useStoreHelpers()

  const [tab, setTab] = useState('queue')
  const [actionError, setActionError] = useState('')
  const createDialog = useDialogState<CreateMoveInitial>()

  const reasonLabel = (id?: string) =>
    id ? state.reasons.find((r) => r.id === id)?.label : undefined

  const toRow = (t: (typeof state.internalMoves)[number]): InternalMoveRow => {
    const product = getProduct(t.productId)
    return {
      id: t.id,
      code: t.code,
      moveType: t.moveType,
      productName: product?.name ?? t.productId,
      productSku: product?.sku ?? '—',
      fromCode: locationCode(t.fromLocationId),
      toCode: locationCode(t.toLocationId),
      quantity: t.quantity,
      status: t.status,
      operatorName: t.operatorName,
      reasonLabel: reasonLabel(t.reasonId),
    }
  }

  const queue = useMemo(() => selectInternalMoveQueue(state), [state])
  const opportunities = useMemo(() => selectConsolidationOpportunities(state), [state])

  const queueRows = useMemo(() => queue.map(toRow), [queue])
  const historyRows = useMemo(
    () =>
      state.internalMoves
        .filter((t) => t.status === 'dropped' || t.status === 'cancelled')
        .slice()
        .sort((a, b) => (b.droppedAt ?? b.createdAt).localeCompare(a.droppedAt ?? a.createdAt))
        .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.internalMoves]
  )

  const inQueueCount = queue.filter((t) => t.status === 'pending' || t.status === 'assigned').length
  const inMotionCount = queue.filter((t) => t.status === 'picked').length
  const completedCount = state.internalMoves.filter((t) => t.status === 'dropped').length

  // Envuelve cada acción de la FSM: limpia el error al éxito, lo muestra al fallo.
  const run = (fn: () => void) => {
    try {
      setActionError('')
      fn()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Error al ejecutar la acción')
    }
  }

  const handlers = {
    onAssign: (id: string) => run(() => state.assignMove(id, 'Supervisor')),
    onPick: (id: string) => run(() => state.confirmPickFromSource(id)),
    onDrop: (id: string) => run(() => state.confirmDropToDest(id)),
    onCancel: (id: string) => run(() => state.cancelMove(id)),
  }

  const queueColumns = useMemo(() => buildInternalMoveColumns(handlers), [])
  const historyColumns = useMemo(() => buildInternalMoveColumns(), [])

  const consolidationReasonId = state.reasons.find((r) => r.code === 'MI-CONSOL')?.id

  const startConsolidation = (opp: (typeof opportunities)[number]) => {
    // Mueve el stock de la ubicación con menos unidades hacia la que ya concentra más.
    const source = opp.locations[opp.locations.length - 1]
    createDialog.open({
      moveType: 'consolidation',
      warehouseId: opp.warehouseId,
      productId: opp.productId,
      fromLocationId: source.locationId,
      toLocationId: opp.targetLocationId,
      quantity: source.quantity,
      reasonId: consolidationReasonId,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Movimientos internos"
        description="Reubicaciones dentro de una misma bodega. Cola de tareas con confirmación en dos pasos: recoger en origen, depositar en destino."
        actions={
          <Button size="sm" onClick={() => createDialog.open({})}>
            <Plus className="mr-1.5 size-4" />
            Nuevo movimiento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          icon={Shuffle}
          value={formatNumber(inQueueCount)}
          label="En cola"
          tone={inQueueCount > 0 ? 'amber' : 'neutral'}
          sublabel="Pendientes / asignadas"
        />
        <KpiCard
          icon={Truck}
          value={formatNumber(inMotionCount)}
          label="En movimiento"
          tone={inMotionCount > 0 ? 'blue' : 'neutral'}
          sublabel="Recogidas, sin depositar"
        />
        <KpiCard
          icon={CheckCircle2}
          value={formatNumber(completedCount)}
          label="Depositadas"
          tone="green"
        />
        <KpiCard
          icon={Layers}
          value={formatNumber(opportunities.length)}
          label="Oportunidades consolidación"
          tone={opportunities.length > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {actionError && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {actionError}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="queue">Cola ({queue.length})</TabsTrigger>
          <TabsTrigger value="consolidation">Consolidación ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="history">Historial ({historyRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-base font-semibold">
                <Shuffle className="size-4" /> Cola de movimientos internos
              </div>
              <DataTable
                columns={queueColumns}
                data={queueRows}
                searchColumn="code"
                searchPlaceholder="Buscar código..."
                emptyMessage="No hay movimientos internos activos en la cola."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consolidation">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Layers className="size-4" /> Oportunidades de consolidación
              </div>
              <p className="text-muted-foreground text-sm">
                Mismo SKU disperso en 2+ ubicaciones de picking dentro de una bodega. Consolidarlo en
                una sola posición libera huecos y acorta los recorridos de picking.
              </p>

              {opportunities.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No hay stock disperso: cada SKU ocupa una sola ubicación de picking por bodega.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {opportunities.map((opp) => {
                  const product = getProduct(opp.productId)
                  return (
                    <div
                      key={`${opp.warehouseId}-${opp.productId}`}
                      className="flex flex-col gap-2 rounded-md border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="text-muted-foreground size-4 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{product?.name ?? opp.productId}</p>
                            <p className="text-muted-foreground text-xs">
                              {warehouseName(opp.warehouseId)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {opp.sourceCount} ubicaciones
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {opp.locations.map((l, i) => (
                          <span key={l.locationId} className="flex items-center gap-1.5">
                            <span
                              className={
                                l.locationId === opp.targetLocationId
                                  ? 'bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium'
                                  : 'bg-muted rounded px-1.5 py-0.5'
                              }
                            >
                              {locationCode(l.locationId)} · {l.quantity}
                            </span>
                            {i < opp.locations.length - 1 && (
                              <span className="text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">
                          Total <span className="text-foreground font-medium">{opp.totalQuantity}</span>{' '}
                          uds → <span className="text-foreground font-medium">{locationCode(opp.targetLocationId)}</span>
                        </p>
                        <Button size="sm" variant="outline" onClick={() => startConsolidation(opp)}>
                          <ArrowRight className="mr-1 size-3.5" />
                          Consolidar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="size-4" /> Historial de movimientos
              </div>
              <DataTable
                columns={historyColumns}
                data={historyRows}
                searchColumn="code"
                searchPlaceholder="Buscar código..."
                emptyMessage="Aún no hay movimientos internos depositados o cancelados."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateMoveDialog
        open={createDialog.data !== null}
        onClose={createDialog.close}
        initial={createDialog.data ?? undefined}
      />
    </div>
  )
}

export default InternalMovesPage
