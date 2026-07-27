'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  requestedQty: number
  requiresSerial?: boolean
  onConfirm: (qty: number, serials?: string[]) => void
}

export const QuantityStep = ({ requestedQty, requiresSerial = false, onConfirm }: Props) => {
  const [value, setValue] = useState(String(requestedQty))
  const [serialsRaw, setSerialsRaw] = useState('')
  const parsed = parseInt(value, 10)
  const isPartial = !isNaN(parsed) && parsed > 0 && parsed < requestedQty
  const qtyValid = !isNaN(parsed) && parsed > 0 && parsed <= requestedQty
  const parsedSerials = serialsRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const serialsValid = !requiresSerial || parsedSerials.length === parsed
  const isValid = qtyValid && serialsValid

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Cantidad</p>
      <p className="text-5xl font-bold">{requestedQty}</p>
      <p className="text-sm text-gray-500">unidades solicitadas</p>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-32 text-center text-2xl"
        min={1}
        max={requestedQty}
      />
      {isPartial && (
        <p className="text-sm text-amber-600">
          Pick parcial: {parsed} de {requestedQty} unidades
        </p>
      )}
      {requiresSerial && (
        <div className="w-full max-w-xs space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Números de serie (uno por unidad)
          </p>
          <Textarea
            placeholder={`Escanea ${qtyValid ? parsed : ''} número(s) de serie, uno por línea…`}
            value={serialsRaw}
            onChange={(e) => setSerialsRaw(e.target.value)}
            className="min-h-24 font-mono text-base"
            rows={Math.min(Math.max(qtyValid ? parsed : 2, 2), 6)}
          />
          <p
            className={cn(
              'text-sm',
              serialsValid && qtyValid ? 'text-emerald-600' : 'text-muted-foreground'
            )}
          >
            Series capturadas: {parsedSerials.length} / {qtyValid ? parsed : 0}
          </p>
        </div>
      )}
      <Button
        size="lg"
        className="w-full max-w-xs"
        disabled={!isValid}
        onClick={() => onConfirm(parsed, requiresSerial ? parsedSerials : undefined)}
      >
        Confirmar
      </Button>
    </div>
  )
}
