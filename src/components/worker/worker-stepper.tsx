import { cn } from '@/lib/utils'

interface Props {
  current: number
  total: number
}

export const WorkerStepper = ({ current, total }: Props) => (
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-muted-foreground">
      Paso {current} de {total}
    </span>
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < current ? 'w-8 bg-primary' : 'w-1.5 bg-muted'
          )}
        />
      ))}
    </div>
  </div>
)
