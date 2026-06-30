'use client'

import { useForm } from 'react-hook-form'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
  const { receiveLeg } = useWmsStore()
  const { getProduct, warehouseName } = useStoreHelpers()
  const { operators } = useWmsStore()

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

          {/* Items summary */}
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="operatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operario que recibe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar operario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op.id} value={op.name}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas / discrepancias (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: 3 unidades con embalaje dañado..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
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
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
