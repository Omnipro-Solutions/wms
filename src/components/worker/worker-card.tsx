'use client'

import { ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'

interface Props {
  title: string
  subtitle: string
  badge?: string
  urgent?: boolean
  isReturn?: boolean
  onClick: () => void
  className?: string
}

export const WorkerCard = ({
  title,
  subtitle,
  badge,
  urgent,
  isReturn,
  onClick,
  className,
}: Props) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'bg-card active:bg-muted flex w-full items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors dark:bg-transparent',
      urgent && 'border-red-300 bg-red-50 dark:bg-red-950/20',
      isReturn && 'border-orange-300 bg-orange-50 dark:bg-orange-950/20',
      className
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate font-semibold">{title}</p>
        {urgent && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            <AlertTriangle className="size-3" /> URGENTE
          </span>
        )}
        {isReturn && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
            <RotateCcw className="size-3" /> DEVOLUCIÓN
          </span>
        )}
      </div>
      <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
      {badge && (
        <div className="mt-1">
          <StatusBadge status={badge} />
        </div>
      )}
    </div>
    <ChevronRight className="text-muted-foreground shrink-0" />
  </button>
)
