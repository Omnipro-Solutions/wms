'use client'

import { useState } from 'react'
import {
  PackageCheck,
  Recycle,
  ShieldCheck,
  Trash2,
  XCircle,
  TriangleAlert,
  Settings2,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ChoiceCard, ChoiceCardGroup } from '@/components/ui/choice-card'
import { Separator } from '@/components/ui/separator'
import type { ReturnOrder } from '@/types/wms'

const DISPOSITION_OPTIONS: {
  value: ReturnOrder['disposition']
  label: string
  description: string
  icon: LucideIcon
  accent: 'emerald' | 'red' | 'amber' | 'blue' | 'neutral'
}[] = [
  {
    value: 'restock',
    label: 'Reingresar al stock',
    description: 'El producto vuelve al inventario disponible para venta.',
    icon: PackageCheck,
    accent: 'emerald',
  },
  {
    value: 'repair',
    label: 'Enviar a reparación',
    description: 'Requiere reparación antes de poder comercializarse.',
    icon: Recycle,
    accent: 'blue',
  },
  {
    value: 'quality_control',
    label: 'Control de calidad',
    description: 'Evaluación adicional por el equipo de QC.',
    icon: ShieldCheck,
    accent: 'amber',
  },
  {
    value: 'scrap',
    label: 'Enviar a desecho',
    description: 'El producto no es recuperable y se da de baja definitiva.',
    icon: Trash2,
    accent: 'red',
  },
  {
    value: 'rejected',
    label: 'Rechazar devolución',
    description: 'La devolución no cumple los criterios y se rechaza.',
    icon: XCircle,
    accent: 'neutral',
  },
]

interface Props {
  open: boolean
  rmaCode: string
  customerName: string
  currentDisposition: ReturnOrder['disposition']
  onConfirm: (disposition: ReturnOrder['disposition']) => void
  onClose: () => void
  error?: string
}

export const SetDispositionDialog = ({
  open,
  rmaCode,
  customerName,
  currentDisposition,
  onConfirm,
  onClose,
  error,
}: Props) => {
  const [disposition, setDisposition] = useState<ReturnOrder['disposition']>(currentDisposition)

  const handleConfirm = () => onConfirm(disposition)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-amber-600" />
            Definir disposición
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecciona la disposición para la devolución {rmaCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">RMA</span>
            <span className="font-medium">{rmaCode}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{customerName}</span>
          </div>

          <Separator />

          <ChoiceCardGroup
            value={disposition}
            onValueChange={(v) => setDisposition(v as ReturnOrder['disposition'])}
          >
            {DISPOSITION_OPTIONS.map((opt) => (
              <ChoiceCard
                key={opt.value}
                value={opt.value}
                icon={opt.icon}
                accent={opt.accent}
                title={opt.label}
                description={opt.description}
              />
            ))}
          </ChoiceCardGroup>

          {error && (
            <p className="text-destructive flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            <Settings2 className="mr-1 size-4" /> Confirmar disposición
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
