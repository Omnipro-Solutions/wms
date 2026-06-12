import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icon: LucideIcon
  value: number
  label: string
  sublabel?: string
  tone: 'blue' | 'red' | 'amber' | 'green' | 'neutral'
  alert?: boolean
  onClick?: () => void
}

const TONE_STYLES: Record<
  KpiCardProps['tone'],
  { bg: string; icon: string; value: string; ring: string }
> = {
  blue: {
    bg: 'bg-blue-50 border-blue-100',
    icon: 'text-blue-500',
    value: 'text-blue-700',
    ring: 'hover:ring-2 hover:ring-blue-300',
  },
  red: {
    bg: 'bg-red-50 border-red-100',
    icon: 'text-red-500',
    value: 'text-red-700',
    ring: 'hover:ring-2 hover:ring-red-300',
  },
  amber: {
    bg: 'bg-amber-50 border-amber-100',
    icon: 'text-amber-500',
    value: 'text-amber-700',
    ring: 'hover:ring-2 hover:ring-amber-300',
  },
  green: {
    bg: 'bg-emerald-50 border-emerald-100',
    icon: 'text-emerald-500',
    value: 'text-emerald-700',
    ring: 'hover:ring-2 hover:ring-emerald-300',
  },
  neutral: {
    bg: 'bg-zinc-50 border-zinc-100',
    icon: 'text-zinc-400',
    value: 'text-zinc-600',
    ring: 'hover:ring-2 hover:ring-zinc-300',
  },
}

export const KpiCard = ({ icon: Icon, value, label, sublabel, tone, alert, onClick }: KpiCardProps) => {
  const styles = TONE_STYLES[tone]
  const isClickable = !!onClick

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? label : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      className={cn(
        'relative flex items-center gap-4 rounded-xl border p-4 transition-all',
        styles.bg,
        isClickable && cn('cursor-pointer', styles.ring)
      )}
    >
      {alert && value > 0 && (
        <span className="absolute top-3 right-3 flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
      )}
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm',
          styles.bg
        )}
      >
        <Icon className={cn('size-7', styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-2xl leading-none font-bold tabular-nums', styles.value)}>{value}</p>
        <p className="text-foreground mt-1 text-sm font-medium">{label}</p>
        {sublabel && <p className="text-muted-foreground text-xs">{sublabel}</p>}
      </div>
      {isClickable && (
        <ChevronRight className={cn('size-4 shrink-0 opacity-40', styles.icon)} />
      )}
    </div>
  )
}
