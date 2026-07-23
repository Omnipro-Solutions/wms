'use client'

import { useState } from 'react'
import { TriangleAlert, ClipboardCheck, Info, Hash } from 'lucide-react'
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
import {
  CONDITION_COLORS,
  CONDITION_DOT,
  CONDITION_LABELS,
  CONDITION_ORDER,
  ITEM_DISPOSITION_LABELS,
  RESULT_LABELS,
  RESULT_STYLES,
} from '@/lib/returns'
import type {
  ItemCondition,
  ItemDisposition,
  ReturnGradingRule,
  ReturnItemInspection,
  OrderLine,
  Product,
} from '@/types/wms'

const DISPOSITION_OPTIONS = (Object.keys(ITEM_DISPOSITION_LABELS) as ItemDisposition[]).map(
  (value) => ({ value, label: ITEM_DISPOSITION_LABELS[value] })
)

interface ItemInspectionState {
  conditionRating: ItemCondition
  recommendedDisposition: ItemDisposition
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
  // Grading policy (from WmsSettings): when auto-disposition is on, changing an
  // item's condition pre-fills its recommended disposition from this matrix.
  autoDispositionEnabled?: boolean
  gradingPolicy?: ReturnGradingRule[]
  // Serials actually dispatched for a product (from pick movements) — offered as
  // suggestions so serial validation is demonstrable without guessing.
  getDispatchedSerials?: (productId: string) => string[]
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
  autoDispositionEnabled = false,
  gradingPolicy = [],
  getDispatchedSerials,
  onConfirm,
  onClose,
  error,
}: Props) => {
  // Recommended disposition for a given condition, per the grading policy.
  const dispositionForCondition = (condition: ItemCondition): ItemDisposition =>
    gradingPolicy.find((g) => g.condition === condition)?.disposition ?? 'restock'

  const initialDisposition = autoDispositionEnabled
    ? dispositionForCondition('good')
    : 'restock'

  const [inspectorName, setInspectorName] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [itemStates, setItemStates] = useState<Record<string, ItemInspectionState>>(() =>
    Object.fromEntries(
      items.map((line) => [
        line.id,
        {
          conditionRating: 'good' as ItemCondition,
          recommendedDisposition: initialDisposition,
          notes: '',
          serial: '',
        },
      ])
    )
  )

  const handleItemChange = (lineId: string, field: keyof ItemInspectionState, value: string) => {
    setItemStates((prev) => {
      const next = { ...prev[lineId], [field]: value }
      // Auto-disposition: when the condition changes, snap the recommended
      // disposition to the configured grading policy (inspector can still override).
      if (field === 'conditionRating' && autoDispositionEnabled) {
        next.recommendedDisposition = dispositionForCondition(value as ItemCondition)
      }
      return { ...prev, [lineId]: next }
    })
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

  const defectiveCount = items.filter(
    (l) => itemStates[l.id].conditionRating === 'defective'
  ).length

  const overallResult =
    defectiveCount === 0 ? 'pass' : defectiveCount === items.length ? 'fail' : 'partial_pass'

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

              return (
                <div
                  key={line.id}
                  className={cn(
                    'space-y-4 rounded-xl border-2 p-4 transition-colors',
                    state.conditionRating === 'defective'
                      ? 'border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/40'
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
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 gap-1.5', CONDITION_COLORS[state.conditionRating])}
                    >
                      <span className={cn('size-1.5 rounded-full', CONDITION_DOT[state.conditionRating])} />
                      {CONDITION_LABELS[state.conditionRating]}
                    </Badge>
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
                          {CONDITION_ORDER.map((c) => (
                            <SelectItem key={c} value={c}>
                              <div className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full', CONDITION_DOT[c])} />
                                {CONDITION_LABELS[c]}
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
                  {getProduct && getProduct(line.productId)?.trackBy === 'serial' && (() => {
                    const dispatched = getDispatchedSerials?.(line.productId) ?? []
                    const listId = `dispatched-serials-${line.id}`
                    return (
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
                          list={dispatched.length > 0 ? listId : undefined}
                        />
                        {dispatched.length > 0 && (
                          <datalist id={listId}>
                            {dispatched.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        )}
                        {dispatched.length > 0 && (
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Info className="size-3" />
                            {dispatched.length} serie{dispatched.length !== 1 ? 's' : ''} despachada
                            {dispatched.length !== 1 ? 's' : ''} disponible
                            {dispatched.length !== 1 ? 's' : ''} como sugerencia.
                          </p>
                        )}
                        {state.serial.trim() && (
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Info className="size-3" />
                            El serial se verificará contra el historial de despachos al confirmar.
                          </p>
                        )}
                      </div>
                    )
                  })()}
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
