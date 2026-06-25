import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icon: LucideIcon
  value: number | string
  label: string
  sublabel?: string
  tone: 'blue' | 'red' | 'amber' | 'green' | 'neutral'
  alert?: boolean
  onClick?: () => void
}

const TONE_STYLES: Record<
  KpiCardProps['tone'],
  { bg: string; icon: string; value: string; ring: string; iconBg: string; iconBorder: string }
> = {
  blue: {
    bg: 'bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/50',
    icon: 'text-blue-500 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    ring: 'hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700',
    iconBg: 'bg-blue-100/80 dark:bg-blue-900/50',
    iconBorder: 'border-blue-200 dark:border-blue-800/60',
  },
  red: {
    bg: 'bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900/50',
    icon: 'text-red-500 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
    ring: 'hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700',
    iconBg: 'bg-red-100/80 dark:bg-red-900/50',
    iconBorder: 'border-red-200 dark:border-red-800/60',
  },
  amber: {
    bg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/50',
    icon: 'text-amber-500 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
    ring: 'hover:ring-2 hover:ring-amber-300 dark:hover:ring-amber-700',
    iconBg: 'bg-amber-100/80 dark:bg-amber-900/50',
    iconBorder: 'border-amber-200 dark:border-amber-800/60',
  },
  green: {
    bg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
    ring: 'hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-700',
    iconBg: 'bg-emerald-100/80 dark:bg-emerald-900/50',
    iconBorder: 'border-emerald-200 dark:border-emerald-800/60',
  },
  neutral: {
    bg: 'bg-zinc-50 border-zinc-100 dark:bg-zinc-900/40 dark:border-zinc-800/50',
    icon: 'text-zinc-400 dark:text-zinc-500',
    value: 'text-zinc-600 dark:text-zinc-300',
    ring: 'hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-700',
    iconBg: 'bg-zinc-100/80 dark:bg-zinc-800/50',
    iconBorder: 'border-zinc-200 dark:border-zinc-700/60',
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
      {alert && (typeof value === 'number' ? value > 0 : true) && (
        <span className="absolute top-3 right-3 flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
      )}
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-sm',
          styles.iconBg,
          styles.iconBorder
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
