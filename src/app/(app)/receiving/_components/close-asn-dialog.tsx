'use client'

import { AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCloseAsnDialog } from '../_hooks/use-close-asn-dialog'
import { ErrorBanner } from './error-banner'

export { useCloseAsnDialog } from '../_hooks/use-close-asn-dialog'
export type { CloseDialogData } from '../_hooks/use-close-asn-dialog'

const DISCREPANCY_REASONS = [
  { value: 'short_shipped', label: 'Proveedor envió menos de lo pactado' },
  { value: 'damaged', label: 'Unidades llegaron dañadas' },
  { value: 'refused', label: 'Unidades rechazadas por calidad' },
  { value: 'count_error', label: 'Error de conteo' },
]

interface Props {
  state: ReturnType<typeof useCloseAsnDialog>
}

export const CloseAsnDialog = ({ state }: Props) => {
  const { dialog, closeReason, setCloseReason, handleSubmit } = state

  return (
    <Dialog
      open={!!dialog.data}
      onOpenChange={(o) => {
        if (!o) dialog.close()
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b bg-linear-to-r from-red-50 to-rose-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-100">
              <XCircle className="size-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-base leading-snug font-semibold">
                Cerrar ASN con diferencia
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                Acción de supervisor. Cierra definitivamente el ASN con las unidades recibidas. Se
                genera reporte OTIF para el proveedor.
              </DialogDescription>
            </div>
          </div>

          {dialog.data && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                N° Aviso:{' '}
                <span className="text-foreground font-mono font-semibold">
                  {dialog.data.asnCode}
                </span>
              </span>
              <span className="text-muted-foreground">
                Proveedor:{' '}
                <span className="text-foreground font-medium">{dialog.data.supplierName}</span>
              </span>
              <span className="text-muted-foreground">
                Producto:{' '}
                <span className="text-foreground font-medium">{dialog.data.productName}</span>
              </span>
            </div>
          )}
        </div>

        {dialog.data && (
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-4">
                <AlertTriangle className="size-8 shrink-0 text-red-400" />
                <div>
                  <p className="text-xs font-semibold tracking-widest text-red-600 uppercase">
                    Unidades faltantes
                  </p>
                  <p className="mt-1 text-5xl leading-none font-bold text-red-800 tabular-nums">
                    {dialog.data.missingQty}
                  </p>
                  <p className="mt-1 text-xs text-red-600">Esta acción no se puede revertir</p>
                </div>
              </div>
              <div className="bg-muted/30 flex flex-col justify-center gap-2 rounded-xl border px-4 py-4">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Recibido
                  </p>
                  <p className="text-xl leading-none font-bold text-emerald-600 tabular-nums">
                    {dialog.data.receivedSoFar} uds
                  </p>
                </div>
                <div className="bg-border h-px" />
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Total esperado
                  </p>
                  <p className="text-foreground text-xl leading-none font-bold tabular-nums">
                    {dialog.data.expectedTotal} uds
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="close-reason" className="text-sm font-medium">
                Motivo del cierre con diferencia <span className="text-destructive">*</span>
              </Label>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger
                  id="close-reason"
                  className={cn('h-11', !closeReason && dialog.error && 'border-destructive')}
                >
                  <SelectValue placeholder="Selecciona el motivo…" />
                </SelectTrigger>
                <SelectContent>
                  {DISCREPANCY_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Obligatorio. Se incluye en el reporte OTIF enviado al proveedor.
              </p>
            </div>

            {dialog.error && <ErrorBanner message={dialog.error} />}
          </div>
        )}

        <div className="bg-muted/20 flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={dialog.close}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!closeReason}>
            <XCircle className="mr-1.5 size-4" /> Cerrar ASN con diferencia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
