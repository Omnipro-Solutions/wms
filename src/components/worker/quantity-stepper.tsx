'use client'

import { Minus, Plus } from 'lucide-react'
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
  <div className={cn('flex items-center justify-center gap-4', className)}>
    <Button
      variant="outline"
      size="icon"
      aria-label="Menos"
      className="border-border h-14 w-14 rounded-lg active:bg-primary/10"
      disabled={value <= (min ?? 0)}
      onClick={() => onChange(value - 1)}
    >
      <Minus className="size-6" />
    </Button>
    <span className="w-24 text-center font-mono text-5xl font-black tabular-nums">{value}</span>
    <Button
      variant="outline"
      size="icon"
      aria-label="Más"
      className="border-border h-14 w-14 rounded-lg active:bg-primary/10"
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
    >
      <Plus className="size-6" />
    </Button>
  </div>
)
