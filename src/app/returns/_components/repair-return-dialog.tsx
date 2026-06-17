'use client'

import { useState } from 'react'
import { PackageCheck, Trash2, TriangleAlert, Wrench, CalendarClock, Building2 } from 'lucide-react'
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
import { ChoiceCard, ChoiceCardGroup } from '@/components/ui/choice-card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/formatters'
import type { RepairTicket, StorageLocation } from '@/types/wms'

const REPAIR_TYPE_LABELS: Record<RepairTicket['repairType'], string> = {
  cosmetic: 'Cosmética',
  functional: 'Funcional',
  warranty: 'Garantía',
}

interface Props {
  open: boolean
  ticket: RepairTicket
  availableLocations: StorageLocation[]
  productName: (id: string) => string
  onConfirm: (
    outcome: RepairTicket['outcome'],
    finalCostUsd: number,
    outcomeNotes: string,
    targetLocationId?: string
  ) => void
  onClose: () => void
  error?: string
}

export const RepairReturnDialog = ({
  open,
  ticket,
  availableLocations,
  productName,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const pickLocations = availableLocations.filter(
    (l) => (l.type === 'pick' || l.type === 'reserve') && !l.isBlocked
  )

  const defaultLocationId =
    pickLocations.find((l) => l.golden)?.id ?? pickLocations[0]?.id ?? ''

  const [outcome, setOutcome] = useState<RepairTicket['outcome']>('restock')
  const [finalCostUsd, setFinalCostUsd] = useState(
    ticket.lines.reduce((s, l) => s + l.estimatedCostUsd, 0)
  )
  const [outcomeNotes, setOutcomeNotes] = useState('')
  const [targetLocationId, setTargetLocationId] = useState(defaultLocationId)

  const canConfirm =
    outcome !== undefined &&
    outcomeNotes.trim().length > 0 &&
    (outcome !== 'restock' || targetLocationId.length > 0)

  const handleConfirm = () => {
    onConfirm(
      outcome,
      finalCostUsd,
      outcomeNotes,
      outcome === 'restock' ? targetLocationId : undefined
    )
  }

  const totalEstimated = ticket.lines.reduce((s, l) => s + l.estimatedCostUsd, 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-5 text-orange-600" />
            Recibir retorno de reparación
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registrar resultado de reparación del ticket {ticket.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Resumen del ticket */}
          <div className="rounded-xl border bg-muted/30 divide-y">
            <div className="flex items-center gap-3 px-4 py-3">
              <Building2 className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-muted-foreground">Taller</span>
                <span className="font-semibold">{ticket.vendorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Wrench className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-muted-foreground">Tipo de reparación</span>
                <Badge variant="outline">{REPAIR_TYPE_LABELS[ticket.repairType]}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <CalendarClock className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-muted-foreground">Retorno esperado</span>
                <span className="font-medium">{ticket.expectedReturnDate}</span>
              </div>
            </div>
          </div>

          {/* Ítems del ticket */}
          <div>
            <p className="mb-2 text-sm font-semibold">
              Ítems reparados{' '}
              <span className="text-muted-foreground font-normal">
                ({ticket.lines.length})
              </span>
            </p>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right w-16">Ud.</TableHead>
                    <TableHead className="text-right w-32">Costo est. (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticket.lines.map((line) => (
                    <TableRow key={line.returnLineId}>
                      <TableCell className="text-sm">{productName(line.productId)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatNumber(line.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        ${line.estimatedCostUsd.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ticket.lines.length > 1 && (
                    <TableRow className="bg-muted/20 font-medium">
                      <TableCell className="text-xs text-muted-foreground">Total estimado</TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums text-sm">
                        ${totalEstimated.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />

          {/* Resultado */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Resultado de la reparación <span className="text-destructive">*</span>
            </Label>
            <ChoiceCardGroup
              value={outcome ?? ''}
              onValueChange={(v) => setOutcome(v as RepairTicket['outcome'])}
              className="grid grid-cols-2 gap-2"
            >
              <ChoiceCard
                value="restock"
                icon={PackageCheck}
                accent="emerald"
                title="Reparado"
                description="Listo para reingresar al inventario disponible."
              />
              <ChoiceCard
                value="scrap"
                icon={Trash2}
                accent="red"
                title="Irreparable"
                description="No se pudo reparar, se envía a desecho."
              />
            </ChoiceCardGroup>
          </div>

          {/* Ubicación destino (solo si restock) */}
          {outcome === 'restock' && (
            <div className="space-y-1.5">
              <Label>
                Ubicación destino de reingreso <span className="text-destructive">*</span>
              </Label>
              <Select value={targetLocationId} onValueChange={setTargetLocationId}>
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
          )}

          {/* Costo final + observaciones */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="final-cost">Costo final real (USD)</Label>
              <Input
                id="final-cost"
                type="number"
                min={0}
                step={0.01}
                value={finalCostUsd}
                onChange={(e) => setFinalCostUsd(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome-notes">
                Observaciones del resultado <span className="text-destructive">*</span>
              </Label>
              <Input
                id="outcome-notes"
                placeholder="Descripción del resultado..."
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
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
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            variant={outcome === 'scrap' ? 'destructive' : 'default'}
          >
            {outcome === 'restock' ? (
              <><PackageCheck className="mr-1 size-4" /> Reingresar reparado</>
            ) : (
              <><Trash2 className="mr-1 size-4" /> Confirmar desecho</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
