'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, EyeOff, Package } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import type { CyclicCountLine, CyclicCountPlan } from '@/types/wms'

interface LineRowProps {
  line: CyclicCountLine
  blindCount: boolean
  productName: string
  productSku: string
  productImageUrl?: string
  locationCode: string
  onRecord: (qty: number) => void
}

const LineRow = ({
  line,
  blindCount,
  productName,
  productSku,
  productImageUrl,
  locationCode,
  onRecord,
}: LineRowProps) => {
  const [value, setValue] = useState(line.countedQuantity !== undefined ? String(line.countedQuantity) : '')
  const counted = line.countedQuantity !== undefined

  const handleSubmit = () => {
    const qty = Math.max(0, parseInt(value, 10) || 0)
    onRecord(qty)
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5',
        counted && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
      )}
    >
      <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        {productImageUrl ? (
          <Image src={productImageUrl} alt={productName} width={36} height={36} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-4 text-zinc-400" />
          </div>
        )}
      </div>
      <div className="min-w-[10rem] flex-1">
        <p className="truncate text-sm font-medium leading-tight">{productName}</p>
        <p className="text-muted-foreground font-mono text-[11px] leading-tight">
          {productSku} · {locationCode}
          {line.lot ? ` · Lote ${line.lot}` : ''}
          {line.serial ? ` · S/N ${line.serial}` : ''}
        </p>
      </div>
      {!blindCount && (
        <div className="text-muted-foreground shrink-0 text-xs">
          Esperado: <span className="font-semibold tabular-nums">{line.expectedQuantity}</span>
        </div>
      )}
      {blindCount && !counted && (
        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
          <EyeOff className="mr-1 size-3" /> Ciego
        </Badge>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Cant."
          className="h-9 w-24"
        />
        <Button size="sm" variant={counted ? 'outline' : 'default'} onClick={handleSubmit} disabled={value === ''}>
          {counted ? 'Actualizar' : 'Registrar'}
        </Button>
      </div>
      {counted && (
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <span
            className={cn(
              'font-semibold tabular-nums',
              (line.variance ?? 0) === 0
                ? 'text-emerald-600'
                : (line.variance ?? 0) > 0
                  ? 'text-blue-600'
                  : 'text-red-600'
            )}
          >
            {(line.variance ?? 0) > 0 ? '+' : ''}
            {line.variance}
          </span>
        </div>
      )}
    </div>
  )
}

interface ExecuteCountPanelProps {
  plan: CyclicCountPlan
  lines: CyclicCountLine[]
  productName: (id: string) => string
  productSku: (id: string) => string
  productImageUrl: (id: string) => string | undefined
  locationCode: (id: string) => string
  onRecordLine: (lineId: string, qty: number) => void
  onComplete: () => void
  onChangePlan: () => void
}

export const ExecuteCountPanel = ({
  plan,
  lines,
  productName,
  productSku,
  productImageUrl,
  locationCode,
  onRecordLine,
  onComplete,
  onChangePlan,
}: ExecuteCountPanelProps) => {
  const countedCount = lines.filter((l) => l.countedQuantity !== undefined).length
  const pct = lines.length > 0 ? Math.round((countedCount / lines.length) * 100) : 0
  const pending = lines.length - countedCount

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            {plan.code} — {plan.name}
            {plan.blindCount && (
              <Badge variant="outline" className="text-[10px]">
                <EyeOff className="mr-1 size-3" /> Conteo ciego
              </Badge>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {countedCount}/{lines.length} líneas contadas
          </p>
          <div className="mt-2 w-56">
            <Progress value={pct} variant={pct === 100 ? 'success' : 'default'} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onChangePlan}>
            Cambiar de plan
          </Button>
          <Button size="sm" onClick={onComplete} disabled={countedCount === 0}>
            Completar conteo
          </Button>
        </div>
      </div>

      {pending > 0 && countedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {pending} línea{pending !== 1 ? 's' : ''} sin contar — al completar, solo se generan
          ajustes para lo capturado.
        </p>
      )}

      <div className="space-y-2">
        {lines.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            blindCount={plan.blindCount}
            productName={productName(line.productId)}
            productSku={productSku(line.productId)}
            productImageUrl={productImageUrl(line.productId)}
            locationCode={locationCode(line.locationId)}
            onRecord={(qty) => onRecordLine(line.id, qty)}
          />
        ))}
      </div>
    </div>
  )
}
