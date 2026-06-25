'use client'

import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Operator } from '@/types/wms'

const ROLE_LABELS: Record<Operator['role'], string> = {
  picker: 'Picker',
  packer: 'Empacador',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

const ROLE_COLORS: Record<Operator['role'], string> = {
  picker: 'bg-blue-100 text-blue-800',
  packer: 'bg-purple-100 text-purple-800',
  receiver: 'bg-green-100 text-green-800',
  driver: 'bg-orange-100 text-orange-800',
  supervisor: 'bg-red-100 text-red-800',
}

interface Props {
  open: boolean
  canClose: boolean   // true when changing operator (already has one), false on first login
  onClose: () => void
}

export const OperatorPicker = ({ open, canClose, onClose }: Props) => {
  const operators = useWmsStore((s) => s.operators).filter((o) => o.active)
  const setCurrentOperator = useWmsStore((s) => s.setCurrentOperator)
  const [selected, setSelected] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!selected) return
    setCurrentOperator(selected)
    setSelected(null)
    onClose()
  }

  const handleCancel = () => {
    setSelected(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen && canClose) handleCancel() }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => { if (!canClose) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (!canClose) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>Seleccionar operador</DialogTitle>
          <DialogDescription>
            Elige tu perfil para iniciar la sesión de trabajo. Las acciones disponibles dependen de tu rol.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 py-2 max-h-72 overflow-y-auto">
          {operators.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setSelected(op.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
                selected === op.id && 'border-primary bg-primary/5'
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                {op.name.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{op.name}</p>
                <p className="text-xs text-muted-foreground">{op.code}</p>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', ROLE_COLORS[op.role])}>
                {ROLE_LABELS[op.role]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {canClose && (
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={!selected} className="flex-1">
            Confirmar sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
