'use client'

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { useWmsStore } from '@/store/wms-store'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import type { StoreReplenishmentPolicy } from '@/types/wms'

const schema = z
  .object({
    storeWarehouseId: z.string().min(1, 'Selecciona una tienda'),
    productId: z.string().min(1, 'Selecciona un producto'),
    minStock: z.number().int().min(0, 'Mínimo ≥ 0'),
    maxStock: z.number().int().min(1, 'Máximo ≥ 1'),
    active: z.boolean(),
  })
  .refine((v) => v.maxStock > v.minStock, {
    message: 'El máximo debe ser mayor que el mínimo',
    path: ['maxStock'],
  })

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  policy: StoreReplenishmentPolicy | null // null = create mode
  onClose: () => void
}

export const StorePolicyDialog = ({ open, policy, onClose }: Props) => {
  const { warehouses, products, storeReplenishmentPolicies, upsertStoreReplenishmentPolicy } =
    useWmsStore()

  const stores = useMemo(() => warehouses.filter((w) => w.type === 'store'), [warehouses])
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeWarehouseId: policy?.storeWarehouseId ?? '',
      productId: policy?.productId ?? '',
      minStock: policy?.minStock ?? 0,
      maxStock: policy?.maxStock ?? 0,
      active: policy?.active ?? true,
    },
  })

  useEffect(() => {
    if (open)
      reset({
        storeWarehouseId: policy?.storeWarehouseId ?? '',
        productId: policy?.productId ?? '',
        minStock: policy?.minStock ?? 0,
        maxStock: policy?.maxStock ?? 0,
        active: policy?.active ?? true,
      })
  }, [open, policy, reset])

  const onSubmit = (values: FormValues) => {
    // Prevent duplicate (store, product) in create mode.
    if (!policy) {
      const dup = storeReplenishmentPolicies.some(
        (p) => p.storeWarehouseId === values.storeWarehouseId && p.productId === values.productId
      )
      if (dup) {
        setError('productId', { message: 'Ya existe una política para esa tienda y producto' })
        return
      }
    }
    upsertStoreReplenishmentPolicy({ id: policy?.id, ...values })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{policy ? 'Editar política de tienda' : 'Nueva política de tienda'}</DialogTitle>
          <DialogDescription>
            Define el min/max de un producto en una tienda. Bajo el mínimo se genera una tarea de
            surtido desde el CD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel>Tienda</FieldLabel>
            <Controller
              control={control}
              name="storeWarehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!policy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.storeWarehouseId]} />
          </Field>

          <Field>
            <FieldLabel>Producto</FieldLabel>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!policy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.productId]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="sp-min">Mínimo (uds.)</FieldLabel>
              <Input
                id="sp-min"
                type="number"
                min={0}
                {...register('minStock', { valueAsNumber: true })}
              />
              <FieldError errors={[errors.minStock]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sp-max">Máximo (uds.)</FieldLabel>
              <Input
                id="sp-max"
                type="number"
                min={1}
                {...register('maxStock', { valueAsNumber: true })}
              />
              <FieldError errors={[errors.maxStock]} />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="sp-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="sp-active" className="text-sm">
              Activa (participa en la detección de tiendas bajo mínimo)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{policy ? 'Guardar cambios' : 'Crear política'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
