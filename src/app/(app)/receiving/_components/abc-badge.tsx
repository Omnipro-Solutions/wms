import { cn } from '@/lib/utils'
import type { AbcClass } from '@/types/wms'

const ABC_LABEL: Record<AbcClass, { label: string; color: string }> = {
  A: { label: 'Alta rotación', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  B: { label: 'Media rotación', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  C: { label: 'Baja rotación', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

interface AbcBadgeProps {
  abcClass: AbcClass
}

export const AbcBadge = ({ abcClass }: AbcBadgeProps) => {
  const { label, color } = ABC_LABEL[abcClass]
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-semibold',
          color
        )}
      >
        {abcClass}
      </span>
      <span className="text-muted-foreground text-[10px] whitespace-nowrap">{label}</span>
    </div>
  )
}
