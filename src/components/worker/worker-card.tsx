'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle: string
  badge?: string
  urgent?: boolean
  onClick: () => void
  className?: string
}

export const WorkerCard = ({ title, subtitle, badge, urgent, onClick, className }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors active:bg-muted',
      urgent && 'border-red-300 bg-red-50',
      className
    )}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-semibold truncate">{title}</p>
        {urgent && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            URGENTE
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      {badge && (
        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {badge}
        </span>
      )}
    </div>
    <ChevronRight className="shrink-0 text-muted-foreground" />
  </button>
)
