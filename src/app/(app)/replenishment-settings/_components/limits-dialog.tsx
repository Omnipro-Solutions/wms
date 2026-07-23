'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

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
import { Field, FieldError, FieldLabel } from '@/components/ui/field'

const schema = z
  .object({
    minStock: z.number().int().min(0, 'Mínimo ≥ 0'),
    maxStock: z.number().int().min(1, 'Máximo ≥ 1'),
  })
  .refine((v) => v.maxStock > v.minStock, {
    message: 'El máximo debe ser mayor que el mínimo',
    path: ['maxStock'],
  })

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  title: string
  subtitle: string
  initialMin?: number
  initialMax?: number
  /** Whether the "quitar override" button is shown (an explicit value is set). */
  hasOverride: boolean
  onSave: (minStock: number, maxStock: number) => void
  onClear?: () => void
  onClose: () => void
}

export const LimitsDialog = ({
  open,
  title,
  subtitle,
  initialMin,
  initialMax,
  hasOverride,
  onSave,
  onClear,
  onClose,
}: Props) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { minStock: initialMin ?? 0, maxStock: initialMax ?? 0 },
  })

  useEffect(() => {
    if (open) reset({ minStock: initialMin ?? 0, maxStock: initialMax ?? 0 })
  }, [open, initialMin, initialMax, reset])

  const onSubmit = (values: FormValues) => {
    onSave(values.minStock, values.maxStock)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="min-stock">Mínimo (uds.)</FieldLabel>
              <Input
                id="min-stock"
                type="number"
                min={0}
                {...register('minStock', { valueAsNumber: true })}
              />
              <FieldError errors={[errors.minStock]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="max-stock">Máximo (uds.)</FieldLabel>
              <Input
                id="max-stock"
                type="number"
                min={1}
                {...register('maxStock', { valueAsNumber: true })}
              />
              <FieldError errors={[errors.maxStock]} />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">
            Bajo el mínimo se genera una necesidad de reposición. El máximo define hasta cuánto
            reponer (a reponer = máximo − stock actual).
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            {hasOverride && onClear ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onClear()
                  onClose()
                }}
              >
                Quitar override
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
