'use client'

import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ChoiceCard, ChoiceCardGroup } from '@/components/ui/choice-card'
import { useQcDialog } from '../_hooks/use-qc-dialog'
import type { Decision } from '../_hooks/use-qc-dialog'
import { ErrorBanner } from './error-banner'

export { useQcDialog } from '../_hooks/use-qc-dialog'
export type { QcDialogData } from '../_hooks/use-qc-dialog'

const MetaField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <span className="text-muted-foreground text-sm">
    {label}:{' '}
    <span className={cn('text-foreground font-medium', mono && 'font-mono font-semibold')}>
      {value}
    </span>
  </span>
)

interface Props {
  state: ReturnType<typeof useQcDialog>
}

export const QcDialog = ({ state }: Props) => {
  const { dialog, decision, setDecision, handleApprove, handleReject, close } = state

  const handleOpenChange = (open: boolean) => {
    if (!open) close()
  }

  const handleConfirm = () => {
    if (decision === 'approve') handleApprove()
    else if (decision === 'reject') handleReject()
  }

  if (!dialog.data) return null

  const { asnCode, supplierName, productName, blockedQty } = dialog.data

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg! gap-0 overflow-hidden p-0">
        <div className="border-b bg-linear-to-r from-amber-50 to-yellow-50 px-6 py-5">
          <div className="flex items-start gap-3 py-2">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-100">
              <ShieldCheck className="size-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug font-semibold">
                Inspección de calidad
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                Selecciona una decisión para el lote y confirma.
              </DialogDescription>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl leading-none font-bold text-amber-800 tabular-nums">
                {blockedQty}
              </p>
              <p className="mt-0.5 text-[10px] font-medium tracking-wide text-amber-600 uppercase">
                uds bloqueadas
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
            <MetaField label="N° Aviso" value={asnCode} mono />
            <MetaField label="Proveedor" value={supplierName} />
            <MetaField label="Producto" value={productName} />
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            ¿Qué hacemos con este lote?
          </p>
          <ChoiceCardGroup value={decision} onValueChange={(v) => setDecision(v as Decision)}>
            <ChoiceCard
              value="approve"
              accent="emerald"
              icon={CheckCircle2}
              title="Aprobar lote"
              description={`Las ${blockedQty} unidades salen de zona QC y pasan al área de ingreso para ser ubicadas. El stock quedará disponible para picking.`}
            />
            <ChoiceCard
              value="reject"
              accent="red"
              icon={XCircle}
              title="Rechazar lote"
              description="Las unidades permanecen bloqueadas en zona QC. Se debe coordinar devolución o destrucción con el proveedor."
            />
          </ChoiceCardGroup>

          {dialog.error && <ErrorBanner message={dialog.error} />}
        </div>

        <div className="bg-muted/20 flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!decision}
            onClick={handleConfirm}
            className={cn(
              'min-w-36 transition-colors',
              decision === 'approve' && 'bg-emerald-600 hover:bg-emerald-700',
              decision === 'reject' && 'bg-red-600 hover:bg-red-700'
            )}
          >
            {decision === 'approve' && <CheckCircle2 className="mr-1.5 size-4" />}
            {decision === 'reject' && <XCircle className="mr-1.5 size-4" />}
            {decision === 'approve'
              ? 'Aprobar lote'
              : decision === 'reject'
                ? 'Rechazar lote'
                : 'Confirmar decisión'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
