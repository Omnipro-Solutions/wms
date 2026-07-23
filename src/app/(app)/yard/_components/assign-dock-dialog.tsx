'use client'

import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { isDockCompatible } from '@/lib/rules/yard'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppointmentRow } from '../columns'

interface Props {
  appointment: AppointmentRow | null
  open: boolean
  onClose: () => void
}

// Split so the form re-mounts (fresh local state) whenever a different
// appointment opens, instead of syncing props into state via an effect.
const AssignDockForm = ({
  appointment,
  onClose,
}: {
  appointment: AppointmentRow
  onClose: () => void
}) => {
  const { docks, assignDock } = useWmsStore()
  const [dockId, setDockId] = useState(appointment.dockId ?? '')
  const [error, setError] = useState('')

  const compatibleDocks = docks.filter(
    (d) =>
      d.warehouseId === appointment.warehouseId &&
      d.status === 'active' &&
      isDockCompatible(d, appointment.type)
  )

  const handleSubmit = () => {
    if (!dockId) {
      setError('Selecciona un muelle')
      return
    }
    try {
      assignDock(appointment.id, dockId)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo asignar el muelle')
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Asignar muelle — {appointment.code}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="assign-dock-select">Muelle</Label>
        <Select
          value={dockId}
          onValueChange={(v) => {
            setDockId(v)
            setError('')
          }}
        >
          <SelectTrigger id="assign-dock-select" className="w-full">
            <SelectValue placeholder="Seleccionar muelle" />
          </SelectTrigger>
          <SelectContent>
            {compatibleDocks.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.code} — {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {compatibleDocks.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No hay muelles activos compatibles en esta bodega.
          </p>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit}>
          Asignar
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export const AssignDockDialog = ({ appointment, open, onClose }: Props) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    {appointment && <AssignDockForm key={appointment.id} appointment={appointment} onClose={onClose} />}
  </Dialog>
)
