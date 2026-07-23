import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  icon?: LucideIcon
  className?: string
}

export const WorkerPageHeader = ({ title, subtitle, icon: Icon, className }: Props) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-3xl bg-linear-to-br from-(--worker-gradient-from) to-(--worker-gradient-to) p-5 text-(--worker-on-gradient)',
      className
    )}
  >
    {Icon && <Icon className="absolute -top-2 right-3 size-20 opacity-15" />}
    <p className="text-xl font-bold">{title}</p>
    {subtitle && <p className="text-sm opacity-90">{subtitle}</p>}
  </div>
)
