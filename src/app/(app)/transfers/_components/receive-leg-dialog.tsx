'use client'

import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackageCheck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransferLeg, TransferOrder } from '@/types/wms'

const schema = z.object({
  operatorName: z.string().min(1, 'Requerido'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  transfer: TransferOrder
  leg: TransferLeg
  open: boolean
  onClose: () => void
}

export const ReceiveLegDialog = ({ transfer, leg, open, onClose }: Props) => {
  const { receiveLeg, operators } = useWmsStore()
  const { getProduct, warehouseName } = useStoreHelpers()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { operatorName: '', notes: '' },
  })

  const handleSubmit = (values: FormValues) => {
    try {
      receiveLeg(transfer.id, leg.id, values.operatorName, values.notes || undefined)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4" />
            Recepcionar Tramo {leg.sequence}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Confirmando llegada a <strong>{warehouseName(leg.destinationId)}</strong>
          </p>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.items.map((line) => {
                  const product = getProduct(line.productId)
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{product?.name ?? line.productId}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(line.requestedQuantity)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  <FieldLabel>Notas / discrepancias (opcional)</FieldLabel>
                  <Textarea
                    {...field}
                    placeholder="Ej: 3 unidades con embalaje dañado..."
                    className="resize-none"
                    rows={3}
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
