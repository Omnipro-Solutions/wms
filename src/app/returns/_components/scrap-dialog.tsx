'use client'

import { useState } from 'react'
import { Trash2, TriangleAlert, Flame, Heart, DollarSign, Leaf } from 'lucide-react'
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
import { ChoiceCard, ChoiceCardGroup } from '@/components/ui/choice-card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { OrderLine, Reason, ScrapLine, ScrapMethod } from '@/types/wms'

const DISPOSAL_METHODS: {
  value: ScrapMethod
  label: string
  description: string
  icon: LucideIcon
  accent: 'red' | 'neutral' | 'blue' | 'emerald' | 'amber'
}[] = [
  {
    value: 'incinerate',
    label: 'Incineración',
    description: 'Destrucción térmica controlada.',
    icon: Flame,
    accent: 'red',
  },
  {
    value: 'landfill',
    label: 'Vertedero',
    description: 'Disposición en relleno sanitario.',
    icon: Trash2,
    accent: 'neutral',
  },
  {
    value: 'donate',
    label: 'Donación',
    description: 'Entrega a entidad sin ánimo de lucro.',
    icon: Heart,
    accent: 'blue',
  },
  {
    value: 'liquidate',
    label: 'Liquidación',
    description: 'Venta por debajo del costo.',
    icon: DollarSign,
    accent: 'amber',
  },
  {
    value: 'recycle',
    label: 'Reciclaje',
    description: 'Proceso de reciclaje de materiales.',
    icon: Leaf,
    accent: 'emerald',
  },
]

interface LineState {
  quantity: number
  reasonId: string
  include: boolean
}

interface Props {
  open: boolean
  rmaCode: string
  customerName: string
  items: OrderLine[]
  scrapReasons: Reason[]
  productName: (id: string) => string
  onConfirm: (
    lines: ScrapLine[],
    disposalMethod: ScrapMethod,
    operatorName: string,
    referenceDoc: string,
    notes: string
  ) => void
  onClose: () => void
  error?: string
}

export const ScrapDialog = ({
  open,
  rmaCode,
  customerName,
  items,
  scrapReasons,
  productName,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const defaultReasonId = scrapReasons[0]?.id ?? ''

  const [operatorName, setOperatorName] = useState('')
  const [disposalMethod, setDisposalMethod] = useState<ScrapMethod>('incinerate')
  const [referenceDoc, setReferenceDoc] = useState('')
  const [notes, setNotes] = useState('')
  const [lineStates, setLineStates] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((line) => [
        line.id,
        { quantity: line.requestedQuantity, reasonId: defaultReasonId, include: true },
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
      return s.include && s.quantity > 0 && s.reasonId
    })

  const handleConfirm = () => {
    const lines: ScrapLine[] = items
      .filter((line) => lineStates[line.id].include)
      .map((line) => ({
        returnLineId: line.id,
        productId: line.productId,
        quantity: lineStates[line.id].quantity,
        reasonId: lineStates[line.id].reasonId,
      }))
    onConfirm(lines, disposalMethod, operatorName, referenceDoc, notes)
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
            <Trash2 className="size-5 text-red-600" />
            Baja / Desecho de mercancía
          </DialogTitle>
          <DialogDescription className="sr-only">
            Dar de baja ítems de la devolución {rmaCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* Info del RMA */}
          <div className="bg-muted/40 flex items-center gap-6 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">RMA</span>
              <span className="font-semibold">{rmaCode}</span>
            </div>
            <div className="bg-border h-4 w-px" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-semibold">{customerName}</span>
            </div>
          </div>

          {/* Advertencia */}
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p>
              <strong>Acción irreversible.</strong> El inventario se dará de baja de forma
              permanente. Se registrará un movimiento de tipo <strong>scrap</strong> en el log de
              auditoría y el RMA quedará cerrado.
            </p>
          </div>

          {/* Método de disposición */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Método de disposición <span className="text-destructive">*</span>
            </Label>
            <ChoiceCardGroup
              value={disposalMethod}
              onValueChange={(v) => setDisposalMethod(v as ScrapMethod)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {DISPOSAL_METHODS.map((m) => (
                <ChoiceCard
                  key={m.value}
                  value={m.value}
                  icon={m.icon}
                  accent={m.accent}
                  title={m.label}
                  description={m.description}
                />
              ))}
            </ChoiceCardGroup>
          </div>

          <Separator />

          {/* Ítems */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Ítems a dar de baja{' '}
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
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-muted-foreground/30 bg-muted/20 border-dashed opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`include-scrap-${line.id}`}
                      checked={s.include}
                      onCheckedChange={(checked) => handleLineChange(line.id, 'include', !!checked)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`include-scrap-${line.id}`}
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
                    <div className="grid grid-cols-[120px_1fr] gap-3 pl-7">
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
                        <Label className="text-xs font-medium">Razón de baja</Label>
                        <Select
                          value={s.reasonId}
                          onValueChange={(v) => handleLineChange(line.id, 'reasonId', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar razón" />
                          </SelectTrigger>
                          <SelectContent>
                            {scrapReasons.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.label}
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

          <Separator />

          {/* Campos de soporte */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Datos de soporte</p>
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
            <div className="space-y-1.5">
              <Label htmlFor="ref-doc">Documento de referencia</Label>
              <Input
                id="ref-doc"
                placeholder="Acta, guía, resolución..."
                value={referenceDoc}
                onChange={(e) => setReferenceDoc(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observaciones adicionales</Label>
              <Input
                id="notes"
                placeholder="Notas sobre la baja de inventario..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
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
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            <Trash2 className="mr-1 size-4" /> Confirmar baja definitiva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
