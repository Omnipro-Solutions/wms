'use client'

import { Layers, Package, Plus, Waves } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { CommerceOrder, PickingTask, PickingWave } from '@/types/wms'

interface Props {
  pickingWaves: PickingWave[]
  commerceOrders: CommerceOrder[]
  pickingTasks: PickingTask[]
  activeWaveCount: number
  draftWaveCount: number
  waveActiveUnits: number
  waveCols: ColumnDef<PickingWave>[]
  onCreateWave: () => void
}

export const WavesTab = ({
  pickingWaves,
  commerceOrders,
  pickingTasks,
  activeWaveCount,
  draftWaveCount,
  waveActiveUnits,
  waveCols,
  onCreateWave,
}: Props) => (
  <TabPanel
    icon={Waves}
    iconClass="text-blue-500"
    title="Oleadas de picking"
    description="Agrupa pedidos en oleadas para optimizar rutas. Libera una oleada para habilitar las tareas asociadas."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <KpiCard
        icon={Waves}
        value={activeWaveCount}
        label="Oleadas activas"
        sublabel="En progreso ahora"
        tone="blue"
      />
      <KpiCard
        icon={Layers}
        value={draftWaveCount}
        label="En borrador"
        sublabel="Pendientes de liberar"
        tone="amber"
      />
      <KpiCard
        icon={Package}
        value={waveActiveUnits}
        label="Unidades en oleadas activas"
        sublabel="Suma de todas en progreso"
        tone="neutral"
      />
    </div>
    {pickingWaves.length === 0 ? (
      <EmptyState
        icon={Waves}
        title="Sin oleadas registradas"
        description="Crea una oleada para agrupar pedidos pendientes y optimizar el picking."
      />
    ) : (
      <DataTable
        columns={waveCols}
        data={pickingWaves}
        searchColumn="name"
        searchPlaceholder="Buscar oleada…"
        emptyMessage="No hay oleadas registradas."
        actions={
          <Button onClick={onCreateWave}>
            <Plus className="mr-1 size-4" /> Nueva oleada
          </Button>
        }
      />
    )}
    {pickingWaves.length > 0 && (
      <div className="mt-4 flex justify-end">
        <Button onClick={onCreateWave}>
          <Plus className="mr-1 size-4" /> Nueva oleada
        </Button>
      </div>
    )}

    {pickingWaves
      .filter((w) => w.status === 'in_progress')
      .map((wave) => (
        <Card key={wave.id} className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Waves className="size-4 text-blue-600" />
              {wave.code} — {wave.name}
              <Badge variant="secondary" className="ml-2">
                En progreso
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Picker asignado</TableHead>
                  <TableHead className="text-right">Líneas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wave.orderIds.map((oid) => {
                  const order = commerceOrders.find((o) => o.id === oid)
                  if (!order) return null
                  const operatorNames = Array.from(
                    new Set(
                      pickingTasks
                        .filter((t) => t.orderId === oid && t.operatorName)
                        .map((t) => t.operatorName as string),
                    ),
                  )
                  return (
                    <TableRow key={oid}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="text-sm">{order.customerName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm capitalize">
                        {order.channel}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {operatorNames.length > 0 ? (
                          operatorNames.join(', ')
                        ) : (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {order.items.length}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
  </TabPanel>
)
