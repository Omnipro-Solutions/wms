'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { isDockCompatible, suggestDock } from '@/lib/rules/yard'
import { Badge } from '@/components/ui/badge'
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
  const { docks, assignDock, dockAppointments, asnRecords, locations } = useWmsStore()
  const [dockId, setDockId] = useState(appointment.dockId ?? '')
  const [error, setError] = useState('')

  const compatibleDocks = docks.filter(
    (d) =>
      d.warehouseId === appointment.warehouseId &&
      d.status === 'active' &&
      isDockCompatible(d, appointment.type)
  )

  // Ranking por tipo de tráfico, conflicto de agenda y cercanía al despacho.
  const ranked = useMemo(() => {
    const source = dockAppointments.find((a) => a.id === appointment.id)
    const asn = source?.asnId ? asnRecords.find((a) => a.id === source.asnId) : undefined
    return suggestDock(appointment, docks, dockAppointments, asn, locations)
  }, [appointment, docks, dockAppointments, asnRecords, locations])

  const best = ranked.find((r) => r.score > 0)

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
      {best && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">
                Sugerido: {best.dock.code} — {best.dock.name}
              </span>
            </div>
            <Badge variant="outline">{best.score}/100</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{best.reasons.join(' · ')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              setDockId(best.dock.id)
              setError('')
            }}
          >
            Usar sugerencia
          </Button>
        </div>
      )}

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
