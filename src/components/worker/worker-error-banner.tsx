import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  message: string
  className?: string
}

// Banner de error del piso, estilo industrial: superficie roja de estado con
// borde a la izquierda. Legible en luz variable, consistente en toda la vista worker.
export const WorkerErrorBanner = ({ message, className }: Props) => (
  <div
    role="alert"
    className={cn(
      'flex items-start gap-2 rounded-md border-l-4 border-l-[var(--worker-danger)] bg-[var(--worker-danger-surface)] px-4 py-3 text-sm text-[var(--worker-danger)]',
      className
    )}
  >
    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
    <span className="font-medium">{message}</span>
  </div>
)
