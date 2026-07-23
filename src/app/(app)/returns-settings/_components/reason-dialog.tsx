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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import type { Reason } from '@/types/wms'

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  label: z.string().min(1, 'Requerido'),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (reason: Reason | null): FormValues => ({
  code: reason?.code ?? '',
  label: reason?.label ?? '',
  active: reason?.active ?? true,
})

interface Props {
  open: boolean
  reason: Reason | null // null = create mode
  context: Extract<Reason['context'], 'return' | 'scrap'>
  onClose: () => void
}

const CONTEXT_COPY: Record<Props['context'], { title: string; hint: string; placeholder: string }> = {
  return: {
    title: 'motivo de devolución',
    hint: 'Aparece al registrar una nueva devolución (RMA) y al filtrar en /returns.',
    placeholder: 'RET-CAMBIO',
  },
  scrap: {
    title: 'motivo de baja',
    hint: 'Aparece al confirmar la baja (scrap) de una devolución no recuperable.',
    placeholder: 'SCRAP-OBSOLETO',
  },
}

export const ReasonDialog = ({ open, reason, context, onClose }: Props) => {
  const { createReason, updateReason } = useWmsStore()
  const copy = CONTEXT_COPY[context]

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(reason),
  })

  useEffect(() => {
    if (open) reset(toDefaults(reason))
  }, [open, reason, reset])

  const onSubmit = (values: FormValues) => {
    try {
      const payload = {
        code: values.code.trim().toUpperCase(),
        label: values.label.trim(),
        active: values.active,
        context,
      }
      if (reason) updateReason(reason.id, payload)
      else createReason(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al guardar el motivo' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reason ? `Editar ${copy.title}` : `Nuevo ${copy.title}`}</DialogTitle>
          <DialogDescription>{copy.hint}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="reason-code">Código</FieldLabel>
            <Input
              id="reason-code"
              placeholder={copy.placeholder}
              className="font-mono uppercase"
              {...register('code')}
            />
            <FieldError errors={[errors.code]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="reason-label">Etiqueta</FieldLabel>
            <Input id="reason-label" placeholder="Texto que ve el operario" {...register('label')} />
            <FieldError errors={[errors.label]} />
          </Field>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="reason-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="reason-active" className="text-sm">
              Activo (seleccionable en los formularios)
            </Label>
          </div>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{reason ? 'Guardar cambios' : 'Crear motivo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
