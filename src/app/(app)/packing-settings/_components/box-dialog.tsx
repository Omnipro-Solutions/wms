'use client'

import { useState } from 'react'
import { Box, CheckCircle2, Pencil, PlusCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useWmsStore } from '@/store/wms-store'
import type { PackingBoxType } from '@/types/wms'

interface FormState {
  code: string
  name: string
  maxWeightKg: number
  volumeM3: number
  dimensionsCm: string
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  maxWeightKg: 5,
  volumeM3: 0.01,
  dimensionsCm: '',
}

const boxToForm = (box: PackingBoxType): FormState => ({
  code: box.code,
  name: box.name,
  maxWeightKg: box.maxWeightKg,
  volumeM3: box.volumeM3,
  dimensionsCm: box.dimensionsCm,
})

interface Props {
  open: boolean
  onClose: () => void
  /** When provided the dialog is in edit mode. */
  box?: PackingBoxType
}

export const BoxDialog = ({ open, onClose, box }: Props) => {
  const { createPackingBox, updatePackingBox } = useWmsStore()
  const isEditing = !!box

  // Parent remounts this component via `key` when the target box changes,
  // so initial state from the prop is correct without an effect.
  const [form, setForm] = useState<FormState>(box ? boxToForm(box) : EMPTY_FORM)
  const [error, setError] = useState('')

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const handleSubmit = () => {
    if (!form.code.trim()) return setError('El código es obligatorio.')
    if (!/^[A-Z0-9-]{2,12}$/.test(form.code.trim().toUpperCase()))
      return setError('Código: solo letras, números y guiones (máx. 12).')
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (form.maxWeightKg <= 0) return setError('El peso máximo debe ser mayor a 0.')
    if (form.volumeM3 <= 0) return setError('El volumen debe ser mayor a 0.')
    if (!/^\d+x\d+x\d+$/.test(form.dimensionsCm.trim()))
      return setError('Dimensiones en formato LxAxH, ej. 30x20x15.')
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        maxWeightKg: form.maxWeightKg,
        volumeM3: form.volumeM3,
        dimensionsCm: form.dimensionsCm.trim(),
      }
      if (isEditing) updatePackingBox(box.id, payload)
      else createPackingBox(payload)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar la caja.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="size-5 text-blue-500" />
            ) : (
              <Box className="size-5 text-emerald-500" />
            )}
            {isEditing ? `Editar caja — ${box.code}` : 'Nueva caja / cartón'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="box-code">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="box-code"
                placeholder="CAJA-M"
                maxLength={12}
                value={form.code}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="box-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="box-name"
                placeholder="Caja mediana"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="box-weight">Peso máx. (kg)</Label>
              <Input
                id="box-weight"
                type="number"
                min={0}
                step={0.5}
                value={form.maxWeightKg}
                onChange={(e) => setField('maxWeightKg', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="box-volume">Volumen (m³)</Label>
              <Input
                id="box-volume"
                type="number"
                min={0}
                step={0.001}
                value={form.volumeM3}
                onChange={(e) => setField('volumeM3', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="box-dims">Dimensiones (cm)</Label>
            <Input
              id="box-dims"
              placeholder="30x20x15"
              value={form.dimensionsCm}
              onChange={(e) => setField('dimensionsCm', e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Largo × Ancho × Alto, ej. 30x20x15.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <TriangleAlert className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className={cn(!isEditing && 'bg-emerald-600 hover:bg-emerald-700')}>
            {isEditing ? (
              <><CheckCircle2 className="mr-1 size-4" /> Guardar cambios</>
            ) : (
              <><PlusCircle className="mr-1 size-4" /> Crear caja</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
