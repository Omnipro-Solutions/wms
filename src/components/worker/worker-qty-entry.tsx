'use client'

import { Minus, Plus, Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  className?: string
}

// Entrada de cantidad estilo terminal RF/WMS: display grande monoespaciado con
// ajuste fino (+/−) y teclado numérico para teclear conteos grandes rápido.
export const WorkerQtyEntry = ({ value, onChange, min = 0, max, className }: Props) => {
  const clampUp = (n: number) => (max !== undefined ? Math.min(n, max) : n)

  const pressDigit = (d: number) => {
    const next = value === 0 ? d : value * 10 + d
    // No exceder el máximo: si teclear se pasa, ignora la tecla.
    if (max !== undefined && next > max) return
    onChange(next)
  }
  const backspace = () => onChange(Math.max(min, Math.floor(value / 10)))
  const clear = () => onChange(min)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          aria-label="Menos"
          className="border-border h-12 w-12 rounded-lg active:bg-primary/10"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="size-5" />
        </Button>
        <span className="border-border bg-muted/40 min-w-28 rounded-lg border px-4 py-1 text-center font-mono text-5xl font-black tabular-nums">
          {value}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Más"
          className="border-border h-12 w-12 rounded-lg active:bg-primary/10"
          disabled={max !== undefined && value >= max}
          onClick={() => onChange(clampUp(value + 1))}
        >
          <Plus className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Button
            key={d}
            variant="outline"
            className="border-border h-12 font-mono text-lg font-semibold active:bg-primary/10"
            onClick={() => pressDigit(d)}
          >
            {d}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="text-muted-foreground h-12 font-mono text-sm"
          onClick={clear}
        >
          C
        </Button>
        <Button
          variant="outline"
          className="border-border h-12 font-mono text-lg font-semibold active:bg-primary/10"
          onClick={() => pressDigit(0)}
        >
          0
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Borrar"
          className="text-muted-foreground h-12"
          onClick={backspace}
        >
          <Delete className="size-5" />
        </Button>
      </div>
    </div>
  )
}
