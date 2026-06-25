'use client'

import { useState } from 'react'
import {
  TriangleAlert,
  ClipboardCheck,
  Info,
  Hash,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { ItemCondition, ReturnItemInspection, OrderLine, Product } from '@/types/wms'

const CONDITION_OPTIONS: { value: ItemCondition; label: string; color: string; dot: string }[] = [
  {
    value: 'new',
    label: 'Nuevo',
    color: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
  },
  {
    value: 'like_new',
    label: 'Como nuevo',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    value: 'good',
    label: 'Buen estado',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    value: 'fair',
    label: 'Aceptable',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    value: 'defective',
    label: 'Defectuoso',
    color: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
]

const DISPOSITION_OPTIONS: {
  value: ReturnItemInspection['recommendedDisposition']
  label: string
}[] = [
  { value: 'restock', label: 'Reingresar al stock' },
  { value: 'repair', label: 'Enviar a reparación' },
  { value: 'scrap', label: 'Enviar a desecho' },
  { value: 'reject', label: 'Rechazar' },
]

interface ItemInspectionState {
  conditionRating: ItemCondition
  recommendedDisposition: ReturnItemInspection['recommendedDisposition']
  notes: string
  serial: string
}

interface Props {
  open: boolean
  rmaCode: string
  customerName: string
  items: OrderLine[]
  productName: (id: string) => string
  getProduct?: (id: string) => Product | undefined
  onConfirm: (inspectorName: string, items: ReturnItemInspection[], notes: string) => void
  onClose: () => void
  error?: string
}

export const InspectReturnDialog = ({
  open,
  rmaCode,
  customerName,
  items,
  productName,
  getProduct,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const [inspectorName, setInspectorName] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [itemStates, setItemStates] = useState<Record<string, ItemInspectionState>>(() =>
    Object.fromEntries(
      items.map((line) => [
        line.id,
        {
          conditionRating: 'good' as ItemCondition,
          recommendedDisposition: 'restock' as ReturnItemInspection['recommendedDisposition'],
          notes: '',
          serial: '',
        },
      ])
    )
  )

  const handleItemChange = (lineId: string, field: keyof ItemInspectionState, value: string) => {
    setItemStates((prev) => ({ ...prev, [lineId]: { ...prev[lineId], [field]: value } }))
  }

  const handleConfirm = () => {
    const inspectionItems: ReturnItemInspection[] = items.map((line) => {
      const s = itemStates[line.id]
      return {
        returnLineId: line.id,
        productId: line.productId,
        inspectedQuantity: line.requestedQuantity,
        conditionRating: s.conditionRating,
        recommendedDisposition: s.recommendedDisposition,
        notes: s.notes,
        ...(s.serial.trim() ? { serial: s.serial.trim() } : {}),
      }
    })
    onConfirm(inspectorName, inspectionItems, generalNotes)
  }

  const conditionOpt = (rating: ItemCondition) => CONDITION_OPTIONS.find((o) => o.value === rating)

  const defectiveCount = items.filter(
    (l) => itemStates[l.id].conditionRating === 'defective'
  ).length

  const overallResult =
    defectiveCount === 0 ? 'pass' : defectiveCount === items.length ? 'fail' : 'partial_pass'

  const RESULT_STYLES: Record<string, string> = {
    pass: 'bg-green-50 text-green-800 border-green-200',
    partial_pass: 'bg-amber-50 text-amber-800 border-amber-200',
    fail: 'bg-red-50 text-red-800 border-red-200',
  }

  const RESULT_LABELS: Record<string, string> = {
    pass: 'Aprobada',
    partial_pass: 'Aprobación parcial',
    fail: 'Rechazada',
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl! overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-blue-600" />
            Inspección de devolución
          </DialogTitle>
          <DialogDescription className="sr-only">
            Inspección de ítems para la devolución {rmaCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* RMA info */}
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

          {/* Inspector */}
          <div className="space-y-1.5">
            <Label htmlFor="inspector">
              Inspector <span className="text-destructive">*</span>
            </Label>
            <Input
              id="inspector"
              placeholder="Nombre completo del inspector"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
            />
          </div>

          <Separator />

          {/* Ítems */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">
              Ítems a inspeccionar{' '}
              <span className="text-muted-foreground font-normal">({items.length})</span>
            </p>

            {items.map((line, idx) => {
              const state = itemStates[line.id]
              const cond = conditionOpt(state.conditionRating)

              return (
                <div
                  key={line.id}
                  className={cn(
                    'space-y-4 rounded-xl border-2 p-4 transition-colors',
                    state.conditionRating === 'defective'
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-border bg-card'
                  )}
                >
                  {/* Header del ítem */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm leading-tight font-semibold">
                        {idx + 1}. {productName(line.productId)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {line.requestedQuantity} unidad{line.requestedQuantity !== 1 ? 'es' : ''}{' '}
                        devuelta{line.requestedQuantity !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {cond && (
                      <Badge variant="outline" className={cn('shrink-0 gap-1.5', cond.color)}>
                        <span className={cn('size-1.5 rounded-full', cond.dot)} />
                        {cond.label}
                      </Badge>
                    )}
                  </div>

                  {/* Condición + Disposición */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Condición del ítem</Label>
                      <Select
                        value={state.conditionRating}
                        onValueChange={(v) => handleItemChange(line.id, 'conditionRating', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full', opt.dot)} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Disposición recomendada</Label>
                      <Select
                        value={state.recommendedDisposition}
                        onValueChange={(v) =>
                          handleItemChange(line.id, 'recommendedDisposition', v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DISPOSITION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Notas del ítem */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Observaciones del ítem</Label>
                    <Input
                      placeholder="Defectos específicos, marcas de uso, daños visibles..."
                      value={state.notes}
                      onChange={(e) => handleItemChange(line.id, 'notes', e.target.value)}
                    />
                  </div>

                  {/* Serial capture — only shown for serialized products */}
                  {getProduct && getProduct(line.productId)?.trackBy === 'serial' && (
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        <Hash className="text-muted-foreground size-3" />
                        Número de serie del ítem devuelto
                      </Label>
                      <Input
                        placeholder="Ej: SN-2024-0001"
                        value={state.serial}
                        onChange={(e) => handleItemChange(line.id, 'serial', e.target.value)}
                        className="font-mono text-sm"
                      />
                      {state.serial.trim() && (
                        <p
                          className={cn('flex items-center gap-1 text-xs', 'text-muted-foreground')}
                        >
                          <Info className="size-3" />
                          El serial se verificará contra el historial de despachos al confirmar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Resultado calculado */}
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3',
              RESULT_STYLES[overallResult]
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="size-4" />
              Resultado automático de inspección
            </div>
            <Badge variant="outline" className={cn('font-semibold', RESULT_STYLES[overallResult])}>
              {RESULT_LABELS[overallResult]}
            </Badge>
          </div>

          {/* Notas generales */}
          <div className="space-y-1.5">
            <Label htmlFor="general-notes">Notas generales de inspección</Label>
            <Input
              id="general-notes"
              placeholder="Observaciones globales del lote devuelto..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
            />
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
          <Button onClick={handleConfirm} disabled={!inspectorName.trim()}>
            <ClipboardCheck className="mr-1 size-4" /> Registrar inspección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
