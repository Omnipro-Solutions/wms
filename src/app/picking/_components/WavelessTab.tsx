'use client'

import { CheckCircle2, ClipboardList, Plus, Zap } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TabPanel } from '@/app/receiving/_components/tab-panel'
import { EmptyState } from '@/app/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { WavelessOrder } from '@/types/wms'

interface Props {
  wavelessOrders: WavelessOrder[]
  pendingWlCount: number
  activeWlCount: number
  completedWlCount: number
  wavelessCols: ColumnDef<WavelessOrder>[]
  onAddOrder: () => void
}

export const WavelessTab = ({
  wavelessOrders,
  pendingWlCount,
  activeWlCount,
  completedWlCount,
  wavelessCols,
  onAddOrder,
}: Props) => (
  <TabPanel
    icon={Zap}
    iconClass="text-yellow-500"
    title="Pedidos waveless"
    description="Pedidos VIP o urgentes que se procesan de forma independiente sin esperar a que se forme una oleada."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <KpiCard
        icon={Zap}
        value={pendingWlCount}
        label="Pendientes"
        sublabel="Sin operador asignado"
        tone="amber"
      />
      <KpiCard
        icon={ClipboardList}
        value={activeWlCount}
        label="En progreso"
        sublabel="Operadores activos"
        tone="blue"
      />
      <KpiCard
        icon={CheckCircle2}
        value={completedWlCount}
        label="Completados"
        sublabel="Finalizados hoy"
        tone="green"
      />
    </div>
    <Card className="mb-4 border-yellow-200 bg-yellow-50">
      <CardContent className="flex items-start gap-3 pt-4">
        <Zap className="mt-0.5 size-4 shrink-0 text-yellow-600" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">¿Cuándo usar waveless?</p>
          <p className="mt-1 text-yellow-700">
            Ideal para pedidos VIP, same-day delivery o cualquier pedido urgente que no puede
            esperar a que se forme una oleada.
          </p>
        </div>
      </CardContent>
    </Card>
    {wavelessOrders.length === 0 ? (
      <EmptyState
        icon={Zap}
        title="Sin pedidos waveless"
        description="Agrega pedidos urgentes para procesarlos de forma independiente."
      />
    ) : (
      <DataTable
        columns={wavelessCols}
        data={wavelessOrders}
        searchColumn="orderNumber"
        searchPlaceholder="Buscar pedido…"
        emptyMessage="No hay pedidos waveless."
        actions={
          <Button onClick={onAddOrder}>
            <Plus className="mr-1 size-4" /> Agregar pedido
          </Button>
        }
      />
    )}
    {wavelessOrders.length === 0 && (
      <div className="mt-4 flex justify-end">
        <Button onClick={onAddOrder}>
          <Plus className="mr-1 size-4" /> Agregar pedido
        </Button>
      </div>
    )}
  </TabPanel>
)
