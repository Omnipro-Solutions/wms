import { cn } from '@/lib/utils'

interface Props {
  current: number
  total: number
}

// Progreso segmentado a lo ancho (estilo consola industrial): "PASO X/N" en
// monoespaciado + barras que se llenan por paso.
export const WorkerStepper = ({ current, total }: Props) => (
  <div className="flex items-center gap-3">
    <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
      Paso {current}/{total}
    </span>
    <div className="flex flex-1 gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-sm transition-colors',
            i < current ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  </div>
)
