'use client'

import { useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { DOCK_TYPE_LABELS } from '@/lib/rules/yard'
import { statusLabel } from '@/lib/status'
import type { Dock, DockStatus, DockType } from '@/types/wms'

const DOCK_TYPES = Object.keys(DOCK_TYPE_LABELS) as DockType[]
const DOCK_STATUSES: DockStatus[] = ['active', 'blocked', 'maintenance']

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  name: z.string().min(1, 'Requerido'),
  warehouseId: z.string().min(1, 'Requerido'),
  type: z.string().min(1, 'Requerido'),
  status: z.string().min(1, 'Requerido'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (dock: Dock | null, defaultWarehouseId: string): FormValues => ({
  code: dock?.code ?? '',
  name: dock?.name ?? '',
  warehouseId: dock?.warehouseId ?? defaultWarehouseId,
  type: dock?.type ?? 'mixed',
  status: dock?.status ?? 'active',
  notes: dock?.notes ?? '',
})

interface Props {
  open: boolean
  dock: Dock | null // null = create mode
  onClose: () => void
}

export const DockDialog = ({ open, dock, onClose }: Props) => {
  const { warehouses, createDock, updateDock } = useWmsStore()
  const regularWarehouses = warehouses.filter((w) => w.type !== 'transit')

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(dock, regularWarehouses[0]?.id ?? ''),
  })

  useEffect(() => {
    if (open) reset(toDefaults(dock, regularWarehouses[0]?.id ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dock])

  const onSubmit = (values: FormValues) => {
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        warehouseId: values.warehouseId,
        type: values.type as DockType,
        status: values.status as DockStatus,
        notes: values.notes?.trim() || undefined,
      }
      if (dock) updateDock(dock.id, payload)
      else createDock(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al guardar el muelle' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dock ? 'Editar muelle' : 'Nuevo muelle'}</DialogTitle>
          <DialogDescription>
            Catálogo de muelles de carga/descarga. El tipo determina qué citas puede recibir (mixto
            admite ambas).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dock-code">Código</FieldLabel>
              <Input id="dock-code" placeholder="M-01" {...register('code')} />
              <FieldError errors={[errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dock-name">Nombre</FieldLabel>
              <Input id="dock-name" placeholder="Muelle 1" {...register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="dock-warehouse">Bodega</FieldLabel>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="dock-warehouse">
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

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dock-type">Tipo</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="dock-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DOCK_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dock-status">Estado</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="dock-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="dock-notes">Notas</FieldLabel>
            <Textarea
              id="dock-notes"
              rows={2}
              placeholder="Motivo de bloqueo, mantenimiento programado…"
              {...register('notes')}
            />
          </Field>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{dock ? 'Guardar cambios' : 'Crear muelle'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
