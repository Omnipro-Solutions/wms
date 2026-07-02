'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Printer } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { Button } from '@/components/ui/button'
import { BarcodeScanner } from '@/components/shared/barcode-scanner'

type Step = 'summary' | 'scan-product' | 'receive' | 'serials' | 'qc' | 'putaway' | 'print-label' | 'done'

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <span className="mt-0.5 shrink-0">⚠️</span>
    <span>{message}</span>
  </div>
)

export default function WorkerReceivingAsnPage() {
  const { asnId } = useParams<{ asnId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { asnRecords, products, locations, labels, receiveAsn, approveQc, rejectQc, putawayItem, printReceiptLabel } =
    useWmsStore()

  const asn = asnRecords.find((a) => a.id === asnId)
  const product = products.find((p) => p.id === asn?.productId)
  const suggestedLocation = locations.find((l) => l.id === asn?.suggestedPutawayLocationId)

  const [step, setStep] = useState<Step>('summary')
  const [recQty, setRecQty] = useState(asn?.expectedQuantity ?? 0)
  const [dmgQty, setDmgQty] = useState(0)
  const [receiveError, setReceiveError] = useState<string | null>(null)
  const [serialsRaw, setSerialsRaw] = useState('')
  const [printedLabelIds, setPrintedLabelIds] = useState<string[]>([])

  if (!asn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">ASN no encontrado.</p>
      </div>
    )
  }

  const opName = operator?.name ?? 'Operador'
  const hasQc = asn.requiresQualityControl
  const requiresSerial = product?.trackBy === 'serial'

  const stepIndex: Record<Step, number> = hasQc
    ? { summary: 1, 'scan-product': 2, receive: 3, serials: 4, qc: 5, putaway: 6, 'print-label': 7, done: 8 }
    : { summary: 1, 'scan-product': 2, receive: 3, serials: 4, qc: 4, putaway: 5, 'print-label': 6, done: 7 }
  const totalSteps = hasQc ? 7 : 6

  const parsedSerials = serialsRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const handleReceive = () => {
    setReceiveError(null)
    if (requiresSerial && recQty > 0) {
      setStep('serials')
      return
    }
    try {
      receiveAsn(asn.id, recQty, opName, dmgQty)
      if (asn.requiresQualityControl) {
        setStep('qc')
      } else {
        setStep('putaway')
      }
    } catch (e: unknown) {
      setReceiveError(e instanceof Error ? e.message : 'Error al registrar recepción')
    }
  }

  const handleReceiveWithSerials = () => {
    setReceiveError(null)
    try {
      receiveAsn(asn.id, recQty, opName, dmgQty, parsedSerials)
      if (asn.requiresQualityControl) {
        setStep('qc')
      } else {
        setStep('putaway')
      }
    } catch (e: unknown) {
      setReceiveError(e instanceof Error ? e.message : 'Error al registrar recepción')
    }
  }

  const handleApproveQc = () => {
    approveQc(asn.id, opName)
    setStep('putaway')
  }
  const handleRejectQc = () => {
    rejectQc(asn.id, opName)
    setStep('done')
  }

  const handlePutaway = () => {
    if (suggestedLocation) {
      putawayItem(asn.id, suggestedLocation.id, opName)
    }
    setStep('print-label')
  }

  const pendingReceiptLabels = labels.filter(
    (l) => l.type === 'receipt' && l.asnId === asn.id && l.status === 'pending'
  )

  const handlePrintLabel = (labelId: string) => {
    printReceiptLabel(labelId)
    setPrintedLabelIds((prev) => [...prev, labelId])
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">ASN recibido</p>
          <p className="text-muted-foreground mt-1 text-sm">{asn.code}</p>
          <p className="text-muted-foreground text-sm">
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
          <div className="bg-muted rounded-xl p-4">
            <p className="text-lg font-bold">{asn.code}</p>
            <p className="text-muted-foreground text-sm">{asn.supplierName}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">{asn.receivedQuantity}</span>
              <span className="text-muted-foreground"> / {asn.expectedQuantity} uds recibidas</span>
            </p>
          </div>
          <Button className="h-12 text-base" onClick={() => setStep('scan-product')}>
            {asn.status === 'in_progress' ? '▶ CONTINUAR RECIBIENDO' : '▶ INICIAR RECEPCIÓN'}
          </Button>
        </div>
      )}

      {step === 'scan-product' && (
        <div className="flex flex-col gap-4">
          <div className="bg-muted rounded-xl p-4">
            {product?.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="mx-auto mb-3 h-20 w-20 rounded-lg object-contain"
              />
            )}
            <p className="text-center text-lg font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-muted-foreground text-center text-sm">
              SKU: {product?.sku ?? 'N/A'}
            </p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Esperado: <span className="text-foreground font-bold">{asn.expectedQuantity}</span>{' '}
              uds
            </p>
          </div>
          <p className="text-muted-foreground text-center text-sm font-medium">
            Escanea el producto para verificar
          </p>
          <BarcodeScanner
            onScan={(val) => {
              if (val === product?.barcode || val === product?.sku) {
                setStep('receive')
              } else {
                setReceiveError(
                  `Código incorrecto: ${val}. Esperado: ${product?.barcode ?? product?.sku}`
                )
              }
            }}
            placeholder="Escanear código del producto..."
            autoStart
          />
          {receiveError && <ErrorBanner message={receiveError} />}
          <Button
            variant="outline"
            className="h-10 text-sm"
            onClick={() => {
              setReceiveError(null)
              setStep('receive')
            }}
          >
            Omitir verificación
          </Button>
          <Button variant="ghost" className="h-10 text-sm" onClick={() => setStep('summary')}>
            ← Volver
          </Button>
        </div>
      )}

      {step === 'receive' && (
        <div className="flex flex-col gap-4">
          <div className="bg-muted rounded-xl p-4">
            <p className="text-lg font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-muted-foreground text-sm">SKU: {product?.sku ?? 'N/A'}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Esperado</span>
              <span className="text-xl font-black">{asn.expectedQuantity} uds</span>
            </div>
            {asn.receivedQuantity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Ya recibido</span>
                <span className="font-semibold">{asn.receivedQuantity} uds</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Cantidad recibida en buen estado</p>
            <QuantityStepper
              value={recQty}
              onChange={setRecQty}
              min={0}
              max={asn.expectedQuantity + 10}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-red-600">¿Unidades dañadas?</p>
            <QuantityStepper value={dmgQty} onChange={setDmgQty} min={0} max={recQty} />
          </div>
          {receiveError && <ErrorBanner message={receiveError} />}
          <Button
            className="h-14 text-lg font-bold"
            onClick={handleReceive}
            disabled={recQty + dmgQty === 0}
          >
            RECIBIR ÍTEM ✓
          </Button>
          <Button variant="ghost" className="h-10 text-sm" onClick={() => setStep('scan-product')}>
            ← Volver a verificación
          </Button>
        </div>
      )}

      {step === 'serials' && (
        <div className="flex flex-col gap-4">
          <div className="bg-muted rounded-xl p-4">
            <p className="font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-muted-foreground text-sm">Captura {recQty} número(s) de serie</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Series capturadas: {parsedSerials.length} / {recQty}
            </p>
            <BarcodeScanner
              onScan={(val) => setSerialsRaw((prev) => (prev ? `${prev}\n${val}` : val))}
              placeholder="Escanear serial con cámara o RF..."
              autoStart
            />
            <textarea
              className="min-h-25 rounded-xl border px-3 py-2 font-mono text-sm"
              placeholder={`Ingresa ${recQty} número(s) de serie, uno por línea`}
              value={serialsRaw}
              onChange={(e) => setSerialsRaw(e.target.value)}
            />
          </div>
          {receiveError && <ErrorBanner message={receiveError} />}
          <Button
            className="h-12 text-base"
            disabled={parsedSerials.length !== recQty}
            onClick={handleReceiveWithSerials}
          >
            CONFIRMAR CON SERIES
          </Button>
          <Button variant="outline" className="h-10" onClick={() => setStep('receive')}>
            ← Volver a cantidad
          </Button>
        </div>
      )}

      {step === 'qc' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Control de calidad</h2>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-muted-foreground text-sm">
              Recibidas: {recQty} · Dañadas: {dmgQty}
            </p>
          </div>
          <Button
            className="h-12 bg-emerald-600 text-base hover:bg-emerald-700"
            onClick={handleApproveQc}
          >
            ✅ APROBAR QC
          </Button>
          <Button variant="destructive" className="h-12 text-base" onClick={handleRejectQc}>
            ❌ RECHAZAR QC
          </Button>
        </div>
      )}

      {step === 'print-label' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Imprimir etiquetas de recepción</h2>
          <p className="text-muted-foreground text-sm">
            {pendingReceiptLabels.length} etiqueta(s) generada(s) para este ASN
          </p>
          <div className="flex flex-col gap-2">
            {pendingReceiptLabels.map((label) => {
              const printed = printedLabelIds.includes(label.id)
              return (
                <div
                  key={label.id}
                  className="bg-muted flex items-center justify-between rounded-xl p-4"
                >
                  <div>
                    <p className="font-mono font-bold">{label.code}</p>
                    <p className="text-muted-foreground text-xs">
                      {label.receivedQty} uds
                    </p>
                  </div>
                  <Button
                    variant={printed ? 'outline' : 'default'}
                    className="h-10"
                    disabled={printed}
                    onClick={() => handlePrintLabel(label.id)}
                  >
                    <Printer className="mr-2 size-4" />
                    {printed ? 'Impresa ✓' : 'Imprimir'}
                  </Button>
                </div>
              )
            })}
          </div>
          <Button
            className="h-12 text-base"
            disabled={printedLabelIds.length < pendingReceiptLabels.length}
            onClick={() => setStep('done')}
          >
            Continuar
          </Button>
        </div>
      )}

      {step === 'putaway' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Ubicar mercancía</h2>
          {suggestedLocation ? (
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Llevar a</p>
              <p className="text-4xl font-black">{suggestedLocation.zone}</p>
              <p className="text-muted-foreground text-2xl font-bold">{suggestedLocation.code}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin ubicación sugerida — ubicar manualmente.
            </p>
          )}
          <Button className="h-12 text-base" onClick={handlePutaway}>
            Confirmar ubicación y finalizar
          </Button>
        </div>
      )}
    </div>
  )
}
