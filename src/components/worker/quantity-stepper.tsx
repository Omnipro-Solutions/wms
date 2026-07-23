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
  <div className={cn('flex items-center justify-center gap-5', className)}>
    <Button
      variant="outline"
      size="icon"
      aria-label="−"
      className="h-14 w-14 rounded-full border-primary/30 text-xl active:bg-primary/10"
      disabled={value <= (min ?? 0)}
      onClick={() => onChange(value - 1)}
    >
      −
    </Button>
    <span className="w-20 text-center text-4xl font-black tabular-nums">{value}</span>
    <Button
      variant="outline"
      size="icon"
      aria-label="+"
      className="h-14 w-14 rounded-full border-primary/30 text-xl active:bg-primary/10"
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
    >
      +
    </Button>
  </div>
)
