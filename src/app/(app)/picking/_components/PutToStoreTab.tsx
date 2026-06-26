'use client'

import { Building2, CheckCircle2, Package, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { PutToStoreTask } from '@/types/wms'

interface Props {
  putToStoreTasks: PutToStoreTask[]
  pendingPtsCount: number
  activePtsCount: number
  completedPtsCount: number
  totalPtsUnits: number
  putToStoreCols: ColumnDef<PutToStoreTask>[]
  getProductName: (productId: string) => string
}

export const PutToStoreTab = ({
  putToStoreTasks,
  pendingPtsCount,
  activePtsCount,
  completedPtsCount,
  totalPtsUnits,
  putToStoreCols,
  getProductName,
}: Props) => (
  <TabPanel
    icon={Store}
    iconClass="text-teal-500"
    title="Put-to-store"
    description="Se recoge el total de un SKU y luego se distribuye a cada tienda según su cuota. Reduce el tiempo de picking en 40-60% para reposiciones."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <KpiCard
        icon={Store}
        value={pendingPtsCount}
        label="Pendientes"
        sublabel="Sin iniciar"
        tone="amber"
      />
      <KpiCard
        icon={Building2}
        value={activePtsCount}
        label="En distribución"
        sublabel="Asignando a tiendas"
        tone="blue"
      />
      <KpiCard
        icon={CheckCircle2}
        value={completedPtsCount}
        label="Completadas"
        sublabel="Distribución finalizada"
        tone="green"
      />
      <KpiCard
        icon={Package}
        value={totalPtsUnits}
        label="Unidades totales"
        sublabel="Suma de todas las tareas"
        tone="neutral"
      />
    </div>
    <Card className="mb-4 border-teal-200 bg-teal-50">
      <CardContent className="flex items-start gap-3 pt-4">
        <Store className="mt-0.5 size-4 shrink-0 text-teal-600" />
        <div className="text-sm text-teal-800">
          <p className="font-medium">¿Cómo funciona put-to-store?</p>
          <p className="mt-1 text-teal-700">
            Se recoge el total de un SKU (ej: 180 pares de medias) y luego se distribuye a cada
            tienda según su cuota. Reduce el tiempo en 40-60%.
          </p>
        </div>
      </CardContent>
    </Card>
    {putToStoreTasks.length === 0 ? (
      <EmptyState
        icon={Store}
        title="Sin tareas put-to-store"
        description="Las tareas de distribución a tiendas aparecerán aquí al ser generadas."
      />
    ) : (
      <DataTable
        columns={putToStoreCols}
        data={putToStoreTasks}
        searchColumn="code"
        searchPlaceholder="Buscar tarea PTS…"
        emptyMessage="No hay tareas put-to-store registradas."
      />
    )}
    {putToStoreTasks
      .filter((t) => t.status === 'in_progress')
      .map((task) => {
        const totalDistributed = task.allocations.reduce((s, a) => s + a.distributedQuantity, 0)
        const totalRequested = task.allocations.reduce((s, a) => s + a.requestedQuantity, 0)
        const globalPct =
          totalRequested > 0 ? Math.round((totalDistributed / totalRequested) * 100) : 0
        return (
          <Card key={task.id} className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-blue-600" />
                  {task.code} — {getProductName(task.productId)}
                </span>
                <Badge variant="secondary">{globalPct}% distribuido</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={globalPct} className="mb-4 h-2" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {task.allocations.map((alloc) => {
                  const allocPct =
                    alloc.requestedQuantity > 0
                      ? Math.round((alloc.distributedQuantity / alloc.requestedQuantity) * 100)
                      : 0
                  return (
                    <div
                      key={alloc.storeId}
                      className={cn(
                        'space-y-2 rounded-lg border p-3',
                        allocPct === 100 ? 'border-green-300 bg-green-50' : 'border-border'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">{alloc.storeName}</span>
                        {allocPct === 100 && <CheckCircle2 className="size-3 text-green-600" />}
                      </div>
                      <Progress value={allocPct} className="h-1.5" />
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {formatNumber(alloc.distributedQuantity)} /{' '}
                        {formatNumber(alloc.requestedQuantity)} uds
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
  </TabPanel>
)
