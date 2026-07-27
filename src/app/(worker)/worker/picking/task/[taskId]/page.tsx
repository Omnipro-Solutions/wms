'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Hash, EyeOff, AlertTriangle, MapPin } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useLastPickMode } from '@/hooks/use-last-pick-mode'
import { WorkerWizardHeader } from '@/components/worker/worker-wizard-header'
import { WorkerActionBar } from '@/components/worker/worker-action-bar'
import { WorkerErrorBanner } from '@/components/worker/worker-error-banner'
import { WorkerTaskContext } from '@/components/worker/worker-task-context'
import { WorkerSuccess } from '@/components/worker/worker-success'
import { ScanInput } from '@/components/worker/scan-input'
import { WorkerQtyEntry } from '@/components/worker/worker-qty-entry'
import { PickModeSelect, type PickMode } from '@/components/worker/pick-mode-select'
import { formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

export default function WorkerPickingTaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { pickingTasks, products, locations, commerceOrders, settings, reasons, startPicking, completePick, approvePart, reportIssue } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)
  const order = commerceOrders.find((o) => o.id === task?.orderId)

  const { lastMode, remember } = useLastPickMode()
  const [step, setStepRaw] = useState<Step>('mode')
  // Historial de pasos para el botón "atrás" (retrocede por la ruta recorrida).
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  const [pickMode, setPickMode] = useState<PickMode | null>(null)
  const [qty, setQty] = useState(task?.requestedQuantity ?? 0)
  const [serialsRaw, setSerialsRaw] = useState('')
  const [partialReasonId, setPartialReasonId] = useState('')
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
  // Gobierno del conteo a ciegas: la política puede forzar o deshabilitar el modo,
  // quitándole al operario la posibilidad de evadir el control anti-sesgo.
  const blindPolicy = settings.pickingBlindMode ?? 'operator_choice'
  const effectiveMode: PickMode =
    blindPolicy === 'forced'
      ? 'blind'
      : blindPolicy === 'disabled'
        ? 'visible'
        : (pickMode ?? lastMode ?? 'visible')
  const blind = effectiveMode === 'blind'

  // Avanza registrando el paso actual; goBack retrocede (o sale al listado).
  const goStep = (next: Step) => {
    setPickError(null)
    setStepHistory((h) => [...h, step])
    setStepRaw(next)
  }
  const goBack = () => {
    setPickError(null)
    if (stepHistory.length === 0) {
      router.push('/worker/picking')
      return
    }
    const prev = stepHistory[stepHistory.length - 1]
    setStepHistory((h) => h.slice(0, -1))
    setStepRaw(prev)
  }

  const handleContinueFromMode = () => {
    remember(effectiveMode)
    setPickMode(effectiveMode)
    goStep('location')
  }

  const handleLocationMatch = () => {
    setPickError(null)
    try {
      if (task.status === 'assigned' || task.status === 'pending') {
        startPicking(task.id, operator?.name ?? 'Operador')
      }
      goStep('product')
    } catch (e: unknown) {
      setPickError(e instanceof Error ? e.message : 'Error al iniciar tarea')
    }
  }

  const handleProductMatch = () => {
    setQty(blind ? 0 : task.requestedQuantity)
    goStep('quantity')
  }

  const requiresSerial = product.trackBy === 'serial'
  const parsedSerials = serialsRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  // Reconciliación por tolerancia: en un pick a ciegas, si la varianza contra lo
  // solicitado supera la tolerancia configurada, se exige un motivo antes de confirmar.
  const tolerancePct = settings.pickingBlindVarianceTolerancePct ?? 10
  const variancePct =
    task.requestedQuantity > 0
      ? (Math.abs(task.requestedQuantity - qty) / task.requestedQuantity) * 100
      : 0
  const needsReason = blind && qty > 0 && variancePct > tolerancePct
  const partialReasons = reasons.filter((r) => r.context === 'partial_picking' && r.active)

  const handleConfirmQty = () => {
    setPickError(null)
    if (requiresSerial && qty > 0 && parsedSerials.length !== qty) {
      setPickError(`Captura ${qty} número(s) de serie, uno por unidad (van ${parsedSerials.length}).`)
      return
    }
    try {
      if (task.status === 'assigned' || task.status === 'pending') {
        startPicking(task.id, operator?.name ?? 'Operador')
      }
      // Abre la reconciliación ante un faltante o ante cualquier varianza ciega
      // que supere la tolerancia (incluye sobre-conteo).
      if (qty < task.requestedQuantity || needsReason) {
        setShowPartialDialog(true)
      } else {
        completePick(
          task.id,
          qty,
          undefined,
          requiresSerial ? parsedSerials : undefined,
          undefined,
          blind ? 'blind' : 'visible'
        )
        setConfirmed(true)
        setTimeout(() => {
          setConfirmed(false)
          goStep('done')
        }, 1500)
      }
    } catch (e: unknown) {
      setPickError(e instanceof Error ? e.message : 'Error al confirmar cantidad')
    }
  }

  const handleConfirmPartial = () => {
    setPickError(null)
    if (needsReason && !partialReasonId) {
      setPickError('Selecciona un motivo para la diferencia.')
      return
    }
    try {
      completePick(
        task.id,
        qty,
        needsReason ? partialReasonId : undefined,
        requiresSerial ? parsedSerials : undefined,
        undefined,
        blind ? 'blind' : 'visible'
      )
      if (qty < task.requestedQuantity) approvePart(task.id)
      setShowPartialDialog(false)
      goStep('done')
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
      <WorkerSuccess title="Pick completado" code={task.code}>
        {blind && (
          <div
            className={cn(
              'w-full rounded-xl border shadow-sm border-l-4 p-4 text-center',
              variance === 0 && 'border-l-[var(--worker-ok)] bg-[var(--worker-ok-surface)] text-[var(--worker-ok)]',
              variance > 0 && 'border-l-[var(--worker-info)] bg-[var(--worker-info-surface)] text-[var(--worker-info)]',
              variance < 0 && 'border-l-[var(--worker-danger)] bg-[var(--worker-danger-surface)] text-[var(--worker-danger)]'
            )}
          >
            <p className="font-mono text-xs tracking-widest uppercase opacity-80">Diferencia vs. solicitado</p>
            <p className="font-mono text-4xl font-black tabular-nums">
              {variance > 0 ? '+' : ''}
              {variance}
            </p>
            <p className="text-sm opacity-80">
              Solicitado: {task.requestedQuantity} · Contado: {qty}
            </p>
          </div>
        )}
        <Button variant="outline" className="h-12 w-full" onClick={() => router.push('/worker/picking')}>
          ← Ver mis tareas
        </Button>
      </WorkerSuccess>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerWizardHeader backHref="/worker/picking" current={stepIndex[step]} total={4} onBack={goBack} />

      <WorkerTaskContext
        code={task.code}
        meta={product.name}
        priority={task.priority}
        due={order ? `Entrega ${formatDate(order.promisedDeliveryDate)}` : undefined}
        progress={
          step === 'quantity' && !blind
            ? { current: qty, total: task.requestedQuantity, label: 'Cantidad', unit: 'uds' }
            : undefined
        }
      />

      {step === 'mode' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div>
            <p className="text-lg font-bold">
              {blindPolicy === 'operator_choice' ? '¿Cómo quieres contar esta tarea?' : 'Modo de conteo'}
            </p>
            <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
              Tarea {task.code}
            </p>
          </div>
          {blindPolicy === 'operator_choice' ? (
            <PickModeSelect value={pickMode ?? lastMode ?? 'visible'} onChange={setPickMode} />
          ) : (
            <div className="border-border bg-card flex items-center gap-4 rounded-xl border p-5 shadow-sm">
              <EyeOff className={cn('size-6', blind ? 'text-primary' : 'text-muted-foreground')} />
              <div>
                <p className="font-semibold">{blind ? 'A ciegas' : 'Cantidad visible'}</p>
                <p className="text-muted-foreground text-sm">
                  Definido por la configuración del almacén ({blind ? 'siempre a ciegas' : 'siempre visible'}).
                </p>
              </div>
            </div>
          )}
          <WorkerActionBar>
            <Button className="h-14 text-base" onClick={handleContinueFromMode}>
              Continuar
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'location' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border p-5 text-center shadow-sm">
            <p className="text-primary flex items-center justify-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase">
              <MapPin className="size-3.5" /> Ir a
            </p>
            <p className="mt-2 font-mono text-5xl leading-none font-black tracking-tight">
              {location.code}
            </p>
            <p className="text-muted-foreground mt-3 font-mono text-sm tracking-wider uppercase">
              Zona {location.zone}
            </p>
          </div>
          {product.imageUrl && (
            <div className="border-border bg-card flex items-center gap-3 rounded-xl border shadow-sm px-4 py-3">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-12 w-12 rounded-md object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
                  ×{task.requestedQuantity} uds
                </p>
              </div>
            </div>
          )}
          {pickError && <WorkerErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
          <Button
            variant="outline"
            className="h-11 w-full gap-2 border-[var(--worker-warn)]/40 text-[var(--worker-warn)]"
            onClick={() => setShowIssueDialog(true)}
          >
            <AlertTriangle className="size-4" /> Reportar incidencia
          </Button>
        </div>
      )}

      {step === 'product' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border shadow-sm p-4">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="mx-auto mb-3 h-24 w-24 rounded-md object-contain"
              />
            )}
            <p className="text-center text-lg font-bold">{product.name}</p>
            <p className="text-muted-foreground mt-1 text-center font-mono text-sm tracking-wide uppercase">
              SKU {product.sku}
            </p>
          </div>
          {pickError && <WorkerErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
          <Button
            variant="outline"
            className="h-11 w-full gap-2 border-[var(--worker-warn)]/40 text-[var(--worker-warn)]"
            onClick={() => setShowIssueDialog(true)}
          >
            <AlertTriangle className="size-4" /> Reportar incidencia
          </Button>
        </div>
      )}

      {step === 'quantity' && (
        <div className="animate-in fade-in-0 relative flex flex-col gap-6 duration-300">
          {confirmed && (
            <div className="animate-in fade-in-0 fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--worker-ok)] duration-200">
              <CheckCircle2 className="animate-in zoom-in-50 size-20 text-white duration-300" strokeWidth={2.5} />
              <p className="animate-in fade-in-0 slide-in-from-bottom-2 text-xl font-bold text-white delay-100 duration-300 [animation-fill-mode:both]">
                Confirmado
              </p>
            </div>
          )}
          {blind ? (
            <div className="border-border bg-card flex w-full flex-col items-center gap-2 rounded-xl border shadow-sm p-4 text-center">
              <Badge variant="outline" className="text-muted-foreground gap-1 font-mono text-xs uppercase">
                <EyeOff className="size-3" /> Modo ciego
              </Badge>
              <p className="text-muted-foreground text-sm">Cuenta lo que encuentres · {product.name}</p>
            </div>
          ) : (
            <div className="border-border bg-card w-full rounded-xl border shadow-sm p-4 text-center">
              <p className="text-muted-foreground font-mono text-xs font-semibold tracking-widest uppercase">
                Solicitado
              </p>
              <p className="mt-2 font-mono text-6xl leading-none font-black tabular-nums">
                {task.requestedQuantity}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{product.name}</p>
            </div>
          )}
          <div className="w-full">
            <p className="text-muted-foreground mb-2 text-center font-mono text-xs font-semibold tracking-wider uppercase">
              Cantidad a pickear
            </p>
            <WorkerQtyEntry value={qty} onChange={setQty} min={0} max={blind ? undefined : task.requestedQuantity} />
          </div>
          {requiresSerial && (
            <div className="w-full space-y-1">
              <Label htmlFor="worker-pick-serials" className="flex items-center gap-1">
                <Hash className="size-3" /> Números de serie (uno por unidad)
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Textarea
                id="worker-pick-serials"
                placeholder={`Escanea ${qty || ''} número(s) de serie, uno por línea…`}
                value={serialsRaw}
                onChange={(e) => setSerialsRaw(e.target.value)}
                className="min-h-24 font-mono text-base"
                rows={Math.min(Math.max(qty, 2), 6)}
              />
              <p
                className={cn(
                  'text-sm',
                  parsedSerials.length === qty && qty > 0
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
                )}
              >
                Series capturadas: {parsedSerials.length} / {qty}
              </p>
            </div>
          )}
          {pickError && <WorkerErrorBanner message={pickError} />}
          {!blind && qty < task.requestedQuantity && qty > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-[var(--worker-warn)]">
              <AlertTriangle className="size-4 shrink-0" /> Registrarás {task.requestedQuantity - qty} unidades
              menos que lo solicitado
            </p>
          )}
          <WorkerActionBar>
            <Button
              className="h-16 w-full text-lg font-bold"
              onClick={handleConfirmQty}
              disabled={qty === 0}
            >
              CONFIRMAR {qty} UDS
            </Button>
          </WorkerActionBar>
        </div>
      )}

      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent showCloseButton={false} data-worker-theme="">
          <DialogHeader>
            <DialogTitle className="text-center">
              {needsReason ? 'Confirmar diferencia' : '¿Confirmar cantidad parcial?'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {blind ? (
                <>
                  Vas a registrar <span className="text-4xl font-black tabular-nums text-foreground">{qty}</span>{' '}
                  unidades para este ítem.
                  <br />
                  <span className="text-sm">
                    {needsReason
                      ? 'La diferencia frente a lo esperado supera la tolerancia — indica el motivo.'
                      : 'Se marcará como parcial y verás la diferencia después de confirmar.'}
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
          {needsReason && (
            <div className="space-y-1.5">
              <Label htmlFor="worker-partial-reason">
                Motivo de la diferencia <span className="text-destructive">*</span>
              </Label>
              <select
                id="worker-partial-reason"
                value={partialReasonId}
                onChange={(e) => setPartialReasonId(e.target.value)}
                className="h-12 w-full rounded-md border bg-background px-3 text-base"
              >
                <option value="">Seleccionar…</option>
                {partialReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-14 w-full text-base font-bold"
              disabled={needsReason && !partialReasonId}
              onClick={handleConfirmPartial}
            >
              Confirmar {qty} uds
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowPartialDialog(false)}>
              Cancelar — seguir picando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent showCloseButton={false} data-worker-theme="">
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
            {issueError && <WorkerErrorBanner message={issueError} />}
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
