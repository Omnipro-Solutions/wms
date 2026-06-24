'use client'

import { CheckCircle2, ClipboardList, Layers, Package } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabPanel } from '@/app/receiving/_components/tab-panel'
import { EmptyState } from '@/app/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { BatchTask, CommerceOrder, PickingTask } from '@/types/wms'

interface Props {
  batchTasks: BatchTask[]
  pickingTasks: PickingTask[]
  commerceOrders: CommerceOrder[]
  pendingBatchCount: number
  activeBatchCount: number
  completedBatchCount: number
  totalBatchUnits: number
  batchCols: ColumnDef<BatchTask>[]
}

export const BatchTab = ({
  batchTasks,
  pickingTasks,
  commerceOrders,
  pendingBatchCount,
  activeBatchCount,
  completedBatchCount,
  totalBatchUnits,
  batchCols,
}: Props) => (
  <TabPanel
    icon={Package}
    iconClass="text-blue-500"
    title="Batch picking"
    description="Lotes que agrupan el mismo producto de múltiples pedidos. El picker recoge el total en una visita y distribuye en sorting."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <KpiCard
        icon={Package}
        value={pendingBatchCount}
        label="Pendientes"
        sublabel="Sin iniciar"
        tone="amber"
      />
      <KpiCard
        icon={ClipboardList}
        value={activeBatchCount}
        label="En progreso"
        sublabel="En el muelle"
        tone="blue"
      />
      <KpiCard
        icon={CheckCircle2}
        value={completedBatchCount}
        label="Completadas"
        sublabel="Finalizados"
        tone="green"
      />
      <KpiCard
        icon={Layers}
        value={totalBatchUnits}
        label="Unidades totales"
        sublabel="Suma de todos los lotes"
        tone="neutral"
      />
    </div>
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardContent className="flex items-start gap-3 pt-4">
        <Package className="mt-0.5 size-4 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">¿Cómo funciona el batch picking?</p>
          <p className="mt-1 text-blue-700">
            Cada lote agrupa tareas del mismo producto y ubicación de múltiples pedidos. El picker
            recoge el total en una sola visita y luego distribuye en sorting.
          </p>
        </div>
      </CardContent>
    </Card>
    {batchTasks.length === 0 ? (
      <EmptyState
        icon={Package}
        title="Sin lotes de picking"
        description="Los lotes se generan automáticamente al liberar oleadas con estrategia batch."
      />
    ) : (
      <DataTable
        columns={batchCols}
        data={batchTasks}
        searchColumn="code"
        searchPlaceholder="Buscar lote…"
        emptyMessage="No hay lotes de picking registrados."
      />
    )}
    {batchTasks
      .filter((b) => b.status === 'in_progress')
      .map((batch) => {
        const tasks = pickingTasks.filter((t) => batch.pickingTaskIds.includes(t.id))
        if (tasks.length === 0) return null
        return (
          <Card key={batch.id} className="mt-4">
            <CardContent className="pt-4">
              <p className="mb-3 text-sm font-medium">{batch.code} — Pedidos incluidos</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-right">Solicitado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-semibold">{t.code}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {commerceOrders.find((o) => o.id === t.orderId)?.orderNumber ?? t.orderId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.requestedQuantity}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
  </TabPanel>
)
