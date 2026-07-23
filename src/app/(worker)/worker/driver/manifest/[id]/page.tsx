'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ArrowLeft, TriangleAlert } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
        <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <CheckCircle2 className="size-12 text-emerald-500" />
        </div>
        <div>
          <p className="text-2xl font-bold">Ruta completada</p>
          <p className="text-muted-foreground mt-1 text-sm">{manifest.code}</p>
        </div>
        <Button
          variant="outline"
          className="h-14 w-full gap-2 rounded-2xl"
          onClick={() => router.push('/worker/driver')}
        >
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </div>
    )
  }

  const progressPct = (delivered.size / sortedStops.length) * 100

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-linear-to-br from-(--worker-gradient-from) to-(--worker-gradient-to) p-5 text-(--worker-on-gradient)">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold">{manifest.code}</p>
          <span className="text-sm opacity-90">
            {delivered.size}/{sortedStops.length} paradas
          </span>
        </div>
        <Progress value={progressPct} className="mt-3 bg-white/25" />
      </div>

      <div className="flex flex-col gap-2">
        {sortedStops.map((stop, i) => {
          const isDone = delivered.has(stop.id)
          const isCurrent = stop.id === currentStop?.id
          const destination = warehouses.find((w) => w.id === stop.destinationId)

          return (
            <div
              key={stop.id}
              className={cn(
                'relative rounded-2xl border p-4 transition-opacity',
                i > 0 && "before:absolute before:-top-2 before:left-[1.65rem] before:h-2 before:w-0.5 before:bg-border before:content-['']",
                isDone && 'border-emerald-200 bg-emerald-50 opacity-60 dark:bg-emerald-950/20',
                isCurrent && 'border-primary bg-primary/5 shadow-sm',
                !isDone && !isCurrent && 'opacity-40'
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className={cn('size-5', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                )}
                <p className="font-semibold">
                  Parada {stop.sequence} — {destination?.name ?? stop.destinationId}
                </p>
              </div>

              {isCurrent && (
                <div className="mt-3 flex gap-2">
                  <Button
                    className="h-14 flex-1 gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleDeliver(stop.id)}
                  >
                    <CheckCircle2 className="size-4" /> CONFIRMAR ENTREGA
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 flex-1 gap-2 rounded-2xl border-amber-400 text-amber-700 dark:text-amber-400"
                    onClick={() => setNovedadStop(stop.id)}
                  >
                    <TriangleAlert className="size-4" /> NOVEDAD
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
