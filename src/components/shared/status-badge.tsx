import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { statusMeta, type StatusVariant } from '@/lib/status'

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  neutral: 'border-transparent bg-gray-100 text-gray-700 dark:bg-zinc-800/60 dark:text-zinc-300',
  progress: 'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = statusMeta(status)
  return (
    <Badge className={cn(VARIANT_CLASSES[meta.variant], className)} variant="outline">
      {meta.label}
    </Badge>
  )
}
