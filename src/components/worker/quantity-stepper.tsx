'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  className?: string
}

export const QuantityStepper = ({ value, onChange, min = 0, max, className }: Props) => (
  <div className={cn('flex items-center gap-4', className)}>
    <Button
      variant="outline"
      size="icon"
      aria-label="−"
      className="h-12 w-12 text-xl"
      disabled={value <= (min ?? 0)}
      onClick={() => onChange(value - 1)}
    >
      −
    </Button>
    <span className="w-16 text-center text-3xl font-bold tabular-nums">{value}</span>
    <Button
      variant="outline"
      size="icon"
      aria-label="+"
      className="h-12 w-12 text-xl"
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
    >
      +
    </Button>
  </div>
)
