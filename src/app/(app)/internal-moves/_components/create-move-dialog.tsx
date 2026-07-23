'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { availableStock } from '@/lib/rules/inventory'
import { cn } from '@/lib/utils'
import { ProductStockCombobox, type ProductStockOption } from '@/components/shared/product-stock-combobox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import type { InternalMoveType } from '@/types/wms'
import { MOVE_TYPE_LABELS } from '../columns'

// Ubicaciones virtuales del flujo de traslados — no son posiciones físicas.
const VIRTUAL_LOCATIONS = new Set(['loc-transit', 'loc-recibo'])

// Tipos que un operario puede crear a mano (putaway/replenishment/reslotting los
// generan sus propios flujos, no se ofrecen aquí).
const AD_HOC_TYPES: InternalMoveType[] = ['bin_to_bin', 'consolidation', 'quarantine', 'housekeeping']

const schema = z.object({
  moveType: z.string().min(1, 'Requerido'),
  warehouseId: z.string().min(1, 'Requerido'),
  productId: z.string().min(1, 'Requerido'),
  fromLocationId: z.string().min(1, 'Requerido'),
  toLocationId: z.string().min(1, 'Requerido'),
  quantity: z.string().min(1, 'Requerido'),
  reasonId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export interface CreateMoveInitial {
  moveType?: InternalMoveType
  warehouseId?: string
  productId?: string
  fromLocationId?: string
  toLocationId?: string
  quantity?: number
  reasonId?: string
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: CreateMoveInitial
}

export const CreateMoveDialog = ({ open, onClose, initial }: Props) => {
  const { warehouses, products, locations, inventoryItems, reasons, createInternalMove } =
    useWmsStore()

  const regularWarehouses = warehouses.filter((w) => w.type !== 'transit')
  const moveReasons = reasons.filter((r) => r.context === 'internal_move' && r.active)

  const buildDefaults = (): FormValues => ({
    moveType: initial?.moveType ?? 'bin_to_bin',
    warehouseId: initial?.warehouseId ?? regularWarehouses[0]?.id ?? '',
    productId: initial?.productId ?? '',
    fromLocationId: initial?.fromLocationId ?? '',
    toLocationId: initial?.toLocationId ?? '',
    quantity: initial?.quantity ? String(initial.quantity) : '1',
    reasonId: initial?.reasonId ?? '',
  })

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
  })

  // Recarga los valores (incluido el prefill de consolidación) cada vez que se abre.
  useEffect(() => {
    if (open) reset(buildDefaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const warehouseId = watch('warehouseId')
  const fromLocationId = watch('fromLocationId')
  const productId = watch('productId')

  const warehouseLocations = locations.filter(
    (l) => l.warehouseId === warehouseId && !VIRTUAL_LOCATIONS.has(l.id)
  )

  // Productos con disponible > 0 en la ubicación ORIGEN (de ahí sale el stock). Igual
  // que el picker de traslados, pero acotado a la posición en vez de a la bodega.
  const stockOptions = useMemo<ProductStockOption[]>(() => {
    if (!fromLocationId) return []
    const byProduct = new Map<string, number>()
    for (const it of inventoryItems) {
      if (it.locationId !== fromLocationId) continue
      const avail = availableStock(it)
      if (avail <= 0) continue
      byProduct.set(it.productId, (byProduct.get(it.productId) ?? 0) + avail)
    }
    return [...byProduct.entries()]
      .map(([pid, available]) => {
        const product = products.find((p) => p.id === pid)
        return product ? { product, available } : null
      })
      .filter((o): o is ProductStockOption => o !== null)
      .sort((a, b) => a.product.name.localeCompare(b.product.name))
  }, [inventoryItems, products, fromLocationId])

  const availableFor = (pid: string) => stockOptions.find((o) => o.product.id === pid)?.available ?? 0

  // Cambiar bodega invalida ubicaciones y producto; cambiar origen invalida el producto.
  const handleWarehouseChange = (value: string, onChange: (v: string) => void) => {
    onChange(value)
    setValue('fromLocationId', '')
    setValue('toLocationId', '')
    setValue('productId', '')
    setValue('quantity', '1')
  }
  const handleFromChange = (value: string, onChange: (v: string) => void) => {
    onChange(value)
    setValue('productId', '')
    setValue('quantity', '1')
  }

  const onSubmit = (values: FormValues) => {
    try {
      // Topa la cantidad al disponible en el origen (backstop además de la validación del store).
      const cap = availableFor(values.productId)
      const raw = Math.max(1, parseInt(values.quantity, 10) || 1)
      createInternalMove({
        warehouseId: values.warehouseId,
        moveType: values.moveType as InternalMoveType,
        productId: values.productId,
        fromLocationId: values.fromLocationId,
        toLocationId: values.toLocationId,
        quantity: cap > 0 ? Math.min(raw, cap) : raw,
        reasonId: values.reasonId || undefined,
        operatorName: 'Supervisor',
      })
      reset(buildDefaults())
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al crear el movimiento',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento interno</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="moveType">Tipo</FieldLabel>
              <Controller
                control={control}
                name="moveType"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="moveType">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {AD_HOC_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {MOVE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.moveType]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="warehouseId">Bodega</FieldLabel>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select
                    onValueChange={(v) => handleWarehouseChange(v, field.onChange)}
                    value={field.value}
                  >
                    <SelectTrigger id="warehouseId">
                      <SelectValue placeholder="Bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      {regularWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.warehouseId]} />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field>
              <FieldLabel htmlFor="fromLocationId">Origen</FieldLabel>
              <Controller
                control={control}
                name="fromLocationId"
                render={({ field }) => (
                  <Select
                    onValueChange={(v) => handleFromChange(v, field.onChange)}
                    value={field.value}
                  >
                    <SelectTrigger id="fromLocationId">
                      <SelectValue placeholder="Ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseLocations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.fromLocationId]} />
            </Field>
            <ArrowRight className="text-muted-foreground mb-2.5 size-4" />
            <Field>
              <FieldLabel htmlFor="toLocationId">Destino</FieldLabel>
              <Controller
                control={control}
                name="toLocationId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="toLocationId">
                      <SelectValue placeholder="Ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseLocations
                        .filter((l) => l.id !== fromLocationId)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.code}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.toLocationId]} />
            </Field>
          </div>

          {/* Producto — combobox buscable, solo con stock en la ubicación origen */}
          <Field>
            <FieldLabel htmlFor="productId">Producto</FieldLabel>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <ProductStockCombobox
                  options={stockOptions}
                  value={field.value}
                  onSelect={field.onChange}
                  disabled={!fromLocationId}
                />
              )}
            />
            <FieldError errors={[errors.productId]} />
            {fromLocationId && stockOptions.length === 0 && (
              <p className="text-muted-foreground text-xs">
                La ubicación origen no tiene stock disponible.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="quantity">Cantidad</FieldLabel>
              <Controller
                control={control}
                name="quantity"
                render={({ field }) => {
                  const cap = availableFor(productId)
                  const entered = Math.max(1, parseInt(field.value, 10) || 1)
                  const overCap = cap > 0 && entered > cap
                  return (
                    <>
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        max={cap > 0 ? cap : undefined}
                        {...field}
                      />
                      {productId && (
                        <p
                          className={cn(
                            'text-xs',
                            overCap ? 'text-amber-600' : 'text-muted-foreground'
                          )}
                        >
                          {overCap ? `Máx. ${cap} disponibles — se ajustará a ${cap}.` : `Disponible: ${cap}`}
                        </p>
                      )}
                    </>
                  )
                }}
              />
              <FieldError errors={[errors.quantity]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="reasonId">Motivo</FieldLabel>
              <Controller
                control={control}
                name="reasonId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="reasonId">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {moveReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          {errors.root && <p className="text-destructive text-xs">{errors.root.message}</p>}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              <ArrowRight className="mr-1.5 size-4" />
              Crear movimiento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
