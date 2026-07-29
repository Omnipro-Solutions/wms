'use client'

import { ChevronRight, RotateCcw, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { WorkerPriorityChip } from '@/components/worker/worker-priority-chip'

interface Props {
  title: string
  subtitle: string
  badge?: string
  priority?: 'low' | 'medium' | 'high'
  isReturn?: boolean
  icon?: LucideIcon
  onClick: () => void
  className?: string
}

// Tile de lista, estilo cola de trabajo WMS: superficie sólida, barra de acento a la
// izquierda por prioridad (rojo alta / ámbar media / azul baja) y chip de prioridad.
export const WorkerCard = ({
  title,
  subtitle,
  badge,
  priority,
  isReturn,
  icon: Icon,
  onClick,
  className,
}: Props) => {
  const accent =
    priority === 'high'
      ? 'border-l-[var(--worker-danger)]'
      : priority === 'medium'
        ? 'border-l-[var(--worker-warn)]'
        : isReturn
          ? 'border-l-[var(--worker-warn)]'
          : 'border-l-primary'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-card active:bg-muted flex w-full items-center gap-3 rounded-xl border border-l-4 p-4 text-left shadow-sm transition active:scale-[0.99]',
        accent,
        className
      )}
    >
      {Icon && (
        <span className="bg-[var(--worker-info-surface)] text-[var(--worker-info)] flex size-10 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold tracking-tight">{title}</p>
          {priority && <WorkerPriorityChip priority={priority} />}
          {isReturn && (
            <span className="flex shrink-0 items-center gap-1 rounded-sm bg-[var(--worker-warn-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[var(--worker-warn)] uppercase">
              <RotateCcw className="size-3" /> Devolución
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate font-mono text-xs tracking-wide">{subtitle}</p>
        {badge && (
          <div className="mt-1.5">
            <StatusBadge status={badge} />
          </div>
        )}
      </div>
      <ChevronRight className="text-muted-foreground shrink-0" />
    </button>
  )
}
