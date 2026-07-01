'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

export default function WorkerPackingPage() {
  const router = useRouter()
  const packingOrders = useWmsStore((s) => s.packingOrders)
  const packingRules = useWmsStore((s) => s.packingRules)

  const queue = packingOrders
    .filter((o) => o.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (!queue.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Package className="size-12 text-muted-foreground" />
        <p className="font-semibold">Cola vacía</p>
        <p className="text-sm text-muted-foreground">No hay órdenes para empacar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cola de empaque</h1>
        <span className="text-sm text-muted-foreground">{queue.length} órdenes</span>
      </div>

      <Button className="h-12 text-base" onClick={() => router.push(`/worker/packing/${queue[0].id}`)}>
        ▶ INICIAR SIGUIENTE
      </Button>

      <div className="flex flex-col gap-2">
        {queue.map((order) => {
          const ruleIds = order.appliedRuleIds ?? []
          const ruleLabels = packingRules
            .filter((r) => ruleIds.includes(r.id))
            .map((r) => r.name)
            .join(', ')

          return (
            <WorkerCard
              key={order.id}
              title={order.orderNumber ?? order.id}
              subtitle={`${order.expectedItems} ítems · ${order.customerName}`}
              badge={ruleLabels || undefined}
              onClick={() => router.push(`/worker/packing/${order.id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}
