'use client'

import { Check, ArrowRight, Clock, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/shared/status-badge'
import type { TransferLeg } from '@/types/wms'

interface Props {
  legs: TransferLeg[]
  getWarehouseName: (id: string) => string
  currentLegIndex: number
}

export const TransferItinerary = ({ legs, getWarehouseName, currentLegIndex }: Props) => {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Itinerario ({legs.length} {legs.length === 1 ? 'tramo' : 'tramos'})
      </h3>

      {/* Node dots timeline */}
      <div className="flex items-start">
        {legs.map((leg, i) => {
          const isReceived = leg.status === 'received'
          const isActive = i === currentLegIndex && leg.status === 'in_transit'
          const isPending = leg.status === 'pending'
          const isLast = i === legs.length - 1

          return (
            <div key={leg.id} className="flex flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                {/* Origin node */}
                <div
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                    isReceived && 'border-emerald-500 bg-emerald-500 text-white',
                    isActive && 'border-amber-500 bg-amber-500 text-white',
                    isPending && 'border-zinc-300 bg-white text-zinc-400'
                  )}
                >
                  {isReceived ? <Check className="size-3" /> : isActive ? <Truck className="size-3" /> : <Clock className="size-3" />}
                </div>
                {/* Connector line */}
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    isReceived ? 'bg-emerald-400' : isActive ? 'bg-amber-300' : 'bg-zinc-200'
                  )}
                />
                {/* Destination node (only for last leg) */}
                {isLast && (
                  <div
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                      leg.status === 'received' && 'border-emerald-500 bg-emerald-500 text-white',
                      leg.status !== 'received' && 'border-zinc-300 bg-white text-zinc-400'
                    )}
                  >
                    {leg.status === 'received' ? <Check className="size-3" /> : <Clock className="size-3" />}
                  </div>
                )}
              </div>
              {/* Origin label */}
              <p className={cn(
                'mt-1 text-[10px] leading-tight max-w-[80px]',
                isActive ? 'font-semibold text-amber-600' : 'text-muted-foreground'
              )}>
                {getWarehouseName(leg.originId)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Last destination label */}
      <p className="text-muted-foreground text-[10px]">
        → {getWarehouseName(legs[legs.length - 1]?.destinationId ?? '')}
      </p>

      {/* Leg detail rows */}
      <div className="space-y-2">
        {legs.map((leg, i) => (
          <div
            key={leg.id}
            className={cn(
              'rounded-md border p-3 text-sm',
              i === currentLegIndex && leg.status !== 'received' && 'border-amber-200 bg-amber-50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-muted-foreground text-xs">Tramo {leg.sequence}</span>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="text-xs">{getWarehouseName(leg.originId)}</span>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="text-xs">{getWarehouseName(leg.destinationId)}</span>
              </div>
              <StatusBadge status={leg.status} />
            </div>
            <div className="text-muted-foreground mt-1 flex gap-4 text-[11px]">
              <span>ETA: {formatDate(leg.estimatedArrivalDate)}</span>
              {leg.dispatchedAt && <span>Despachado: {formatDate(leg.dispatchedAt)}</span>}
              {leg.receivedAt && <span>Recibido: {formatDate(leg.receivedAt)}</span>}
              {leg.operatorName && <span>Op: {leg.operatorName}</span>}
            </div>
            {leg.notes && (
              <p className="text-muted-foreground mt-1 text-[11px] italic">{leg.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
