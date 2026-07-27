'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { WorkerPageHeader } from '@/components/worker/worker-page-header'
import { Button } from '@/components/ui/button'
import { Truck, RotateCcw, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

export default function WorkerReceivingPage() {
  const router = useRouter()
  const asnRecords = useWmsStore((s) => s.asnRecords)
  const returnOrders = useWmsStore((s) => s.returnOrders)
  const today = format(new Date(), 'yyyy-MM-dd')

  // Estados en los que el recepcionista aún tiene trabajo: recibir y/o ubicar.
  // 'completed' = recibido completo pero pendiente de putaway → debe seguir visible
  // (antes desaparecía al recibir y no se podía terminar la ubicación desde la lista).
  // Se ocultan putaway_done, cancelled y short_received (ya cerrados).
  const RECEIVING_ACTIVE = ['pending', 'in_progress', 'partial', 'completed']
  // Orden de prioridad para la lista: lo que está a medio procesar arriba.
  const statusRank: Record<string, number> = {
    in_progress: 0,
    completed: 1,
    partial: 2,
    pending: 3,
  }
  const todayAsns = asnRecords
    .filter((a) => RECEIVING_ACTIVE.includes(a.status) && a.appointmentDate <= today)
    .sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9))

  const statusBadge = (status: string) =>
    status === 'in_progress'
      ? 'EN PROGRESO'
      : status === 'partial'
        ? 'PARCIAL'
        : status === 'completed'
          ? 'POR UBICAR'
          : 'PENDIENTE'

  const pendingReturns = returnOrders.filter((r) =>
    ['received_at_store', 'received_at_dc'].includes(r.status)
  )

  if (!todayAsns.length && !pendingReturns.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Truck className="text-muted-foreground size-12" />
        <p className="font-semibold">Sin recepciones hoy</p>
        <p className="text-muted-foreground text-sm">No hay ASNs ni devoluciones pendientes.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkerPageHeader
        title="Recepciones de hoy"
        subtitle={`${todayAsns.length} por procesar`}
        icon={Truck}
      />

      {todayAsns.length > 0 && (
        <>
          <Button
            className="h-14 gap-2 text-base"
            onClick={() => router.push(`/worker/receiving/${todayAsns[0].id}`)}
          >
            Iniciar siguiente <ArrowRight className="size-4" />
          </Button>

          <div className="flex flex-col gap-2">
            {todayAsns.map((asn, i) => (
              <div
                key={asn.id}
                className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 [animation-fill-mode:both]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <WorkerCard
                  icon={Truck}
                  title={asn.code}
                  subtitle={`${asn.supplierName} · ${asn.expectedQuantity} uds`}
                  badge={statusBadge(asn.status)}
                  onClick={() => router.push(`/worker/receiving/${asn.id}`)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {pendingReturns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <RotateCcw className="size-4" /> Devoluciones pendientes
          </h2>
          {pendingReturns.map((ret, i) => (
            <div
              key={ret.id}
              className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 [animation-fill-mode:both]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <WorkerCard
                title={ret.rmaCode}
                subtitle={ret.customerName}
                isReturn
                onClick={() => router.push('/worker/returns')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
