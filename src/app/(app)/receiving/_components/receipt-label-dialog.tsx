'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWmsStore } from '@/store/wms-store'
import { ZplPreviewDialog } from '@/app/(app)/labels/_components/zpl-preview-dialog'
import { cn } from '@/lib/utils'
import type { WmsLabel } from '@/types/wms'

// ── Single label button (kept for backwards compatibility) ─────────────────
interface SingleProps {
  label: WmsLabel
}

export const ReceiptLabelButton = ({ label }: SingleProps) => {
  const [open, setOpen] = useState(false)
  const { printReceiptLabel } = useWmsStore()

  const handleClose = () => {
    setOpen(false)
    if (label.status === 'pending') {
      printReceiptLabel(label.id)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={label.status === 'completed' ? 'outline' : 'default'}
        onClick={() => setOpen(true)}
        className="h-7 gap-1 text-xs"
      >
        <Printer className="size-3" />
        {label.status === 'completed' ? 'Reimprimir' : 'Imprimir'}
      </Button>
      <ZplPreviewDialog label={label} open={open} onClose={handleClose} />
    </>
  )
}

// ── Bulk labels button + dialog ────────────────────────────────────────────
interface BulkProps {
  labels: WmsLabel[]
  canQc: boolean
  canPutaway: boolean
}

export const ReceiptLabelsBulkButton = ({ labels, canQc, canPutaway }: BulkProps) => {
  const [open, setOpen] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<WmsLabel | null>(null)
  const { printReceiptLabel } = useWmsStore()
  const router = useRouter()

  if (labels.length === 0) return <span className="text-muted-foreground text-xs">—</span>

  const printed = labels.filter((l) => l.status === 'completed').length
  const allPrinted = printed === labels.length

  const handlePrintAll = () => {
    labels.forEach((l) => {
      if (l.status === 'pending') printReceiptLabel(l.id)
    })
  }

  const handleContinue = () => {
    setOpen(false)
    if (canQc) {
      router.push('?tab=qc')
    } else if (canPutaway) {
      router.push('?tab=putaway')
    }
  }

  const handleLabelClose = (label: WmsLabel) => {
    setPreviewLabel(null)
    if (label.status === 'pending') {
      printReceiptLabel(label.id)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-xs font-medium',
            allPrinted ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {printed}/{labels.length} impresas
        </span>
        <Button
          size="sm"
          variant={allPrinted ? 'outline' : 'default'}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          className="h-7 gap-1 text-xs"
        >
          <Printer className="size-3" />
          {allPrinted ? 'Ver etiquetas' : 'Imprimir etiquetas'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="size-4" />
              Etiquetas de recepción
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {label.status === 'completed' ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Printer className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono text-xs">{label.code}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      label.status === 'completed'
                        ? 'border-emerald-300 text-emerald-700'
                        : 'border-amber-300 text-amber-700'
                    )}
                  >
                    {label.status === 'completed' ? 'Impresa' : 'Pendiente'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setPreviewLabel(label)}
                >
                  <Printer className="size-3" />
                  {label.status === 'completed' ? 'Reimprimir' : 'Imprimir'}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {!allPrinted && (
              <Button onClick={handlePrintAll} className="w-full gap-1">
                <Printer className="size-4" /> Imprimir todas
              </Button>
            )}
            {allPrinted && (canQc || canPutaway) && (
              <Button
                onClick={handleContinue}
                className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4" />
                Continuar → {canQc ? 'Control de calidad' : 'Ubicar mercancía'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewLabel && (
        <ZplPreviewDialog
          label={previewLabel}
          open={!!previewLabel}
          onClose={() => handleLabelClose(previewLabel)}
        />
      )}
    </>
  )
}
