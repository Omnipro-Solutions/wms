'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Package, Pencil, Printer } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerWizardHeader } from '@/components/worker/worker-wizard-header'
import { WorkerActionBar } from '@/components/worker/worker-action-bar'
import { WorkerErrorBanner } from '@/components/worker/worker-error-banner'
import { WorkerTaskContext } from '@/components/worker/worker-task-context'
import { WorkerSuccess } from '@/components/worker/worker-success'
import { Button } from '@/components/ui/button'
import { ScanInput } from '@/components/worker/scan-input'
import { suggestBox } from '@/lib/rules/packing'

type Step = 'rules' | 'items' | 'box' | 'label' | 'printing' | 'done'

export default function WorkerPackingOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { packingOrders, packingBoxTypes, packingRules, products, settings, startPacking, scanItem, completePacking, selectBox, generateLabel, sendToShipping } =
    useWmsStore()

  const order = packingOrders.find((o) => o.id === orderId)

  const activeRules = packingRules.filter((r) => order?.appliedRuleIds?.includes(r.id) ?? false)
  const hasRules = activeRules.length > 0

  // ponytail: hooks before guard — useState initialises once; hasRules is false when order is undefined, safe default
  const [step, setStepRaw] = useState<Step>(hasRules ? 'rules' : 'items')
  // Historial de pasos para el botón "atrás" (retrocede por la ruta recorrida).
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  const [showBoxList, setShowBoxList] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [labelError, setLabelError] = useState<string | null>(null)

  // Al (re)entrar al paso de caja, colapsa la lista completa para volver a mostrar la
  // caja sugerida (banner azul). Sin esto, "Elegir otra caja" quedaba abierto al regresar.
  useEffect(() => {
    if (step === 'box') setShowBoxList(false)
  }, [step])

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada.</p>
      </div>
    )
  }

  // Avanza registrando el paso actual; goBack retrocede (o sale al listado).
  const goStep = (next: Step) => {
    setScanError(null)
    setLabelError(null)
    setStepHistory((h) => [...h, step])
    setStepRaw(next)
  }
  const goBack = () => {
    setScanError(null)
    setLabelError(null)
    if (stepHistory.length === 0) {
      router.push('/worker/packing')
      return
    }
    const prev = stepHistory[stepHistory.length - 1]
    setStepHistory((h) => h.slice(0, -1))
    setStepRaw(prev)
  }
  // Corregir la caja desde el paso de etiqueta: salta al paso de caja rearmando el
  // historial a su prefijo lineal (reglas → ítems), en vez de apilar. Así "atrás" no
  // rebota etiqueta↔caja y al re-seleccionar la ruta sigue siendo lineal.
  const changeBox = () => {
    setScanError(null)
    setLabelError(null)
    setStepHistory(hasRules ? ['rules', 'items'] : ['items'])
    setStepRaw('box')
  }

  const pendingLine = order.items?.find((i) => i.scannedQuantity < i.requestedQuantity)
  const pendingProduct = products.find((p) => p.id === pendingLine?.productId)
  const lineCount = order.items?.length ?? 0
  const completedLines = order.items?.filter((i) => i.scannedQuantity >= i.requestedQuantity).length ?? 0

  const stepIndex: Record<Step, number> = {
    rules: 1,
    items: hasRules ? 2 : 1,
    box: hasRules ? 3 : 2,
    label: hasRules ? 4 : 3,
    printing: hasRules ? 5 : 4,
    done: hasRules ? 6 : 5,
  }
  const totalSteps = hasRules ? 5 : 4

  const suggested = settings.packingAutoBoxSuggestion
    ? suggestBox(order.weightKg, order.volumeM3, packingBoxTypes, settings.packingBoxSafetyMargin)
    : undefined
  // Caja ya elegida (para poder corregirla desde el paso de etiqueta antes de postear).
  const selectedBox = packingBoxTypes.find((b) => b.id === order.boxTypeId)

  const handleStartItems = () => {
    startPacking(order.id, operator?.name ?? 'Empacador')
    goStep('items')
  }

  const handleLineMatch = () => {
    if (!pendingLine) return
    setScanError(null)
    if (order.status === 'pending') startPacking(order.id, operator?.name ?? 'Empacador')
    // No hay captura de serial aquí — scanItem solo verifica código+cantidad. El modelo de datos
    // sí tiene un campo `serial` por línea (completePacking lo usa si viene lleno), pero ninguna
    // pantalla lo llena hoy. Ver el paso de cantidad de picking (/worker/picking/task/[taskId])
    // como referencia si se prioriza capturarlo aquí más adelante.
    scanItem(order.id, pendingLine.productId, pendingLine.requestedQuantity)
    const remaining = (order.items?.length ?? 0) - completedLines - 1
    if (remaining <= 0) goStep('box')
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
    goStep('label')
  }

  const handleGenerateLabel = () => {
    setLabelError(null)
    try {
      // Cierra la verificación (esperado vs. escaneado) antes de etiquetar: marca la orden
      // verified/mismatch, sella verifiedAt y emite el movimiento de stock por serie. Sin esto
      // la orden llegaba a despacho sin pasar nunca por la última barrera de calidad.
      completePacking(order.id, order.scannedItems)
      // completePacking puede auto-generar la etiqueta si packingAutoGenerateLabel está activo;
      // solo la generamos manualmente si aún no existe, para no duplicarla.
      const fresh = useWmsStore.getState().packingOrders.find((o) => o.id === order.id)
      if (!fresh?.labelGenerated) generateLabel(order.id)
      goStep('printing')
      setTimeout(() => {
        sendToShipping(order.id)
        goStep('done')
      }, 1200)
    } catch (e: unknown) {
      setLabelError(e instanceof Error ? e.message : 'Error al generar la etiqueta')
    }
  }

  const handleDone = () => {
    router.push('/worker/packing')
  }

  if (step === 'printing') {
    return (
      <div className="animate-in fade-in-0 flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center duration-300">
        <span className="bg-[var(--worker-info-surface)] flex size-24 items-center justify-center rounded-full">
          <Printer className="text-primary size-12 animate-bounce" />
        </span>
        <div>
          <p className="text-xl font-bold">Enviando a la impresora…</p>
          <p className="text-muted-foreground mt-1 font-mono text-sm tracking-wide">
            {order.orderNumber ?? order.id}
          </p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <WorkerSuccess title="Empaque completado" code={order.orderNumber ?? order.id}>
        <Button className="h-12 w-full" onClick={handleDone}>
          ← Ver cola
        </Button>
      </WorkerSuccess>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerWizardHeader backHref="/worker/packing" current={stepIndex[step]} total={totalSteps} onBack={goBack} />

      <WorkerTaskContext
        code={order.orderNumber ?? order.id}
        meta={order.customerName}
        progress={{
          current: order.scannedItems,
          total: order.expectedItems,
          label: 'Verificado',
          unit: 'ítems',
        }}
      />

      {step === 'rules' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <AlertTriangle className="size-5 text-[var(--worker-warn)]" /> Reglas de manejo
          </h2>
          <div className="flex flex-col gap-2">
            {activeRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-l-4 border-l-[var(--worker-warn)] bg-[var(--worker-warn-surface)] p-4 shadow-sm"
              >
                <p className="font-semibold">{rule.name}</p>
                <p className="text-muted-foreground text-sm">{rule.description}</p>
              </div>
            ))}
          </div>
          <WorkerActionBar>
            <Button className="h-14 text-base" onClick={handleStartItems}>
              Entendido, continuar
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'items' && (
        pendingLine ? (
          <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
            {lineCount > 1 && (
              <span className="text-sm font-medium text-muted-foreground">
                Producto {completedLines + 1} de {lineCount}
              </span>
            )}
            <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
              {pendingProduct?.imageUrl && (
                <img
                  src={pendingProduct.imageUrl}
                  alt={pendingProduct.name}
                  className="mx-auto mb-3 h-20 w-20 rounded-md object-contain"
                />
              )}
              <p className="text-center text-lg font-bold">{pendingLine.productName}</p>
              <p className="text-muted-foreground mt-1 text-center font-mono text-sm tracking-wide uppercase">
                SKU {pendingProduct?.sku ?? 'N/A'}
              </p>
              <p className="text-muted-foreground mt-2 text-center text-sm">
                Cantidad: <span className="text-foreground font-mono font-bold">{pendingLine.requestedQuantity}</span> uds
              </p>
            </div>
            <ScanInput
              label="Escanea el producto"
              expectedValue={pendingProduct?.barcode ?? pendingProduct?.sku ?? ''}
              onMatch={handleLineMatch}
              onError={handleLineError}
            />
            {scanError && <WorkerErrorBanner message={scanError} />}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkipVerification}>
              Omitir verificación
            </Button>
          </div>
        ) : (
          // Todos los ítems ya escaneados (p. ej. al volver a este paso): estado de
          // verificación completa con un botón para continuar, en vez de pantalla vacía.
          <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
            <div className="flex items-start gap-2 rounded-xl border border-l-4 border-l-[var(--worker-ok)] bg-[var(--worker-ok-surface)] px-4 py-3 text-sm text-[var(--worker-ok)]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span className="font-medium">Todos los ítems fueron escaneados ({order.scannedItems}/{order.expectedItems}).</span>
            </div>
            <WorkerActionBar>
              <Button className="h-14 text-base" onClick={() => goStep('box')}>
                Continuar a caja →
              </Button>
            </WorkerActionBar>
          </div>
        )
      )}

      {step === 'box' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Seleccionar caja</h2>
          {suggested && !showBoxList && (
            <div className="rounded-xl border-l-4 border-l-primary border-primary/20 bg-[var(--worker-info-surface)] p-4 shadow-sm">
              <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
                Caja sugerida
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                <Package className="text-primary size-5" /> {suggested.name}
              </p>
              <p className="text-muted-foreground font-mono text-sm tracking-wide">
                {suggested.dimensionsCm} · máx {suggested.maxWeightKg}kg
              </p>
              <Button className="mt-3 h-14 w-full gap-2 text-base" onClick={() => handleSelectBox(suggested.id)}>
                <CheckCircle2 className="size-4" /> Usar esta caja
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
                  className="border-border bg-card active:bg-muted rounded-xl border p-4 text-left shadow-sm"
                >
                  <p className="font-semibold">{box.name}</p>
                  <p className="text-muted-foreground font-mono text-sm tracking-wide">
                    {box.dimensionsCm} · máx {box.maxWeightKg}kg
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'label' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Generar etiqueta</h2>
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">Orden</p>
            <p className="font-mono font-bold">{order.orderNumber ?? order.id}</p>
            <p className="text-muted-foreground mt-2 font-mono text-xs font-semibold tracking-wider uppercase">
              Cliente
            </p>
            <p className="font-semibold">{order.customerName}</p>
          </div>
          {/* Caja elegida + corrección: mientras no se genere la etiqueta (posteo), el
              empacador puede volver a elegir la caja si se equivocó. Después ya salió a
              despacho y cambiarla sería re-empaque/anulación (fuera del happy path). */}
          <div className="border-border bg-card flex items-center justify-between gap-2 rounded-xl border p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
                Caja
              </p>
              <p className="flex items-center gap-1.5 font-semibold">
                <Package className="text-primary size-4 shrink-0" />
                {selectedBox?.name ?? order.suggestedBox ?? 'Sin caja'}
              </p>
              {selectedBox && (
                <p className="text-muted-foreground font-mono text-xs tracking-wide">
                  {selectedBox.dimensionsCm} · máx {selectedBox.maxWeightKg}kg
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary h-8 shrink-0 gap-1.5"
              onClick={changeBox}
            >
              <Pencil className="size-3.5" /> Cambiar caja
            </Button>
          </div>
          {labelError && <WorkerErrorBanner message={labelError} />}
          <WorkerActionBar>
            <Button className="h-14 gap-2 text-base" onClick={handleGenerateLabel}>
              <Printer className="size-4" /> Generar etiqueta
            </Button>
          </WorkerActionBar>
        </div>
      )}
    </div>
  )
}
