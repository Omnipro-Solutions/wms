'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { Button } from '@/components/ui/button'
import { ScanInput } from '@/components/worker/scan-input'
import { suggestBox } from '@/lib/rules/packing'

type Step = 'rules' | 'items' | 'box' | 'label' | 'done'

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <span className="mt-0.5 shrink-0">⚠️</span>
    <span>{message}</span>
  </div>
)

export default function WorkerPackingOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { packingOrders, packingBoxTypes, packingRules, products, startPacking, scanItem, applyPackingRule, selectBox, generateLabel, sendToShipping } =
    useWmsStore()

  const order = packingOrders.find((o) => o.id === orderId)

  const activeRules = packingRules.filter((r) => order?.appliedRuleIds?.includes(r.id) ?? false)
  const hasRules = activeRules.length > 0

  // ponytail: hooks before guard — useState initialises once; hasRules is false when order is undefined, safe default
  const [step, setStep] = useState<Step>(hasRules ? 'rules' : 'items')
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [showBoxList, setShowBoxList] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada.</p>
      </div>
    )
  }

  const pendingLine = order.items?.find((i) => i.scannedQuantity < i.requestedQuantity)
  const pendingProduct = products.find((p) => p.id === pendingLine?.productId)
  const lineCount = order.items?.length ?? 0
  const completedLines = order.items?.filter((i) => i.scannedQuantity >= i.requestedQuantity).length ?? 0

  const stepIndex: Record<Step, number> = { rules: 1, items: hasRules ? 2 : 1, box: hasRules ? 3 : 2, label: hasRules ? 4 : 3, done: hasRules ? 5 : 4 }
  const totalSteps = hasRules ? 4 : 3

  const suggested = suggestBox(order.weightKg, order.volumeM3, packingBoxTypes)

  const handleStartItems = () => {
    startPacking(order.id, operator?.name ?? 'Empacador')
    setStep('items')
  }

  const handleLineMatch = () => {
    if (!pendingLine) return
    setScanError(null)
    if (order.status === 'pending') startPacking(order.id, operator?.name ?? 'Empacador')
    scanItem(order.id, pendingLine.productId, pendingLine.requestedQuantity)
    const remaining = (order.items?.length ?? 0) - completedLines - 1
    if (remaining <= 0) setStep('box')
  }

  const handleLineError = (scanned: string) => {
    setScanError(`Código incorrecto: ${scanned}. Esperado: ${pendingProduct?.barcode ?? pendingProduct?.sku}`)
  }

  const handleSkipVerification = () => {
    if (!pendingLine) return
    setScanError(null)
    handleLineMatch()
  }

  const handleSelectBox = (boxTypeId: string) => {
    selectBox(order.id, boxTypeId)
    setSelectedBoxId(boxTypeId)
    setStep('label')
  }

  const handleGenerateLabel = () => {
    generateLabel(order.id)
    sendToShipping(order.id)
    setStep('done')
  }

  const handleDone = () => {
    router.push('/worker/packing')
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">¡Empaque completado!</p>
          <p className="text-sm text-muted-foreground mt-1">{order.orderNumber ?? order.id}</p>
        </div>
        <Button className="h-12 w-full" onClick={handleDone}>← Ver cola</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={totalSteps} />

      {step === 'rules' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">⚠ Reglas de manejo</h2>
          <div className="flex flex-col gap-2">
            {activeRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="font-semibold">{rule.name}</p>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              </div>
            ))}
          </div>
          <Button className="h-12 text-base" onClick={handleStartItems}>
            ENTENDIDO, CONTINUAR
          </Button>
        </div>
      )}

      {step === 'items' && pendingLine && (
        <div className="flex flex-col gap-4">
          <WorkerStepper current={completedLines + 1} total={lineCount} />
          <div className="bg-muted rounded-xl p-4">
            {pendingProduct?.imageUrl && (
              <img
                src={pendingProduct.imageUrl}
                alt={pendingProduct.name}
                className="mx-auto mb-3 h-20 w-20 rounded-lg object-contain"
              />
            )}
            <p className="text-center text-lg font-bold">{pendingLine.productName}</p>
            <p className="text-muted-foreground text-center text-sm">SKU: {pendingProduct?.sku ?? 'N/A'}</p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Cantidad: <span className="text-foreground font-bold">{pendingLine.requestedQuantity}</span> uds
            </p>
          </div>
          <ScanInput
            label="Escanea el producto"
            expectedValue={pendingProduct?.barcode ?? pendingProduct?.sku ?? ''}
            onMatch={handleLineMatch}
            onError={handleLineError}
          />
          {scanError && <ErrorBanner message={scanError} />}
          <Button variant="outline" className="h-10 text-sm" onClick={handleSkipVerification}>
            Omitir verificación
          </Button>
        </div>
      )}

      {step === 'box' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Seleccionar caja</h2>
          {suggested && !showBoxList && (
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sugerida</p>
              <p className="font-bold text-lg">📦 {suggested.name}</p>
              <p className="text-sm text-muted-foreground">
                {suggested.dimensionsCm} · máx {suggested.maxWeightKg}kg
              </p>
              <Button className="h-12 w-full mt-3 text-base" onClick={() => handleSelectBox(suggested.id)}>
                ✅ USAR ESTA CAJA
              </Button>
            </div>
          )}
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowBoxList(true)}>
            Elegir otra caja
          </Button>
          {showBoxList && (
            <div className="flex flex-col gap-2">
              {packingBoxTypes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => handleSelectBox(box.id)}
                  className="rounded-xl border p-4 text-left active:bg-muted"
                >
                  <p className="font-semibold">{box.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {box.dimensionsCm} · máx {box.maxWeightKg}kg
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'label' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Generar etiqueta</h2>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Orden</p>
            <p className="font-bold">{order.orderNumber ?? order.id}</p>
            <p className="text-sm text-muted-foreground mt-2">Cliente</p>
            <p className="font-semibold">{order.customerName}</p>
          </div>
          <Button className="h-12 text-base" onClick={handleGenerateLabel}>
            🖨 GENERAR ETIQUETA
          </Button>
        </div>
      )}
    </div>
  )
}
