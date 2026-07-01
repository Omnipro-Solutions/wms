'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { ScanInput } from '@/components/worker/scan-input'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Step = 'location' | 'product' | 'quantity' | 'done'

export default function WorkerPickingTaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { pickingTasks, products, locations, startPicking, completePick, approvePart } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)

  const [step, setStep] = useState<Step>('location')
  const [qty, setQty] = useState(task?.requestedQuantity ?? 0)
  const [showPartialDialog, setShowPartialDialog] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)

  const ErrorBanner = ({ message }: { message: string }) => (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="mt-0.5 shrink-0">⚠️</span>
      <span>{message}</span>
    </div>
  )

  if (!task || !location || !product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Tarea no encontrada.</p>
      </div>
    )
  }

  const stepIndex = { location: 1, product: 2, quantity: 3, done: 4 }

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

  const handleProductMatch = () => setStep('quantity')

  const handleConfirmQty = () => {
    setPickError(null)
    try {
      // Ensure in_progress before completing
      if (task.status === 'assigned' || task.status === 'pending') {
        startPicking(task.id, operator?.name ?? 'Operador')
      }
      if (qty < task.requestedQuantity) {
        setShowPartialDialog(true)
      } else {
        completePick(task.id, qty)
        setStep('done')
      }
    } catch (e: unknown) {
      setPickError(e instanceof Error ? e.message : 'Error al confirmar cantidad')
    }
  }

  const handleConfirmPartial = () => {
    setPickError(null)
    try {
      completePick(task.id, qty)
      approvePart(task.id)
      setShowPartialDialog(false)
      setStep('done')
    } catch (e: unknown) {
      setShowPartialDialog(false)
      setPickError(e instanceof Error ? e.message : 'Error al registrar pick parcial')
    }
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">¡Pick completado!</p>
          <p className="text-sm text-muted-foreground mt-1">{task.code}</p>
        </div>
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
      <WorkerStepper current={stepIndex[step]} total={3} />

      {step === 'location' && (
        <div className="flex flex-col gap-4">
          {pickError && <ErrorBanner message={pickError} />}
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Zona</p>
            <p className="text-4xl font-black">{location.zone}</p>
            <p className="text-2xl font-bold text-muted-foreground">{location.code}</p>
          </div>
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
        </div>
      )}

      {step === 'product' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold text-lg">{product.name}</p>
            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          </div>
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
        </div>
      )}

      {step === 'quantity' && (
        <div className="flex flex-col gap-6 items-center">
          {pickError && <ErrorBanner message={pickError} />}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Solicitado</p>
            <p className="text-5xl font-black">{task.requestedQuantity}</p>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>
          <QuantityStepper value={qty} onChange={setQty} min={0} max={task.requestedQuantity} />
          <Button className="h-12 w-full text-base" onClick={handleConfirmQty}>
            CONFIRMAR
          </Button>
        </div>
      )}

      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Confirmar cantidad parcial?</DialogTitle>
            <DialogDescription>
              Registraste {qty} de {task.requestedQuantity} unidades. Se marcará como pick parcial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-12" onClick={() => setShowPartialDialog(false)}>
              Cancelar
            </Button>
            <Button className="h-12" onClick={handleConfirmPartial}>
              Confirmar parcial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
