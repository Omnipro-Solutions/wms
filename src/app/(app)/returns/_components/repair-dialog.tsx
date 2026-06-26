'use client'

import { useState } from 'react'
import { Wrench, TriangleAlert, Palette, Settings, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceCard, ChoiceCardGroup } from '@/components/ui/choice-card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { OrderLine, RepairTicketLine, RepairType } from '@/types/wms'

const REPAIR_TYPES: {
  value: RepairType
  label: string
  description: string
  icon: LucideIcon
  accent: 'blue' | 'amber' | 'emerald'
}[] = [
  {
    value: 'functional',
    label: 'Funcional',
    description: 'Falla en el funcionamiento o uso del producto.',
    icon: Settings,
    accent: 'blue',
  },
  {
    value: 'cosmetic',
    label: 'Cosmética',
    description: 'Daño visual: manchas, arañazos o deformaciones.',
    icon: Palette,
    accent: 'amber',
  },
  {
    value: 'warranty',
    label: 'Garantía',
    description: 'Cubierto por garantía del fabricante o distribuidor.',
    icon: ShieldCheck,
    accent: 'emerald',
  },
]

interface LineState {
  include: boolean
  quantity: number
  estimatedCostUsd: number
  repairNotes: string
}

interface Props {
  open: boolean
  rmaCode: string
  customerName: string
  items: OrderLine[]
  productName: (id: string) => string
  onConfirm: (
    vendorName: string,
    repairType: RepairType,
    lines: RepairTicketLine[],
    expectedReturnDate: string,
    operatorName: string
  ) => void
  onClose: () => void
  error?: string
}

export const RepairDialog = ({
  open,
  rmaCode,
  customerName,
  items,
  productName,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const [vendorName, setVendorName] = useState('')
  const [repairType, setRepairType] = useState<RepairType>('functional')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [lineStates, setLineStates] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((line) => [
        line.id,
        { include: true, quantity: line.requestedQuantity, estimatedCostUsd: 0, repairNotes: '' },
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
    vendorName.trim().length > 0 &&
    operatorName.trim().length > 0 &&
    expectedReturnDate.length > 0 &&
    items.some((line) => {
      const s = lineStates[line.id]
      return s.include && s.quantity > 0
    })

  const handleConfirm = () => {
    const lines: RepairTicketLine[] = items
      .filter((line) => lineStates[line.id].include)
      .map((line) => ({
        returnLineId: line.id,
        productId: line.productId,
        quantity: lineStates[line.id].quantity,
        estimatedCostUsd: lineStates[line.id].estimatedCostUsd,
        repairNotes: lineStates[line.id].repairNotes || undefined,
      }))
    onConfirm(vendorName, repairType, lines, expectedReturnDate, operatorName)
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
            <Wrench className="size-5 text-orange-600" />
            Enviar a reparación
          </DialogTitle>
          <DialogDescription className="sr-only">
            Crear ticket de reparación para la devolución {rmaCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Info RMA */}
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

          {/* Tipo de reparación */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Tipo de reparación <span className="text-destructive">*</span>
            </Label>
            <ChoiceCardGroup
              value={repairType}
              onValueChange={(v) => setRepairType(v as RepairType)}
              className="grid grid-cols-3 gap-2"
            >
              {REPAIR_TYPES.map((t) => (
                <ChoiceCard
                  key={t.value}
                  value={t.value}
                  icon={t.icon}
                  accent={t.accent}
                  title={t.label}
                  description={t.description}
                />
              ))}
            </ChoiceCardGroup>
          </div>

          <Separator />

          {/* Datos del taller */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Datos del taller</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vendor">
                  Taller / Proveedor <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendor"
                  placeholder="Nombre del taller"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expected-date">
                  Fecha estimada de retorno <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expected-date"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>
            </div>
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
          </div>

          <Separator />

          {/* Ítems a reparar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Ítems a reparar{' '}
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
                      ? 'border-orange-200 bg-orange-50/30 dark:border-orange-400/30 dark:bg-orange-950/20'
                      : 'border-muted-foreground/30 bg-muted/20 border-dashed opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`include-repair-${line.id}`}
                      checked={s.include}
                      onCheckedChange={(checked) => handleLineChange(line.id, 'include', !!checked)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`include-repair-${line.id}`}
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
                    <div className="grid grid-cols-3 gap-3 pl-7">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Cantidad{' '}
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
                        <Label className="text-xs font-medium">Costo estimado (USD)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={s.estimatedCostUsd === 0 ? '' : s.estimatedCostUsd}
                          onChange={(e) =>
                            handleLineChange(line.id, 'estimatedCostUsd', Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Notas de defecto</Label>
                        <Input
                          placeholder="Defecto específico..."
                          value={s.repairNotes}
                          onChange={(e) => handleLineChange(line.id, 'repairNotes', e.target.value)}
                        />
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
            <Wrench className="mr-1 size-4" /> Crear ticket de reparación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
