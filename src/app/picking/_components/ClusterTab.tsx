'use client'

import { CheckCircle2, ClipboardList, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clusterProgress } from '@/lib/rules/picking'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TabPanel } from '@/app/receiving/_components/tab-panel'
import { EmptyState } from '@/app/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { ClusterTask } from '@/types/wms'

interface Props {
  clusterTasks: ClusterTask[]
  pendingClusterCount: number
  activeClusterCount: number
  completedClusterCount: number
  clusterCols: ColumnDef<ClusterTask>[]
  getProductName: (productId: string) => string
}

export const ClusterTab = ({
  clusterTasks,
  pendingClusterCount,
  activeClusterCount,
  completedClusterCount,
  clusterCols,
  getProductName,
}: Props) => (
  <TabPanel
    icon={ShoppingCart}
    iconClass="text-purple-500"
    title="Cluster picking"
    description="El picker sale con un carrito con N contenedores. Al llegar a cada ubicación deposita las unidades en el contenedor correcto."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <KpiCard
        icon={ShoppingCart}
        value={pendingClusterCount}
        label="Clusters pendientes"
        sublabel="Sin iniciar"
        tone="amber"
      />
      <KpiCard
        icon={ClipboardList}
        value={activeClusterCount}
        label="En progreso"
        sublabel="Operadores activos"
        tone="blue"
      />
      <KpiCard
        icon={CheckCircle2}
        value={completedClusterCount}
        label="Completados"
        sublabel="Clusters finalizados"
        tone="green"
      />
    </div>
    <Card className="mb-4 border-purple-200 bg-purple-50">
      <CardContent className="flex items-start gap-3 pt-4">
        <ShoppingCart className="mt-0.5 size-4 shrink-0 text-purple-600" />
        <div className="text-sm text-purple-800">
          <p className="font-medium">¿Cómo funciona el cluster picking?</p>
          <p className="mt-1 text-purple-700">
            El picker sale con un carrito con N contenedores (uno por pedido). Al llegar a cada
            ubicación deposita las unidades en el contenedor correcto.
          </p>
        </div>
      </CardContent>
    </Card>
    {clusterTasks.length === 0 ? (
      <EmptyState
        icon={ShoppingCart}
        title="Sin clusters registrados"
        description="Los clusters se generan al liberar oleadas con estrategia de cluster picking."
      />
    ) : (
      <DataTable
        columns={clusterCols}
        data={clusterTasks}
        searchColumn="code"
        searchPlaceholder="Buscar cluster…"
        emptyMessage="No hay clusters registrados."
      />
    )}
    {clusterTasks
      .filter((c) => c.status === 'in_progress')
      .map((cluster) => (
        <Card key={cluster.id} className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-blue-600" />
                {cluster.code} — {cluster.operatorName ?? 'Sin operador'}
              </span>
              <Badge variant="secondary">{clusterProgress(cluster)}% completado</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cluster.slots.map((slot) => {
                const slotTotal = slot.items.reduce((s, i) => s + i.requested, 0)
                const slotDeposited = slot.items.reduce((s, i) => s + i.deposited, 0)
                const slotPct = slotTotal > 0 ? Math.round((slotDeposited / slotTotal) * 100) : 0
                return (
                  <div
                    key={slot.orderId}
                    className={cn(
                      'space-y-2 rounded-lg border p-3',
                      slot.completed ? 'border-green-300 bg-green-50' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{slot.containerLabel}</span>
                      <Badge variant="outline" className="text-xs">
                        {slot.orderNumber}
                      </Badge>
                    </div>
                    <Progress value={slotPct} className="h-1.5" />
                    <div className="space-y-1">
                      {slot.items.map((item) => (
                        <div key={item.productId} className="flex justify-between text-xs">
                          <span className="text-muted-foreground max-w-30 truncate">
                            {getProductName(item.productId)}
                          </span>
                          <span
                            className={cn(
                              'font-medium tabular-nums',
                              item.deposited >= item.requested && 'text-green-700'
                            )}
                          >
                            {item.deposited}/{item.requested}
                          </span>
                        </div>
                      ))}
                    </div>
                    {slot.completed && (
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="size-3" /> Contenedor completo
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
  </TabPanel>
)
