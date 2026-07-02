'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Truck, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'

export default function WorkerReceivingPage() {
  const router = useRouter()
  const asnRecords = useWmsStore((s) => s.asnRecords)
  const returnOrders = useWmsStore((s) => s.returnOrders)
  const today = format(new Date(), 'yyyy-MM-dd')

  const todayAsns = asnRecords
    .filter(
      (a) => ['pending', 'in_progress'].includes(a.status) && a.appointmentDate <= today
    )
    .sort((a, b) => (b.status === 'in_progress' ? 1 : 0) - (a.status === 'in_progress' ? 1 : 0))

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
    <div className="flex flex-col gap-6">
      {todayAsns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">Recepciones de hoy</h1>
          {todayAsns.map((asn) => (
            <WorkerCard
              key={asn.id}
              title={asn.code}
              subtitle={`${asn.supplierName} · ${asn.expectedQuantity} uds`}
              badge={asn.status === 'in_progress' ? 'EN PROGRESO' : 'PENDIENTE'}
              onClick={() => router.push(`/worker/receiving/${asn.id}`)}
            />
          ))}
        </div>
      )}

      {pendingReturns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <RotateCcw className="size-4" /> Devoluciones pendientes
          </h2>
          {pendingReturns.map((ret) => (
            <WorkerCard
              key={ret.id}
              title={ret.rmaCode}
              subtitle={ret.customerName}
              isReturn
              onClick={() => router.push('/worker/returns')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
