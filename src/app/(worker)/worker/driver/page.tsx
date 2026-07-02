'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowRightLeft, CheckCircle2 } from 'lucide-react'

export default function WorkerDriverPage() {
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const loadManifests = useWmsStore((s) => s.loadManifests)
  const transfers = useWmsStore((s) => s.transfers)
  const advanceTransfer = useWmsStore((s) => s.advanceTransfer)

  const myManifests = loadManifests
    .filter((m) => m.assignedDriverId === operator?.id)
    .sort((a, b) => (b.status === 'in_progress' ? 1 : 0) - (a.status === 'in_progress' ? 1 : 0))

  const myTransfers = transfers.filter(
    (t) => t.assignedDriverId === operator?.id && t.status === 'in_transit'
  )

  const opName = operator?.name ?? 'Conductor'

  const handleConfirmArrival = (transferId: string) => {
    advanceTransfer(transferId, opName)
  }

  if (!myManifests.length && !myTransfers.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="bg-muted flex size-16 items-center justify-center rounded-full">
          <Truck className="text-muted-foreground size-8" />
        </div>
        <p className="font-semibold">Sin asignaciones hoy</p>
        <p className="text-muted-foreground text-sm">
          No tienes manifiestos ni transferencias asignadas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {myManifests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <Truck className="size-4" /> Manifiestos
          </h2>
          {myManifests.map((m) => (
            <WorkerCard
              key={m.id}
              title={m.code}
              subtitle={`${m.stops.length} paradas · ${m.carrierName}`}
              badge={m.status}
              onClick={() => router.push(`/worker/driver/manifest/${m.id}`)}
            />
          ))}
        </section>
      )}

      {myTransfers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <ArrowRightLeft className="size-4" /> Transferencias
          </h2>
          {myTransfers.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <WorkerCard
                title={t.code}
                subtitle={`${t.originId} → ${t.destinationId}`}
                badge="in_transit"
                onClick={() => {}}
              />
              <Button
                className="h-12 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => handleConfirmArrival(t.id)}
              >
                <CheckCircle2 className="size-4" /> CONFIRMAR LLEGADA
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
