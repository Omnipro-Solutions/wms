'use client'

import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackageCheck, TriangleAlert } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransferLeg, TransferLegLineReceipt, TransferOrder } from '@/types/wms'

const schema = z.object({
  operatorName: z.string().min(1, 'Requerido'),
  notes: z.string().optional(),
  reasonId: z.string().optional(),
  lines: z.array(
    z.object({
      productId: z.string(),
      requestedQty: z.number(),
      received: z.string(),
      damaged: z.string(),
    })
  ),
})

type FormValues = z.infer<typeof schema>

const toInt = (v: string) => Math.max(0, parseInt(v, 10) || 0)

interface Props {
  transfer: TransferOrder
  leg: TransferLeg
  open: boolean
  onClose: () => void
}

export const ReceiveLegDialog = ({ transfer, leg, open, onClose }: Props) => {
  const { receiveLeg, operators, reasons } = useWmsStore()
  const { getProduct, warehouseName } = useStoreHelpers()

  const discrepancyReasons = reasons.filter(
    (r) => r.context === 'transfer_discrepancy' && r.active
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      operatorName: '',
      notes: '',
      reasonId: '',
      lines: transfer.items.map((l) => ({
        productId: l.productId,
        requestedQty: l.requestedQuantity,
        received: String(l.requestedQuantity),
        damaged: '0',
      })),
    },
  })

  const fieldArray = useFieldArray({ control: form.control, name: 'lines' })
  const watchedLines = form.watch('lines')

  // Una línea tiene discrepancia si lo sano + averiado no cuadra con lo despachado,
  // o si hay unidades averiadas. Con cualquier discrepancia se exige un motivo.
  const lineHasDiscrepancy = (l: FormValues['lines'][number]) => {
    const received = toInt(l.received)
    const damaged = toInt(l.damaged)
    return damaged > 0 || received + damaged !== l.requestedQty
  }
  const anyDiscrepancy = (watchedLines ?? []).some(lineHasDiscrepancy)

  const handleSubmit = (values: FormValues) => {
    if (anyDiscrepancy && !values.reasonId) {
      form.setError('reasonId', { message: 'Selecciona un motivo para la discrepancia' })
      return
    }
    try {
      const lineReceipts: TransferLegLineReceipt[] = values.lines.map((l) => {
        const receivedQty = toInt(l.received)
        const damagedQty = toInt(l.damaged)
        const hasDiscrepancy = damagedQty > 0 || receivedQty + damagedQty !== l.requestedQty
        return {
          productId: l.productId,
          requestedQty: l.requestedQty,
          receivedQty,
          damagedQty,
          discrepancyReasonId: hasDiscrepancy ? values.reasonId || undefined : undefined,
        }
      })
      receiveLeg(transfer.id, leg.id, values.operatorName, values.notes || undefined, lineReceipts)
      form.reset()
      onClose()
    } catch (e: unknown) {
      form.setError('root', {
        message: e instanceof Error ? e.message : 'Error al recepcionar tramo',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4" />
            Recepcionar Tramo {leg.sequence}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Confirmando llegada a <strong>{warehouseName(leg.destinationId)}</strong>. Ajusta lo
            realmente recibido y las unidades averiadas en tránsito.
          </p>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="w-24 text-right">Recibido</TableHead>
                    <TableHead className="w-24 text-right">Averiado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldArray.fields.map((field, i) => {
                    const line = transfer.items[i]
                    const product = getProduct(line.productId)
                    const current = watchedLines?.[i]
                    const discrepancy = current ? lineHasDiscrepancy(current) : false
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            {product?.name ?? line.productId}
                            {discrepancy && (
                              <Badge variant="outline" className="text-amber-600 text-[10px]">
                                <TriangleAlert className="mr-0.5 size-2.5" />
                                Discrepancia
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.requestedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <Controller
                            control={form.control}
                            name={`lines.${i}.received`}
                            render={({ field: f }) => (
                              <Input
                                type="number"
                                min={0}
                                className="h-8 text-right tabular-nums"
                                {...f}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Controller
                            control={form.control}
                            name={`lines.${i}.damaged`}
                            render={({ field: f }) => (
                              <Input
                                type="number"
                                min={0}
                                className="h-8 text-right tabular-nums"
                                {...f}
                              />
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {anyDiscrepancy && (
              <Controller
                control={form.control}
                name="reasonId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Motivo de la discrepancia</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Faltante / avería en tránsito" />
                      </SelectTrigger>
                      <SelectContent>
                        {discrepancyReasons.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    <p className="text-muted-foreground text-[11px]">
                      Solo entran a stock disponible las unidades recibidas sanas; las averiadas se
                      registran como merma trazable del traslado.
                    </p>
                  </Field>
                )}
              />
            )}

            <Controller
              control={form.control}
              name="operatorName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Operario que recibe</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar operario" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.name}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="notes"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Notas (opcional)</FieldLabel>
                  <Textarea
                    {...field}
                    placeholder="Ej: sello de seguridad roto al llegar..."
                    className="resize-none"
                    rows={2}
                  />
                </Field>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-destructive text-xs">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                <PackageCheck className="mr-1.5 size-4" />
                Confirmar recepción
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
