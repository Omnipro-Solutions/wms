'use client'

import { CheckCircle2, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransferLeg } from '@/types/wms'

interface Props {
  legs: TransferLeg[]
  getWarehouseName: (id: string) => string
  currentLegIndex: number
}

export const TransferItinerary = ({ legs, getWarehouseName, currentLegIndex }: Props) => {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Itinerario
      </h3>
      <div className="space-y-2">
        {legs.map((leg, idx) => {
          const isDone = idx < currentLegIndex
          const isCurrent = idx === currentLegIndex
          const isPending = idx > currentLegIndex

          return (
            <div key={leg.id} className="flex items-start gap-3">
              <div className="mt-1 flex shrink-0">
                {isDone ? (
                  <CheckCircle2 className="text-emerald-600 size-5" />
                ) : isCurrent ? (
                  <CircleDot className="text-blue-600 size-5" />
                ) : (
                  <div className="bg-muted-foreground/20 size-5 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-medium', isDone && 'text-emerald-600', isCurrent && 'text-blue-600')}>
                  Tramo {leg.sequence}
                </div>
                <div className="text-muted-foreground text-xs">
                  {getWarehouseName(leg.originId)} → {getWarehouseName(leg.destinationId)}
                </div>
                {(isDone || isCurrent) && (
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {leg.status === 'pending' && 'Pendiente de despacho'}
                    {leg.status === 'in_transit' && 'En tránsito'}
                    {leg.status === 'received' && 'Recibido'}
                    {leg.status === 'cancelled' && 'Cancelado'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
