'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Truck } from 'lucide-react'
import { format } from 'date-fns'

export default function WorkerReceivingPage() {
  const router = useRouter()
  const asnRecords = useWmsStore((s) => s.asnRecords)
  const today = format(new Date(), 'yyyy-MM-dd')

  const todayAsns = asnRecords
    .filter(
      (a) =>
        ['pending', 'in_progress'].includes(a.status) &&
        a.appointmentDate.startsWith(today)
    )
    .sort((a) => (a.status === 'in_progress' ? -1 : 1))

  if (!todayAsns.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Truck className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin recepciones hoy</p>
        <p className="text-sm text-muted-foreground">No hay ASNs programados para hoy.</p>
        <Button variant="outline" asChild className="mt-2">
          <Link href="/receiving">🖥 Vista completa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Recepciones de hoy</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/receiving">🖥 Vista completa</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
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
    </div>
  )
}
