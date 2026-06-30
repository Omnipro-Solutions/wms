'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  requestedQty: number
  onConfirm: (qty: number) => void
}

export const QuantityStep = ({ requestedQty, onConfirm }: Props) => {
  const [value, setValue] = useState(String(requestedQty))
  const parsed = parseInt(value, 10)
  const isPartial = !isNaN(parsed) && parsed > 0 && parsed < requestedQty
  const isValid = !isNaN(parsed) && parsed > 0 && parsed <= requestedQty

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
      <Button
        size="lg"
        className="w-full max-w-xs"
        disabled={!isValid}
        onClick={() => onConfirm(parsed)}
      >
        Confirmar
      </Button>
    </div>
  )
}
