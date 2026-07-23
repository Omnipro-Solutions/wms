'use client'

import { useEffect, useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { Operator } from '@/types/wms'

interface AssignOperatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Operator['role'][]
  entityLabel: string
  currentOperatorId?: string
  onConfirm: (operator: Operator) => void
}

export const AssignOperatorDialog = ({
  open,
  onOpenChange,
  roles,
  entityLabel,
  currentOperatorId,
  onConfirm,
}: AssignOperatorDialogProps) => {
  const operators = useWmsStore((s) => s.operators)
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (open) setSelectedId(currentOperatorId ?? '')
  }, [open, currentOperatorId])

  const eligible = operators.filter((o) => o.active && roles.includes(o.role))

  const handleConfirm = () => {
    const operator = eligible.find((o) => o.id === selectedId)
    if (!operator) return
    onConfirm(operator)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Asignar operario</DialogTitle>
          <DialogDescription>{entityLabel}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un operario" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {eligible.length === 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              No hay operarios activos con el rol requerido.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!selectedId} onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
