'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { Button } from '@/components/ui/button'

type Step = 'summary' | 'receive' | 'qc' | 'putaway' | 'done'

export default function WorkerReceivingAsnPage() {
  const { asnId } = useParams<{ asnId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { asnRecords, products, locations, receiveAsn, approveQc, rejectQc, putawayItem } = useWmsStore()

  const asn = asnRecords.find((a) => a.id === asnId)
  const product = products.find((p) => p.id === asn?.productId)
  const suggestedLocation = locations.find((l) => l.id === asn?.suggestedPutawayLocationId)

  const [step, setStep] = useState<Step>('summary')
  const [recQty, setRecQty] = useState(asn?.expectedQuantity ?? 0)
  const [dmgQty, setDmgQty] = useState(0)

  if (!asn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">ASN no encontrado.</p>
      </div>
    )
  }

  const opName = operator?.name ?? 'Operador'
  const hasQc = asn.requiresQualityControl
  const stepIndex: Record<Step, number> = hasQc
    ? { summary: 1, receive: 2, qc: 3, putaway: 4, done: 5 }
    : { summary: 1, receive: 2, qc: 2, putaway: 3, done: 4 }
  const totalSteps = hasQc ? 4 : 3

  const handleReceive = () => {
    receiveAsn(asn.id, recQty, opName, dmgQty)
    if (asn.requiresQualityControl) {
      setStep('qc')
    } else {
      setStep('putaway')
    }
  }

  const handleApproveQc = () => { approveQc(asn.id, opName); setStep('putaway') }
  const handleRejectQc = () => { rejectQc(asn.id, opName); setStep('done') }

  const handlePutaway = () => {
    if (suggestedLocation) {
      putawayItem(asn.id, suggestedLocation.id, opName)
    }
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">ASN recibido</p>
          <p className="text-sm text-muted-foreground mt-1">{asn.code}</p>
          <p className="text-sm text-muted-foreground">
            {recQty} recibidas · {dmgQty} dañadas
          </p>
        </div>
        <Button className="h-12 w-full" onClick={() => router.push('/worker/receiving')}>
          ← Volver a recepciones
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={totalSteps} />

      {step === 'summary' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold text-lg">{asn.code}</p>
            <p className="text-sm text-muted-foreground">{asn.supplierName}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">{asn.receivedQuantity}</span>
              <span className="text-muted-foreground"> / {asn.expectedQuantity} uds recibidas</span>
            </p>
          </div>
          <Button className="h-12 text-base" onClick={() => setStep('receive')}>
            {asn.status === 'in_progress' ? '▶ CONTINUAR RECIBIENDO' : '▶ INICIAR RECEPCIÓN'}
          </Button>
        </div>
      )}

      {step === 'receive' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-sm text-muted-foreground">SKU: {product?.sku ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Esperado: {asn.expectedQuantity} uds</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Cantidad recibida</p>
            <QuantityStepper value={recQty} onChange={setRecQty} min={0} max={asn.expectedQuantity + 10} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">¿Dañadas?</p>
            <QuantityStepper value={dmgQty} onChange={setDmgQty} min={0} max={recQty} />
          </div>
          <Button className="h-12 text-base" onClick={handleReceive}>
            RECIBIR ÍTEM
          </Button>
        </div>
      )}

      {step === 'qc' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Control de calidad</h2>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Recibidas: {recQty} · Dañadas: {dmgQty}</p>
          </div>
          <Button className="h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveQc}>
            ✅ APROBAR QC
          </Button>
          <Button variant="destructive" className="h-12 text-base" onClick={handleRejectQc}>
            ❌ RECHAZAR QC
          </Button>
        </div>
      )}

      {step === 'putaway' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Ubicar mercancía</h2>
          {suggestedLocation ? (
            <div className="rounded-xl bg-muted p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Llevar a</p>
              <p className="text-4xl font-black">{suggestedLocation.zone}</p>
              <p className="text-2xl font-bold text-muted-foreground">{suggestedLocation.code}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ubicación sugerida — ubicar manualmente.</p>
          )}
          <Button className="h-12 text-base" onClick={handlePutaway}>
            ✅ CONFIRMAR UBICACIÓN
          </Button>
        </div>
      )}
    </div>
  )
}
