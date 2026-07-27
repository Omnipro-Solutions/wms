'use client'

import { ScanBarcode, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PickMode = 'visible' | 'blind'

interface Props {
  value: PickMode | null
  onChange: (mode: PickMode) => void
  className?: string
}

const OPTIONS: { mode: PickMode; icon: typeof ScanBarcode; title: string; description: string }[] = [
  {
    mode: 'visible',
    icon: ScanBarcode,
    title: 'Cantidad visible',
    description: 'Verás cuánto se solicitó en cada paso.',
  },
  {
    mode: 'blind',
    icon: EyeOff,
    title: 'A ciegas',
    description: 'No verás la cantidad solicitada. Cuentas lo que encuentres y comparamos al final.',
  },
]

export const PickModeSelect = ({ value, onChange, className }: Props) => (
  <div className={cn('flex flex-col gap-3', className)}>
    {OPTIONS.map(({ mode, icon: Icon, title, description }) => {
      const selected = value === mode
      return (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'flex items-center gap-4 rounded-lg border p-5 text-left transition-colors',
            selected
              ? 'border-primary bg-[var(--worker-info-surface)]'
              : 'border-border bg-card'
          )}
        >
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-md',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--worker-info-surface)] text-[var(--worker-info)]'
            )}
          >
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{title}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </button>
      )
    })}
  </div>
)
