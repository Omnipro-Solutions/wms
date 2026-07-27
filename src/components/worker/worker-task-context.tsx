import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkerPriorityChip } from '@/components/worker/worker-priority-chip'

interface Props {
  /** Documento en curso: código de pedido / ASN / tarea (monoespaciado). */
  code: string
  /** Línea secundaria: producto, cliente o proveedor. */
  meta?: string
  priority?: 'low' | 'medium' | 'high'
  /** Texto de SLA/entrega, p. ej. "Entrega 30/07". */
  due?: string
  /** Progreso de conteo: barra + "current/total unit". */
  progress?: { current: number; total: number; label?: string; unit?: string }
  className?: string
}

// Barra de contexto persistente al estilo Manhattan: el operario siempre ve QUÉ
// documento trabaja, su prioridad/SLA y el progreso — no una serie de pantallas sueltas.
export const WorkerTaskContext = ({ code, meta, priority, due, progress, className }: Props) => {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0
  return (
    <div
      className={cn(
        'border-border bg-card animate-in fade-in-0 slide-in-from-top-1 rounded-xl border p-3 shadow-sm duration-300',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm font-bold tracking-wide">{code}</span>
        {priority && <WorkerPriorityChip priority={priority} />}
      </div>
      {(meta || due) && (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {meta && <span className="text-muted-foreground truncate text-xs">{meta}</span>}
          {due && (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 font-mono text-xs">
              <Clock className="size-3" /> {due}
            </span>
          )}
        </div>
      )}
      {progress && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-semibold tracking-wider uppercase">
            <span className="text-muted-foreground">{progress.label ?? 'Progreso'}</span>
            <span className="text-foreground">
              {progress.current}/{progress.total} {progress.unit}
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
