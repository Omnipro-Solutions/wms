'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Printer, Circle } from 'lucide-react'
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
  const pending = labels.length - printed
  const allPrinted = printed === labels.length
  const progressPct = Math.round((printed / labels.length) * 100)

  const handlePrintAll = () => {
    labels.forEach((l) => {
      if (l.status === 'pending') printReceiptLabel(l.id)
    })
  }

  const handleContinue = () => {
    setOpen(false)
    if (canQc) router.push('?tab=qc')
    else if (canPutaway) router.push('?tab=putaway')
  }

  const handleLabelClose = (label: WmsLabel) => {
    setPreviewLabel(null)
    if (label.status === 'pending') printReceiptLabel(label.id)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
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
          {allPrinted ? 'Ver etiquetas' : `${printed}/${labels.length} impresas`}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          {/* Header with progress */}
          <div
            className={cn(
              'border-b px-5 pt-5 pb-4',
              allPrinted ? 'border-emerald-100 bg-emerald-50' : 'bg-muted/40'
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Printer className="size-4" />
                Etiquetas de recepción
              </DialogTitle>
            </DialogHeader>

            {/* Progress bar */}
            <div className="mt-3 space-y-1.5">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  {printed} impresa{printed !== 1 ? 's' : ''}
                </span>
                <span className="font-medium">{progressPct}%</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    allPrinted ? 'bg-emerald-500' : 'bg-primary'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {allPrinted
                  ? 'Todas las etiquetas han sido impresas'
                  : `${pending} etiqueta${pending !== 1 ? 's' : ''} pendiente${pending !== 1 ? 's' : ''} de imprimir`}
              </p>
            </div>

            {/* Print all — prominent, in the header area */}
            {!allPrinted && (
              <Button onClick={handlePrintAll} className="mt-3 w-full gap-2" size="sm">
                <Printer className="size-4" />
                Enviar todas a imprimir ({pending})
              </Button>
            )}
          </div>

          {/* Label list */}
          <div className="max-h-72 divide-y overflow-y-auto">
            {labels.map((label) => {
              const done = label.status === 'completed'
              return (
                <div
                  key={label.id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3',
                    done ? 'bg-emerald-50/50' : 'hover:bg-muted/30'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="text-muted-foreground/50 size-4 shrink-0" />
                  )}
                  <span
                    className={cn(
                      'flex-1 font-mono text-xs',
                      done ? 'text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {label.code}
                  </span>
                  <span
                    className={cn(
                      'w-16 text-right text-xs font-medium',
                      done ? 'text-emerald-600' : 'text-amber-600'
                    )}
                  >
                    {done ? 'Impresa' : 'Pendiente'}
                  </span>
                  <Button
                    size="sm"
                    variant={done ? 'ghost' : 'outline'}
                    className="h-7 shrink-0 text-xs"
                    onClick={() => setPreviewLabel(label)}
                  >
                    {done ? 'Reimprimir' : 'Imprimir'}
                  </Button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <DialogFooter className="bg-muted/20 m-0! flex-col gap-2 border-t px-5 py-4 sm:flex-col">
            {allPrinted && (canQc || canPutaway) && (
              <Button
                onClick={handleContinue}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
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
