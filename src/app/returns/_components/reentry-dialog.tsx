'use client'

import { useState } from 'react'
import { PackageCheck, TriangleAlert, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { OrderLine, ReentryLine, StorageLocation } from '@/types/wms'

interface LineState {
  quantity: number
  targetLocationId: string
  include: boolean
}

interface Props {
  open: boolean
  rmaCode: string
  customerName: string
  items: OrderLine[]
  availableLocations: StorageLocation[]
  productName: (id: string) => string
  onConfirm: (lines: ReentryLine[], operatorName: string) => void
  onClose: () => void
  error?: string
}

export const ReentryDialog = ({
  open,
  rmaCode,
  customerName,
  items,
  availableLocations,
  productName,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const pickLocations = availableLocations.filter(
    (l) => (l.type === 'pick' || l.type === 'reserve') && !l.isBlocked
  )

  const defaultLocationId = pickLocations.find((l) => l.golden)?.id ?? pickLocations[0]?.id ?? ''

  const [operatorName, setOperatorName] = useState('')
  const [lineStates, setLineStates] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((line) => [
        line.id,
        { quantity: line.requestedQuantity, targetLocationId: defaultLocationId, include: true },
      ])
    )
  )

  const handleLineChange = (
    lineId: string,
    field: keyof LineState,
    value: string | number | boolean
  ) => {
    setLineStates((prev) => ({ ...prev, [lineId]: { ...prev[lineId], [field]: value } }))
  }

  const includedCount = items.filter((l) => lineStates[l.id].include).length

  const canConfirm =
    operatorName.trim().length > 0 &&
    items.some((line) => {
      const s = lineStates[line.id]
      return s.include && s.quantity > 0 && s.targetLocationId
    })

  const handleConfirm = () => {
    const lines: ReentryLine[] = items
      .filter((line) => lineStates[line.id].include)
      .map((line) => ({
        returnLineId: line.id,
        productId: line.productId,
        quantity: lineStates[line.id].quantity,
        targetLocationId: lineStates[line.id].targetLocationId,
      }))
    onConfirm(lines, operatorName)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl! overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-green-600" />
            Reingreso al inventario
          </DialogTitle>
          <DialogDescription className="sr-only">
            Reingresar ítems de la devolución {rmaCode} al stock
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Info del RMA */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground">RMA</span>
              <span className="font-medium">{rmaCode}</span>
            </div>
            <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{customerName}</span>
            </div>
          </div>

          {/* Banner informativo */}
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info className="mt-0.5 size-4 shrink-0 text-blue-600" />
            <p>
              El stock pasará de la zona de devoluciones a la ubicación seleccionada y quedará
              disponible para picking. Se registrará un movimiento de tipo <strong>return</strong>{' '}
              en el log de auditoría.
            </p>
          </div>

          {/* Operador */}
          <div className="space-y-1.5">
            <Label htmlFor="operator">
              Operador responsable <span className="text-destructive">*</span>
            </Label>
            <Input
              id="operator"
              placeholder="Nombre del operador"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
          </div>

          <Separator />

          {/* Ítems */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Ítems a reingresar{' '}
                <span className="text-muted-foreground font-normal">({items.length})</span>
              </p>
              {includedCount < items.length && (
                <span className="text-muted-foreground text-xs">
                  {includedCount} de {items.length} seleccionados
                </span>
              )}
            </div>

            {items.map((line, idx) => {
              const s = lineStates[line.id]
              return (
                <div
                  key={line.id}
                  className={cn(
                    'space-y-4 rounded-xl border-2 p-4 transition-all',
                    s.include
                      ? 'border-border bg-card'
                      : 'border-muted-foreground/30 bg-muted/20 border-dashed opacity-60'
                  )}
                >
                  {/* Checkbox + nombre */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`include-${line.id}`}
                      checked={s.include}
                      onCheckedChange={(checked) => handleLineChange(line.id, 'include', !!checked)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`include-${line.id}`}
                      className="flex-1 cursor-pointer space-y-0.5"
                    >
                      <p className="text-sm leading-tight font-semibold">
                        {idx + 1}. {productName(line.productId)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {line.requestedQuantity} ud. devuelta
                        {line.requestedQuantity !== 1 ? 's' : ''}
                      </p>
                    </label>
                  </div>

                  {s.include && (
                    <div className="grid grid-cols-2 gap-3 pl-7">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Cantidad a reingresar{' '}
                          <span className="text-muted-foreground font-normal">
                            (máx. {line.requestedQuantity})
                          </span>
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={line.requestedQuantity}
                          value={s.quantity}
                          onChange={(e) =>
                            handleLineChange(
                              line.id,
                              'quantity',
                              Math.min(Number(e.target.value), line.requestedQuantity)
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Ubicación destino</Label>
                        <Select
                          value={s.targetLocationId}
                          onValueChange={(v) => handleLineChange(line.id, 'targetLocationId', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar ubicación" />
                          </SelectTrigger>
                          <SelectContent>
                            {pickLocations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                <span className="flex items-center gap-1.5">
                                  {loc.golden && <span>⭐</span>}
                                  {loc.code} — {loc.zone}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <p className="text-destructive flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            <PackageCheck className="mr-1 size-4" /> Ejecutar reingreso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
