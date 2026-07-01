'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { Button } from '@/components/ui/button'
import { suggestBox } from '@/lib/rules/packing'

type Step = 'rules' | 'items' | 'box' | 'label' | 'done'

export default function WorkerPackingOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { packingOrders, packingBoxTypes, packingRules, startPacking, scanItem, applyPackingRule, selectBox, generateLabel, sendToShipping } =
    useWmsStore()

  const order = packingOrders.find((o) => o.id === orderId)

  const activeRules = packingRules.filter((r) => order?.appliedRuleIds?.includes(r.id) ?? false)
  const hasRules = activeRules.length > 0

  // ponytail: hooks before guard — useState initialises once; hasRules is false when order is undefined, safe default
  const [step, setStep] = useState<Step>(hasRules ? 'rules' : 'items')
  const [scannedCount, setScannedCount] = useState(0)
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [showBoxList, setShowBoxList] = useState(false)

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada.</p>
      </div>
    )
  }

  const stepIndex: Record<Step, number> = { rules: 1, items: hasRules ? 2 : 1, box: hasRules ? 3 : 2, label: hasRules ? 4 : 3, done: hasRules ? 5 : 4 }
  const totalSteps = hasRules ? 4 : 3

  const suggested = suggestBox(order.weightKg, order.volumeM3, packingBoxTypes)

  const handleStartItems = () => {
    startPacking(order.id, operator?.name ?? 'Empacador')
    setStep('items')
  }

  const handleScanItem = () => {
    scanItem(order.id, scannedCount + 1)
    const next = scannedCount + 1
    setScannedCount(next)
    if (next >= order.expectedItems) setStep('box')
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

      {step === 'items' && (
        <div className="flex flex-col gap-4 items-center">
          <WorkerStepper current={scannedCount + 1} total={order.expectedItems} />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Ítem {scannedCount + 1} de {order.expectedItems}</p>
            <p className="text-xl font-bold mt-1">{order.items?.[scannedCount]?.productName ?? 'Producto'}</p>
          </div>
          <Button className="h-12 w-full text-base" onClick={handleScanItem}>
            ✓ ESCANEAR ÍTEM
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
