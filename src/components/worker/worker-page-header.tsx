import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  icon?: LucideIcon
  className?: string
}

// Encabezado de sección con identidad de marca: bloque teal sólido (sin gradiente),
// texto blanco y un ícono de marca de agua. Da el acento "premium" estilo Manhattan.
export const WorkerPageHeader = ({ title, subtitle, icon: Icon, className }: Props) => (
  <div
    className={cn(
      'worker-sheen bg-primary text-primary-foreground animate-in fade-in-0 slide-in-from-top-1 relative overflow-hidden rounded-2xl p-5 shadow-sm duration-500',
      className
    )}
  >
    {Icon && <Icon className="absolute -top-2 right-3 size-20 opacity-15" />}
    <p className="relative text-xl font-bold tracking-tight">{title}</p>
    {subtitle && <p className="relative mt-0.5 text-sm font-medium opacity-90">{subtitle}</p>}
  </div>
)
