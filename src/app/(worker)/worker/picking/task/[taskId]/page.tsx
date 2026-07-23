'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Hash, EyeOff } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useLastPickMode } from '@/hooks/use-last-pick-mode'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { ScanInput } from '@/components/worker/scan-input'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { PickModeSelect, type PickMode } from '@/components/worker/pick-mode-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Step = 'mode' | 'location' | 'product' | 'quantity' | 'done'

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <span className="mt-0.5 shrink-0">⚠️</span>
    <span>{message}</span>
  </div>
)

export default function WorkerPickingTaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { pickingTasks, products, locations, settings, reasons, startPicking, completePick, approvePart, reportIssue } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)

  const { lastMode, remember } = useLastPickMode()
  const [step, setStep] = useState<Step>('mode')
  const [pickMode, setPickMode] = useState<PickMode | null>(null)
  const [qty, setQty] = useState(task?.requestedQuantity ?? 0)
  const [serial, setSerial] = useState('')
  const [showPartialDialog, setShowPartialDialog] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [issueReasonId, setIssueReasonId] = useState('')
  const [issuePhotoUrl, setIssuePhotoUrl] = useState<string | undefined>(undefined)
  const [issueError, setIssueError] = useState<string | null>(null)

  if (!task || !location || !product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Tarea no encontrada.</p>
      </div>
    )
  }

  const stepIndex = { mode: 1, location: 2, product: 3, quantity: 4, done: 5 }
  const effectiveMode: PickMode = pickMode ?? lastMode ?? 'visible'
  const blind = effectiveMode === 'blind'

  const handleContinueFromMode = () => {
    remember(effectiveMode)
    setPickMode(effectiveMode)
    setStep('location')
  }

  const handleLocationMatch = () => {
    setPickError(null)
    try {
      if (task.status === 'assigned' || task.status === 'pending') {
        startPicking(task.id, operator?.name ?? 'Operador')
      }
      setStep('product')
    } catch (e: unknown) {
      setPickError(e instanceof Error ? e.message : 'Error al iniciar tarea')
    }
  }

  const handleProductMatch = () => {
    setQty(blind ? 0 : task.requestedQuantity)
    setStep('quantity')
  }

  const requiresSerial = product.trackBy === 'serial'

  const handleConfirmQty = () => {
    setPickError(null)
    if (requiresSerial && qty > 0 && !serial.trim()) {
      setPickError('Este producto requiere captura de serial.')
      return
    }
    try {
      if (task.status === 'assigned' || task.status === 'pending') {
        startPicking(task.id, operator?.name ?? 'Operador')
      }
      if (qty < task.requestedQuantity) {
        setShowPartialDialog(true)
      } else {
        completePick(task.id, qty, undefined, serial.trim() || undefined)
        setConfirmed(true)
        setTimeout(() => {
          setConfirmed(false)
          setStep('done')
        }, 1500)
      }
    } catch (e: unknown) {
      setPickError(e instanceof Error ? e.message : 'Error al confirmar cantidad')
    }
  }

  const handleConfirmPartial = () => {
    setPickError(null)
    try {
      completePick(task.id, qty, undefined, serial.trim() || undefined)
      approvePart(task.id)
      setShowPartialDialog(false)
      setStep('done')
    } catch (e: unknown) {
      setShowPartialDialog(false)
      setPickError(e instanceof Error ? e.message : 'Error al registrar pick parcial')
    }
  }

  const issueReasons = reasons.filter((r) => r.context === 'picking_issue' && r.active)

  const handleIssuePhoto = (file: File | undefined) => {
    if (!file) {
      setIssuePhotoUrl(undefined)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setIssuePhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmitIssue = () => {
    setIssueError(null)
    if (!issueReasonId) {
      setIssueError('Selecciona un motivo.')
      return
    }
    if (settings.pickingRequireIssuePhoto && !issuePhotoUrl) {
      setIssueError('Se requiere una foto para reportar la incidencia.')
      return
    }
    try {
      reportIssue(task.id, issueReasonId, '', issuePhotoUrl)
      setShowIssueDialog(false)
      router.push('/worker/picking')
    } catch (e: unknown) {
      setIssueError(e instanceof Error ? e.message : 'Error al reportar incidencia')
    }
  }

  if (step === 'done') {
    const variance = qty - task.requestedQuantity
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">¡Pick completado!</p>
          <p className="text-sm text-muted-foreground mt-1">{task.code}</p>
        </div>
        {blind && (
          <div
            className={cn(
              'w-full rounded-2xl border p-4 text-center',
              variance === 0 && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              variance > 0 && 'border-blue-200 bg-blue-50 text-blue-700',
              variance < 0 && 'border-red-200 bg-red-50 text-red-700'
            )}
          >
            <p className="text-xs uppercase tracking-wide opacity-70">Diferencia vs. lo solicitado</p>
            <p className="text-4xl font-black tabular-nums">
              {variance > 0 ? '+' : ''}
              {variance}
            </p>
            <p className="text-sm opacity-70">
              Solicitado: {task.requestedQuantity} · Contado: {qty}
            </p>
          </div>
        )}
        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" className="h-12" onClick={() => router.push('/worker/picking')}>
            ← Ver mis tareas
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={4} />

      {step === 'mode' && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-lg font-bold">¿Cómo quieres contar esta tarea?</p>
            <p className="text-sm text-muted-foreground">Tarea {task.code}</p>
          </div>
          <PickModeSelect value={pickMode ?? lastMode ?? 'visible'} onChange={setPickMode} />
          <Button className="h-14 text-base" onClick={handleContinueFromMode}>
            Continuar
          </Button>
        </div>
      )}

      {step === 'location' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-linear-to-br from-(--worker-gradient-soft-from) to-(--worker-gradient-soft-to) p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Zona</p>
            <p className="text-5xl font-black">{location.zone}</p>
            <p className="text-3xl font-bold text-muted-foreground">{location.code}</p>
          </div>
          {product.imageUrl && (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-12 w-12 rounded-lg object-contain"
              />
              <div>
                <p className="text-sm font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">× {task.requestedQuantity} uds</p>
              </div>
            </div>
          )}
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
          <Button variant="outline" className="h-11 w-full text-amber-700" onClick={() => setShowIssueDialog(true)}>
            ⚠️ Reportar incidencia
          </Button>
        </div>
      )}

      {step === 'product' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="mx-auto mb-3 h-24 w-24 rounded-xl object-contain"
              />
            )}
            <p className="text-center text-lg font-bold">{product.name}</p>
            <p className="text-center text-sm text-muted-foreground">SKU: {product.sku}</p>
          </div>
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
          <Button variant="outline" className="h-11 w-full text-amber-700" onClick={() => setShowIssueDialog(true)}>
            ⚠️ Reportar incidencia
          </Button>
        </div>
      )}

      {step === 'quantity' && (
        <div className="relative flex flex-col items-center gap-6">
          {confirmed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-emerald-500/90">
              <CheckCircle2 className="size-20 text-white" />
              <p className="text-xl font-bold text-white">¡Confirmado!</p>
            </div>
          )}
          {blind ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-muted p-4 text-center">
              <Badge variant="outline" className="text-muted-foreground">
                <EyeOff className="mr-1 size-3" /> Modo ciego — cuenta lo que encuentres
              </Badge>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          ) : (
            <div className="w-full rounded-2xl bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Solicitado</p>
              <p className="text-6xl font-black tabular-nums">{task.requestedQuantity}</p>
              <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
            </div>
          )}
          <div className="w-full">
            <p className="mb-2 text-center text-sm font-medium text-muted-foreground">Cantidad a picar</p>
            <QuantityStepper value={qty} onChange={setQty} min={0} max={blind ? undefined : task.requestedQuantity} />
          </div>
          {requiresSerial && (
            <div className="w-full space-y-1">
              <Label htmlFor="worker-pick-serial" className="flex items-center gap-1">
                <Hash className="size-3" /> Serial del producto
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="worker-pick-serial"
                placeholder="Escanear o ingresar serial…"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="h-12 font-mono text-base"
              />
            </div>
          )}
          {pickError && <ErrorBanner message={pickError} />}
          <Button
            className="h-16 w-full text-lg font-bold"
            onClick={handleConfirmQty}
            disabled={qty === 0}
          >
            CONFIRMAR {qty} UDS
          </Button>
          {!blind && qty < task.requestedQuantity && qty > 0 && (
            <p className="text-sm text-amber-600">
              ⚠️ Registrarás {task.requestedQuantity - qty} unidades menos que lo solicitado
            </p>
          )}
        </div>
      )}

      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center">¿Confirmar cantidad parcial?</DialogTitle>
            <DialogDescription className="text-center">
              {blind ? (
                <>
                  Vas a registrar <span className="text-4xl font-black tabular-nums text-foreground">{qty}</span>{' '}
                  unidades para este ítem.
                  <br />
                  <span className="text-sm">
                    Es menos de lo que se esperaba — se marcará como parcial y verás la diferencia después de
                    confirmar.
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-black tabular-nums text-foreground">
                    {qty}
                  </span>
                  <span className="text-2xl font-medium text-muted-foreground">
                    {' '}/{' '}{task.requestedQuantity}
                  </span>
                  <br />
                  <span className="text-sm">unidades — se marcará como pick parcial</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="h-14 w-full text-base font-bold" onClick={handleConfirmPartial}>
              Confirmar {qty} uds (parcial)
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowPartialDialog(false)}>
              Cancelar — seguir picando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center">Reportar incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="worker-issue-reason">Motivo</Label>
              <select
                id="worker-issue-reason"
                value={issueReasonId}
                onChange={(e) => setIssueReasonId(e.target.value)}
                className="h-12 w-full rounded-md border bg-background px-3 text-base"
              >
                <option value="">Seleccionar…</option>
                {issueReasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker-issue-photo">
                Foto {settings.pickingRequireIssuePhoto && <span className="text-destructive">*</span>}
              </Label>
              <input
                id="worker-issue-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleIssuePhoto(e.target.files?.[0])}
                className="block w-full text-sm"
              />
              {issuePhotoUrl && (
                <img src={issuePhotoUrl} alt="Foto de incidencia" className="mt-2 h-20 w-20 rounded-lg object-cover" />
              )}
            </div>
            {issueError && <ErrorBanner message={issueError} />}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="h-14 w-full text-base font-bold" onClick={handleSubmitIssue}>
              Enviar incidencia
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowIssueDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
