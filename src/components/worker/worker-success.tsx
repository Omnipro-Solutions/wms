import type { ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Título grande, p. ej. "Pick completado". */
  title: string
  /** Código monoespaciado del documento cerrado (pedido/ASN/tarea). */
  code?: string
  /** Ícono dentro del badge (por defecto un check). */
  icon?: LucideIcon
  /** Contenido extra bajo el título: tarjeta de diferencia, acciones, etc. */
  children?: ReactNode
  className?: string
}

// Pantalla de éxito animada, compartida por los 3 wizards: anillos que expanden +
// badge que hace "pop" + check + entrada escalonada del texto. Da el remate "wow"
// consistente al cerrar cada flujo (recepción, picking, packing).
export const WorkerSuccess = ({ title, code, icon: Icon = Check, children, className }: Props) => (
  <div
    className={cn(
      'flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center',
      className
    )}
  >
    <div className="relative flex size-24 items-center justify-center">
      <span className="worker-success-ring" />
      <span className="worker-success-ring [animation-delay:0.55s]" />
      <div className="animate-in zoom-in-50 fade-in-0 relative flex size-24 items-center justify-center rounded-full bg-[var(--worker-ok)] shadow-lg shadow-[var(--worker-ok)]/30 duration-500">
        <Icon
          className="animate-in zoom-in-0 fade-in-0 size-12 text-white delay-150 duration-500 [animation-fill-mode:both]"
          strokeWidth={3}
        />
      </div>
    </div>
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 delay-200 duration-500 [animation-fill-mode:both]">
      <p className="text-2xl font-bold">{title}</p>
      {code && (
        <p className="text-muted-foreground mt-1 font-mono text-sm tracking-wide">{code}</p>
      )}
    </div>
    {children && (
      <div className="animate-in fade-in-0 slide-in-from-bottom-3 flex w-full flex-col items-center gap-4 delay-300 duration-500 [animation-fill-mode:both]">
        {children}
      </div>
    )}
  </div>
)
