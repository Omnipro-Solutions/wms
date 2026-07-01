'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

export default function WorkerPickingPage() {
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const pickingTasks = useWmsStore((s) => s.pickingTasks)
  const locations = useWmsStore((s) => s.locations)
  const { getProduct } = useStoreHelpers()
  const getLocation = (id: string) => locations.find((l) => l.id === id)

  const myTasks = pickingTasks
    .filter(
      (t) =>
        t.assignedOperatorId === operator?.id &&
        ['pending', 'assigned', 'in_progress'].includes(t.status)
    )
    .sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 }
      return pri[a.priority] - pri[b.priority]
    })

  if (!myTasks.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ClipboardList className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin tareas pendientes</p>
        <p className="text-sm text-muted-foreground">No tienes tareas asignadas por el momento.</p>
      </div>
    )
  }

  const next = myTasks[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mis tareas</h1>
        <span className="text-sm text-muted-foreground">{myTasks.length} pendientes</span>
      </div>

      <Button
        className="h-12 text-base"
        onClick={() => router.push(`/worker/picking/task/${next.id}`)}
      >
        ▶ INICIAR SIGUIENTE TAREA
      </Button>

      <div className="flex flex-col gap-2">
        {myTasks.map((task) => {
          const product = getProduct(task.productId)
          const location = getLocation(task.locationId)
          return (
            <WorkerCard
              key={task.id}
              title={product?.name ?? task.productId}
              subtitle={`${location?.zone ?? '—'} · ${location?.code ?? '—'} · ×${task.requestedQuantity}`}
              badge={task.code}
              urgent={task.priority === 'high'}
              onClick={() => router.push(`/worker/picking/task/${task.id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}
