'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const NOVEDAD_TYPES = [
  'Bulto faltante',
  'Rechazado por cliente',
  'Dirección incorrecta',
  'Otro',
]

export default function WorkerManifestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { loadManifests, warehouses, closeManifest } = useWmsStore()

  const manifest = loadManifests.find((m) => m.id === id)

  const [delivered, setDelivered] = useState<Set<string>>(new Set())
  const [novedadStop, setNovedadStop] = useState<string | null>(null)
  const [novedadType, setNovedadType] = useState('')
  const [novedadNote, setNovedadNote] = useState('')

  if (!manifest) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Manifiesto no encontrado.</p>
      </div>
    )
  }

  const sortedStops = [...manifest.stops].sort((a, b) => a.sequence - b.sequence)
  const currentStop = sortedStops.find((s) => !delivered.has(s.id))
  const allDone = sortedStops.every((s) => delivered.has(s.id))

  const handleDeliver = (stopId: string) => {
    const next = new Set(delivered)
    next.add(stopId)
    setDelivered(next)
    if (sortedStops.every((s) => next.has(s.id))) {
      closeManifest(manifest.id)
    }
  }

  const handleNovedad = () => {
    handleDeliver(novedadStop!)
    setNovedadStop(null)
    setNovedadType('')
    setNovedadNote('')
  }

  if (allDone) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">Ruta completada</p>
          <p className="text-sm text-muted-foreground mt-1">{manifest.code}</p>
        </div>
        <Button className="h-12 w-full" onClick={() => router.push('/worker/driver')}>
          ← Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{manifest.code}</h1>
        <span className="text-sm text-muted-foreground">
          {delivered.size}/{sortedStops.length} paradas
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sortedStops.map((stop) => {
          const isDone = delivered.has(stop.id)
          const isCurrent = stop.id === currentStop?.id
          const destination = warehouses.find((w) => w.id === stop.destinationId)

          return (
            <div
              key={stop.id}
              className={cn(
                'rounded-xl border p-4',
                isDone && 'border-emerald-200 bg-emerald-50 opacity-60',
                isCurrent && 'border-primary bg-primary/5',
                !isDone && !isCurrent && 'opacity-40'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {isDone ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <p className="font-semibold">
                  Parada {stop.sequence} — {destination?.name ?? stop.destinationId}
                </p>
              </div>

              {isCurrent && (
                <div className="flex gap-2 mt-3">
                  <Button
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleDeliver(stop.id)}
                  >
                    ✅ CONFIRMAR ENTREGA
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border-amber-400 text-amber-700"
                    onClick={() => setNovedadStop(stop.id)}
                  >
                    ⚠ NOVEDAD
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!novedadStop} onOpenChange={(open) => { if (!open) setNovedadStop(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar novedad</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {NOVEDAD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNovedadType(type)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors',
                  novedadType === type && 'border-primary bg-primary/5 font-medium'
                )}
              >
                {type}
              </button>
            ))}
            <Textarea
              placeholder="Notas adicionales..."
              value={novedadNote}
              onChange={(e) => setNovedadNote(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <Button className="h-12" disabled={!novedadType} onClick={handleNovedad}>
              REGISTRAR NOVEDAD
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
