'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { WorkerPageHeader } from '@/components/worker/worker-page-header'
import { Button } from '@/components/ui/button'
import { Package, ArrowRight } from 'lucide-react'

export default function WorkerPackingPage() {
  const router = useRouter()
  const packingOrders = useWmsStore((s) => s.packingOrders)
  const packingRules = useWmsStore((s) => s.packingRules)

  // Órdenes que el empacador aún tiene que trabajar: sin empezar y en progreso.
  // 'in_progress' debe seguir visible — antes desaparecía al iniciar el empaque y no
  // se podía retomar desde la cola (no se elimina: solo cambió de estado).
  const queue = packingOrders
    .filter((o) => o.status === 'pending' || o.status === 'in_progress')
    .sort((a, b) => {
      // En progreso primero (para retomar), luego por antigüedad.
      const rank = (s: string) => (s === 'in_progress' ? 0 : 1)
      const r = rank(a.status) - rank(b.status)
      return r !== 0 ? r : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

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
      <WorkerPageHeader title="Cola de empaque" subtitle={`${queue.length} órdenes`} icon={Package} />

      <Button className="h-14 gap-2 text-base" onClick={() => router.push(`/worker/packing/${queue[0].id}`)}>
        Iniciar siguiente <ArrowRight className="size-4" />
      </Button>

      <div className="flex flex-col gap-2">
        {queue.map((order, i) => {
          const ruleIds = order.appliedRuleIds ?? []
          // ruleLabels se pasa como `badge` — es una etiqueta de manejo (frágil, pesado…), no un
          // estado de ciclo de vida; StatusBadge la muestra como pill neutro cuando no matchea STATUS_MAP.
          const ruleLabels = packingRules
            .filter((r) => ruleIds.includes(r.id))
            .map((r) => r.name)
            .join(', ')

          return (
            <div
              key={order.id}
              className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 [animation-fill-mode:both]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <WorkerCard
                icon={Package}
                title={order.orderNumber ?? order.id}
                subtitle={`${order.expectedItems} ítems · ${order.customerName}`}
                badge={order.status === 'in_progress' ? 'EN PROGRESO' : ruleLabels || undefined}
                onClick={() => router.push(`/worker/packing/${order.id}`)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
