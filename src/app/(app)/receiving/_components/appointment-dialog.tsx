'use client'

import { useState, useEffect } from 'react'
import { useWmsStore } from '@/store/wms-store'
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
import { Switch } from '@/components/ui/switch'
import type { Asn } from '@/types/wms'

const DOCKS = [
  { value: 'dock-1', label: 'Muelle 1' },
  { value: 'dock-2', label: 'Muelle 2' },
  { value: 'dock-3', label: 'Muelle 3' },
  { value: 'dock-4', label: 'Muelle 4' },
]

const TIME_SLOTS = [
  '06:00-08:00',
  '08:00-10:00',
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
]

interface Props {
  asn: Asn | null
  open: boolean
  onClose: () => void
}

export const AppointmentDialog = ({ asn, open, onClose }: Props) => {
  const { updateAsnAppointment } = useWmsStore()

  const [dockId, setDockId] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [carrierConfirmed, setCarrierConfirmed] = useState(false)
  const [errors, setErrors] = useState<{ dockId?: string; timeSlot?: string }>({})

  useEffect(() => {
    if (asn) {
      setDockId(asn.dockId ?? '')
      setTimeSlot(asn.timeSlot ?? '')
      setCarrierConfirmed(asn.carrierConfirmed ?? false)
      setErrors({})
    }
  }, [asn])

  if (!asn) return null

  const handleSubmit = () => {
    const next: typeof errors = {}
    if (!dockId) next.dockId = 'Selecciona un muelle'
    if (!timeSlot) next.timeSlot = 'Selecciona una ventana'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    updateAsnAppointment(asn.id, { dockId, timeSlot, carrierConfirmed })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar cita — {asn.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="w-full space-y-1.5">
            <Label htmlFor="dock-select">Muelle</Label>
            <Select
              value={dockId}
              onValueChange={(v) => {
                setDockId(v)
                setErrors((e) => ({ ...e, dockId: undefined }))
              }}
            >
              <SelectTrigger id="dock-select" className="w-full">
                <SelectValue placeholder="Seleccionar muelle" />
              </SelectTrigger>
              <SelectContent>
                {DOCKS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.dockId && <p className="text-destructive text-xs">{errors.dockId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-select">Ventana horaria</Label>
            <Select
              value={timeSlot}
              onValueChange={(v) => {
                setTimeSlot(v)
                setErrors((e) => ({ ...e, timeSlot: undefined }))
              }}
            >
              <SelectTrigger id="slot-select" className="w-full">
                <SelectValue placeholder="Seleccionar ventana" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timeSlot && <p className="text-destructive text-xs">{errors.timeSlot}</p>}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="carrier-confirmed"
              checked={carrierConfirmed}
              onCheckedChange={setCarrierConfirmed}
            />
            <Label htmlFor="carrier-confirmed">Confirmado por transportista</Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
