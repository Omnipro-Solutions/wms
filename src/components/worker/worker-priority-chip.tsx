import { cn } from '@/lib/utils'

type Priority = 'low' | 'medium' | 'high'

const META: Record<Priority, { label: string; className: string }> = {
  high: {
    label: 'Alta',
    className: 'bg-[var(--worker-danger-surface)] text-[var(--worker-danger)]',
  },
  medium: {
    label: 'Media',
    className: 'bg-[var(--worker-warn-surface)] text-[var(--worker-warn)]',
  },
  low: {
    label: 'Baja',
    className: 'bg-muted text-muted-foreground',
  },
}

// Chip de prioridad color-coded (Alta/Media/Baja), estilo cola de trabajo WMS.
export const WorkerPriorityChip = ({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) => {
  const m = META[priority]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase',
        m.className,
        className
      )}
    >
      {m.label}
    </span>
  )
}
