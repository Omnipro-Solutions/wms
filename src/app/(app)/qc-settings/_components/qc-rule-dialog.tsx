'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { QcMatchType, QcRule } from '@/types/wms'

const schema = z.object({
  name: z.string().min(3, 'Ponle un nombre descriptivo'),
  matchType: z.enum(['category', 'supplier', 'product', 'abc_class', 'all']),
  matchValue: z.string(),
  samplingPercent: z.number().min(1, 'Mínimo 1%').max(100, 'Máximo 100%'),
  priority: z.number().min(1),
  reason: z.string().min(3, 'Explica por qué se desvía a QC'),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const MATCH_TYPE_LABELS: Record<QcMatchType, string> = {
  category: 'Categoría de producto',
  supplier: 'Proveedor',
  product: 'Producto específico',
  abc_class: 'Clase ABC',
  all: 'Todas las recepciones',
}

interface Props {
  open: boolean
  rule: QcRule | null
  onClose: () => void
}

export const QcRuleDialog = ({ open, rule, onClose }: Props) => {
  const products = useWmsStore((s) => s.products)
  const addQcRule = useWmsStore((s) => s.addQcRule)
  const updateQcRule = useWmsStore((s) => s.updateQcRule)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      matchType: 'category',
      matchValue: '',
      samplingPercent: 20,
      priority: 50,
      reason: '',
      active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      rule
        ? {
            name: rule.name,
            matchType: rule.matchType,
            matchValue: rule.matchValue,
            samplingPercent: rule.samplingPercent,
            priority: rule.priority,
            reason: rule.reason,
            active: rule.active,
          }
        : {
            name: '',
            matchType: 'category',
            matchValue: '',
            samplingPercent: 20,
            priority: 50,
            reason: '',
            active: true,
          }
    )
  }, [open, rule, form])

  const matchType = form.watch('matchType')
  const categories = [...new Set(products.map((p) => p.category))].sort()

  const handleSubmit = (values: FormValues) => {
    if (rule) updateQcRule(rule.id, values)
    else addQcRule(values)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regla de QC' : 'Nueva regla de QC'}</DialogTitle>
          <DialogDescription>
            Define cuándo una recepción se desvía automáticamente a control de calidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-name">Nombre</Label>
            <Input id="qc-name" {...form.register('name')} placeholder="Electrónica — muestreo 20%" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Se aplica a</Label>
              <Select
                value={matchType}
                onValueChange={(v) => {
                  form.setValue('matchType', v as QcMatchType)
                  form.setValue('matchValue', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="qc-value">Valor</Label>
              {matchType === 'all' && (
                <Input id="qc-value" value="Todas" disabled />
              )}
              {matchType === 'category' && (
                <Select
                  value={form.watch('matchValue')}
                  onValueChange={(v) => form.setValue('matchValue', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elige categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {matchType === 'abc_class' && (
                <Select
                  value={form.watch('matchValue')}
                  onValueChange={(v) => form.setValue('matchValue', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elige clase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {matchType === 'product' && (
                <Select
                  value={form.watch('matchValue')}
                  onValueChange={(v) => form.setValue('matchValue', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elige producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.slice(0, 50).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {matchType === 'supplier' && (
                <Input id="qc-value" {...form.register('matchValue')} placeholder="Nombre del proveedor" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="qc-pct">Muestreo (%)</Label>
              <Input
                id="qc-pct"
                type="number"
                min={1}
                max={100}
                {...form.register('samplingPercent', { valueAsNumber: true })}
              />
              {form.formState.errors.samplingPercent && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.samplingPercent.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="qc-priority">Prioridad</Label>
              <Input
                id="qc-priority"
                type="number"
                min={1}
                {...form.register('priority', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Menor número gana</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-reason">Motivo</Label>
            <Textarea
              id="qc-reason"
              {...form.register('reason')}
              placeholder="Categoría con historial de daño en transporte."
              rows={2}
            />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="qc-active">Regla activa</Label>
              <p className="text-xs text-muted-foreground">
                Las reglas inactivas no desvían nada a cuarentena.
              </p>
            </div>
            <Switch
              id="qc-active"
              checked={form.watch('active')}
              onCheckedChange={(v) => form.setValue('active', v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{rule ? 'Guardar cambios' : 'Crear regla'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
