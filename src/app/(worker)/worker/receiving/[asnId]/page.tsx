'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Printer, Boxes, Package, ShoppingBasket, MapPin, Pencil, type LucideIcon } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { abcByProduct, xyzByProduct } from '@/store/selectors'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerWizardHeader } from '@/components/worker/worker-wizard-header'
import { WorkerActionBar } from '@/components/worker/worker-action-bar'
import { WorkerErrorBanner } from '@/components/worker/worker-error-banner'
import { WorkerTaskContext } from '@/components/worker/worker-task-context'
import { WorkerSuccess } from '@/components/worker/worker-success'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { WorkerQtyEntry } from '@/components/worker/worker-qty-entry'
import { Button } from '@/components/ui/button'
import { BarcodeScanner } from '@/components/shared/barcode-scanner'
import { formatDate } from '@/lib/formatters'

type Step =
  | 'summary'
  | 'scan-product'
  | 'receive'
  | 'serials'
  | 'qc'
  | 'palletize'
  | 'putaway'
  | 'print-label'
  | 'done'

const UNIT_TYPES: { id: 'pallet' | 'case' | 'tote'; icon: LucideIcon; label: string; desc: string }[] = [
  {
    id: 'pallet',
    icon: Boxes,
    label: 'Pallet',
    desc: 'Estiba grande para volúmenes altos. Se mueve con montacargas.',
  },
  {
    id: 'case',
    icon: Package,
    label: 'Caja',
    desc: 'Agrupación mediana, apilable en estantería.',
  },
  {
    id: 'tote',
    icon: ShoppingBasket,
    label: 'Cubeta',
    desc: 'Contenedor plástico reutilizable para piezas pequeñas.',
  },
]

export default function WorkerReceivingAsnPage() {
  const { asnId } = useParams<{ asnId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const state = useWmsStore()
  const {
    asnRecords,
    products,
    locations,
    labels,
    putawayRules,
    rackTypes,
    inventoryItems,
    receiveAsn,
    approveQc,
    rejectQc,
    putawayItem,
    printReceiptLabel,
    settings,
    createLpn,
    addToLpn,
    closeLpn,
    moveLpn,
    generateLpnLabel,
  } = state

  const asn = asnRecords.find((a) => a.id === asnId)
  const product = products.find((p) => p.id === asn?.productId)

  const abc = abcByProduct(state)
  const xyz = xyzByProduct(state)
  const suggestedLocation = product
    ? suggestPutawayLocation({
        product,
        abcClass: abc[product.id] ?? 'C',
        xyzClass: xyz[product.id] ?? 'Z',
        locations,
        inventoryItems,
        rules: putawayRules,
        rackTypes,
        warehouseId: 'wh-bog',
      })?.location
    : undefined

  const [step, setStepRaw] = useState<Step>('summary')
  // Historial de pasos para el botón "atrás": cada avance apila el paso actual,
  // así "atrás" respeta la ruta real recorrida (con pasos condicionales/saltos).
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  // Cantidad pendiente por recibir = esperado − ya recibido. El contador arranca
  // ahí (no en el esperado total) para no permitir sobre-recepción. En recepción
  // ciega arranca en 0 para no sesgar el conteo.
  const outstandingInit = asn ? Math.max(0, asn.expectedQuantity - asn.receivedQuantity) : 0
  const [recQty, setRecQty] = useState(
    state.settings.receivingBlindEnabled ? 0 : outstandingInit
  )
  const [dmgQty, setDmgQty] = useState(0)
  // Tipo de unidad seleccionado en el paso de paletizado — se elige primero y se
  // confirma después, para poder ver la descripción y cambiar antes de crear el LPN.
  const [unitType, setUnitType] = useState<'pallet' | 'case' | 'tote' | null>(null)
  // Error del escaneo de verificación (paso scan-product) — separado de los
  // errores de recepción para que no se quede "pegado" en pasos posteriores.
  const [scanError, setScanError] = useState<string | null>(null)
  const [receiveError, setReceiveError] = useState<string | null>(null)
  const [putawayError, setPutawayError] = useState<string | null>(null)
  const [serialsRaw, setSerialsRaw] = useState('')
  const [printedLabelIds, setPrintedLabelIds] = useState<string[]>([])
  // LPN armado en este flujo — se usa en el paso de putaway para mover la unidad completa.
  const [builtLpnId, setBuiltLpnId] = useState<string | null>(null)
  const [lpnError, setLpnError] = useState<string | null>(null)
  // Marca si la recepción ya se asentó (confirmación diferida). Es un ref porque no
  // debe provocar re-render: se consulta en los handlers terminales.
  const committedRef = useRef(false)

  if (!asn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">ASN no encontrado.</p>
      </div>
    )
  }

  // Limpia los errores transitorios de un paso para que no queden "pegados" al navegar.
  const clearStepErrors = () => {
    setScanError(null)
    setReceiveError(null)
    setPutawayError(null)
    setLpnError(null)
  }
  // Avanza registrando el paso actual en el historial.
  const goStep = (next: Step) => {
    clearStepErrors()
    setStepHistory((h) => [...h, step])
    setStepRaw(next)
  }
  // Retrocede un paso; desde el primero (historial vacío) sale al listado.
  const goBack = () => {
    clearStepErrors()
    if (stepHistory.length === 0) {
      router.push('/worker/receiving')
      return
    }
    const prev = stepHistory[stepHistory.length - 1]
    setStepHistory((h) => h.slice(0, -1))
    setStepRaw(prev)
  }
  // Vuelve directo al paso de cantidad para corregir lo recibido — válido solo mientras
  // la recepción no se haya posteado (antes de confirmar QC/ubicación). Rearma el historial
  // para que "atrás" desde ahí siga siendo natural (regresa a la verificación del producto).
  const correctQuantity = () => {
    clearStepErrors()
    setStepHistory(['summary', 'scan-product'])
    setStepRaw('receive')
  }

  // Asienta la recepción una sola vez (confirmación diferida). El conteo se captura en
  // el paso "recibir" pero solo se registra en la acción terminal (aprobar QC o confirmar
  // ubicación); así el operario puede volver atrás y corregir la cantidad sin doble conteo.
  const commitReceipt = () => {
    if (committedRef.current) return
    const fresh = useWmsStore.getState().asnRecords.find((a) => a.id === asn.id)
    const remaining = fresh ? Math.max(0, fresh.expectedQuantity - fresh.receivedQuantity) : 0
    // Ya recibido por completo en una sesión previa: no re-asentar.
    if (fresh && fresh.receivedQuantity > 0 && remaining === 0) {
      committedRef.current = true
      return
    }
    receiveAsn(asn.id, recQty, opName, dmgQty, requiresSerial ? parsedSerials : undefined)
    committedRef.current = true
  }

  const opName = operator?.name ?? 'Operador'
  const hasQc = asn.requiresQualityControl
  // Unidades que aún faltan por recibir; tope duro para buenas + dañadas.
  const outstanding = Math.max(0, asn.expectedQuantity - asn.receivedQuantity)
  // Unidades buenas ya recibidas y disponibles en staging (las dañadas no se
  // almacenan). Es lo que se paletiza — funciona tanto al recibir en vivo como
  // al retomar un ASN ya recibido en una sesión anterior (donde recQty=0).
  const goodReceived = Math.max(0, asn.receivedQuantity - asn.damagedQuantity)
  // Unidades buenas a paletizar/ubicar. Con confirmación diferida, antes de asentar
  // el conteo vive en `recQty` (el ASN aún marca 0 recibido); ya asentado se lee del ASN.
  const goodToPalletize = committedRef.current ? goodReceived : recQty
  // Progreso "Recibido" para la barra de contexto. Con confirmación diferida el ASN aún
  // marca 0 hasta postear, así que antes de asentar se muestra el conteo de esta sesión
  // (bueno + dañado) para que la barra refleje lo que el operario lleva contado.
  const sessionReceived = committedRef.current ? asn.receivedQuantity : recQty + dmgQty
  const requiresSerial = product?.trackBy === 'serial'
  // Afín "Corregir": mientras la recepción no se haya posteado (committedRef=false), el
  // operario puede volver al paso de cantidad y ajustar lo recolectado sin generar stock
  // fantasma. Ya posteada la recepción, la corrección sería un ajuste de inventario (escritorio).
  const correctionBar = !committedRef.current ? (
    <div className="border-border bg-card flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 shadow-sm">
      <span className="text-muted-foreground text-sm">
        Recibido: <span className="text-foreground font-mono font-bold">{goodToPalletize}</span> uds
        {dmgQty > 0 && <span className="text-[var(--worker-danger)]"> · {dmgQty} dañadas</span>}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary h-8 shrink-0 gap-1.5"
        onClick={correctQuantity}
      >
        <Pencil className="size-3.5" /> Corregir
      </Button>
    </div>
  ) : null
  // Paletizado: paso extra solo cuando el módulo LPN está activo.
  const hasLpn = settings.lpnEnabled
  // Recepción ciega: se oculta la cantidad esperada para no sesgar el conteo.
  const blindReceiving = settings.receivingBlindEnabled

  // Secuencia REAL de pasos para este ASN: se omiten los que no aplican (series si el
  // producto no es serializado, QC si no lo requiere, paletizado si LPN está apagado).
  // Así "Paso X/N" nunca salta números (antes el paso 4 = series se contaba aunque no
  // existiera para el producto, y el contador brincaba 3 → 5).
  const stepSequence: Step[] = [
    'summary',
    'scan-product',
    'receive',
    ...(requiresSerial ? (['serials'] as Step[]) : []),
    ...(hasQc ? (['qc'] as Step[]) : []),
    ...(hasLpn ? (['palletize'] as Step[]) : []),
    'putaway',
    'print-label',
  ]
  const currentStepNumber = Math.max(1, stepSequence.indexOf(step) + 1)
  const totalSteps = stepSequence.length

  // Tras recibir (y aprobar QC si aplica), el siguiente paso es paletizar cuando
  // el módulo LPN está activo; si no, se va directo a ubicar stock suelto.
  const afterReceiveStep = (): Step => (hasQc ? 'qc' : hasLpn ? 'palletize' : 'putaway')
  const afterQcStep = (): Step => (hasLpn ? 'palletize' : 'putaway')

  // ASN ya finalizado (recibido + ubicado): estado terminal, sin acciones pendientes.
  const alreadyProcessed = asn.status === 'putaway_done'
  // Recepción saldada (modo visible): el resumen ofrece saltar directo a lo que falta.
  const fullyReceived = !blindReceiving && outstanding === 0
  const resumeStep = afterReceiveStep()
  const resumeLabel =
    resumeStep === 'qc'
      ? '▶ CONTINUAR A CALIDAD (QC)'
      : resumeStep === 'palletize'
        ? '▶ CONTINUAR A PALETIZADO'
        : '▶ CONTINUAR A UBICACIÓN'

  const parsedSerials = serialsRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const handleReceive = () => {
    setReceiveError(null)
    if (requiresSerial && recQty > 0) {
      goStep('serials')
      return
    }
    // No se asienta aquí: la recepción se confirma en la acción terminal (QC / ubicar),
    // para poder volver a este paso y corregir la cantidad.
    goStep(afterReceiveStep())
  }

  const handleReceiveWithSerials = () => {
    setReceiveError(null)
    goStep(afterReceiveStep())
  }

  const handleApproveQc = () => {
    setReceiveError(null)
    try {
      commitReceipt()
      approveQc(asn.id, opName)
      goStep(afterQcStep())
    } catch (e: unknown) {
      setReceiveError(e instanceof Error ? e.message : 'Error al aprobar QC')
    }
  }

  const handleRejectQc = () => {
    setReceiveError(null)
    try {
      commitReceipt()
      rejectQc(asn.id, opName)
      goStep('done')
    } catch (e: unknown) {
      setReceiveError(e instanceof Error ? e.message : 'Error al rechazar QC')
    }
  }

  const handlePutaway = () => {
    setPutawayError(null)
    if (!suggestedLocation) return
    try {
      // Punto terminal: si la recepción aún no se asentó (flujo sin QC), se registra
      // ahora — antes de mover la carga. Con QC ya se asentó al aprobar.
      commitReceipt()
      // Creación diferida del LPN: en paletizado solo se ELIGE el tipo (se puede
      // cambiar libremente); el LPN se arma aquí, una sola vez, al confirmar la
      // ubicación. Evita duplicados y permite corregir pallet↔caja↔cubeta antes.
      let lpnId = builtLpnId
      if (unitType && !lpnId) {
        const lpn = createLpn(unitType, 'wh-bog', 'inbound', opName, asn.id)
        addToLpn(lpn.id, asn.productId, goodToPalletize)
        closeLpn(lpn.id)
        generateLpnLabel(lpn.id, opName)
        setBuiltLpnId(lpn.id)
        lpnId = lpn.id
      }
      if (lpnId) {
        // Con LPN, moverlo ES el putaway: un solo escaneo mueve toda la carga y deja
        // un único movimiento de ubicación. putawayItem solo cierra el ASN.
        moveLpn(lpnId, suggestedLocation.id, opName)
        putawayItem(asn.id, suggestedLocation.id, opName, false)
      } else {
        // Stock suelto (sin LPN): putawayItem mueve el stock y cierra el ASN.
        putawayItem(asn.id, suggestedLocation.id, opName)
      }
      goStep('print-label')
    } catch (e: unknown) {
      setPutawayError(e instanceof Error ? e.message : 'Error al confirmar ubicación')
    }
  }

  // Etiquetas imprimibles del ASN. Con LPN armado, la etiqueta protagonista es la del
  // LPN (va pegada en el pallet y con ella se mueve toda la carga); las de recibo son
  // para stock suelto. Por eso, si existe etiqueta de LPN, se muestra solo esa —
  // evita imprimir dos etiquetas para la misma mercancía. Sin LPN, las de recibo.
  const asnLabelsOfType = (type: 'receipt' | 'lpn') =>
    labels.filter(
      (l) =>
        l.type === type &&
        l.asnId === asn.id &&
        (l.status === 'pending' || printedLabelIds.includes(l.id))
    )
  const lpnLabels = asnLabelsOfType('lpn')
  const pendingReceiptLabels = lpnLabels.length > 0 ? lpnLabels : asnLabelsOfType('receipt')

  const handlePrintLabel = (labelId: string) => {
    printReceiptLabel(labelId)
    setPrintedLabelIds((prev) => [...prev, labelId])
  }

  const handlePrintAllLabels = () => {
    const pendingIds = pendingReceiptLabels
      .filter((l) => !printedLabelIds.includes(l.id))
      .map((l) => l.id)
    pendingIds.forEach((id) => printReceiptLabel(id))
    setPrintedLabelIds((prev) => [...prev, ...pendingIds])
  }

  if (step === 'done') {
    return (
      <WorkerSuccess title="ASN recibido" code={asn.code}>
        <p className="text-muted-foreground text-sm">
          {asn.receivedQuantity} recibidas · {asn.damagedQuantity} dañadas
        </p>
        <Button className="h-12 w-full" onClick={() => router.push('/worker/receiving')}>
          ← Volver a recepciones
        </Button>
      </WorkerSuccess>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerWizardHeader
        backHref="/worker/receiving"
        current={currentStepNumber}
        total={totalSteps}
        onBack={goBack}
        // El putaway ya está confirmado al llegar a etiquetas: paso de cierre, sin atrás.
        hideBack={step === 'print-label'}
      />

      {step !== 'summary' && (
        <WorkerTaskContext
          code={asn.code}
          meta={`${asn.supplierName} · ${product?.name ?? asn.productId}`}
          due={`Cita ${formatDate(asn.appointmentDate)}`}
          progress={{
            current: sessionReceived,
            total: asn.expectedQuantity,
            label: 'Recibido',
            unit: 'uds',
          }}
        />
      )}

      {step === 'summary' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <p className="text-lg font-bold">{asn.code}</p>
            <p className="text-muted-foreground text-sm">{asn.supplierName}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">{asn.receivedQuantity}</span>
              <span className="text-muted-foreground"> / {asn.expectedQuantity} uds recibidas</span>
            </p>
          </div>
          {alreadyProcessed ? (
            // Estado terminal: ya recibido y ubicado. Sin acciones — solo volver.
            <>
              <div className="flex items-start gap-2 rounded-xl border border-l-4 border-l-[var(--worker-ok)] bg-[var(--worker-ok-surface)] px-4 py-3 text-sm text-[var(--worker-ok)]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>Este ASN ya fue recibido y ubicado. No hay acciones pendientes.</span>
              </div>
              <WorkerActionBar>
                <Button className="h-14 text-base" onClick={() => router.push('/worker/receiving')}>
                  ← Volver a recepciones
                </Button>
              </WorkerActionBar>
            </>
          ) : (
            <>
              {fullyReceived && (
                // Task-driven: recepción saldada → el resumen salta directo a lo pendiente.
                <div className="flex items-start gap-2 rounded-xl border border-l-4 border-l-[var(--worker-ok)] bg-[var(--worker-ok-surface)] px-4 py-3 text-sm text-[var(--worker-ok)]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>Recepción completa. Faltan pasos posteriores para cerrar este ASN.</span>
                </div>
              )}
              <WorkerActionBar>
                {fullyReceived ? (
                  <Button className="h-14 text-base" onClick={() => goStep(afterReceiveStep())}>
                    {resumeLabel}
                  </Button>
                ) : (
                  <Button className="h-14 text-base" onClick={() => goStep('scan-product')}>
                    {asn.status === 'in_progress' ? '▶ CONTINUAR RECIBIENDO' : '▶ INICIAR RECEPCIÓN'}
                  </Button>
                )}
              </WorkerActionBar>
            </>
          )}
        </div>
      )}

      {step === 'scan-product' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
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
                setScanError(null)
                goStep('receive')
              } else {
                setScanError(
                  `Código incorrecto: ${val}. Esperado: ${product?.barcode ?? product?.sku}`
                )
              }
            }}
            placeholder="Escanear código del producto..."
            autoStart
          />
          {scanError && <WorkerErrorBanner message={scanError} />}
          <Button
            variant="outline"
            className="h-10 text-sm"
            onClick={() => {
              setScanError(null)
              goStep('receive')
            }}
          >
            Omitir verificación
          </Button>
          <Button variant="ghost" className="h-10 text-sm" onClick={goBack}>
            ← Volver
          </Button>
        </div>
      )}

      {step === 'receive' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <p className="text-lg font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-muted-foreground text-sm">SKU: {product?.sku ?? 'N/A'}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Esperado</span>
              {blindReceiving ? (
                <span className="text-muted-foreground text-sm font-medium">Conteo ciego</span>
              ) : (
                <span className="text-xl font-black">{asn.expectedQuantity} uds</span>
              )}
            </div>
            {!blindReceiving && asn.receivedQuantity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Ya recibido</span>
                <span className="font-semibold">{asn.receivedQuantity} uds</span>
              </div>
            )}
          </div>
          {!blindReceiving && outstanding === 0 ? (
            // Recepción ya saldada: no se re-recibe. Como un WMS real, se marca como
            // completa y se deja continuar con los pasos pendientes (QC / putaway).
            <>
              <div className="flex items-start gap-2 rounded-xl border border-l-4 border-l-[var(--worker-ok)] bg-[var(--worker-ok-surface)] px-4 py-3 text-sm text-[var(--worker-ok)]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>
                  Este ítem ya fue recibido por completo ({asn.receivedQuantity}/{asn.expectedQuantity} uds).
                  Continúa con los pasos pendientes.
                </span>
              </div>
              <WorkerActionBar>
                <Button className="h-14 text-base" onClick={() => goStep(afterReceiveStep())}>
                  Continuar →
                </Button>
                <Button variant="ghost" className="h-10 text-sm" onClick={goBack}>
                  ← Volver a verificación
                </Button>
              </WorkerActionBar>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Cantidad recibida en buen estado</p>
                <WorkerQtyEntry
                  value={recQty}
                  onChange={setRecQty}
                  min={0}
                  max={blindReceiving ? undefined : Math.max(0, outstanding - dmgQty)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[var(--worker-danger)]">¿Unidades dañadas?</p>
                <QuantityStepper
                  value={dmgQty}
                  onChange={setDmgQty}
                  min={0}
                  max={blindReceiving ? undefined : Math.max(0, outstanding - recQty)}
                />
              </div>
              {!blindReceiving && (
                <p className="text-muted-foreground text-center text-xs">
                  Pendiente por recibir: {outstanding} uds
                </p>
              )}
              {receiveError && <WorkerErrorBanner message={receiveError} />}
              <WorkerActionBar>
                <Button
                  className="h-14 text-lg font-bold"
                  onClick={handleReceive}
                  disabled={recQty + dmgQty === 0}
                >
                  RECIBIR ÍTEM ✓
                </Button>
                <Button variant="ghost" className="h-10 text-sm" onClick={goBack}>
                  ← Volver a verificación
                </Button>
              </WorkerActionBar>
            </>
          )}
        </div>
      )}

      {step === 'serials' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
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
          {receiveError && <WorkerErrorBanner message={receiveError} />}
          <WorkerActionBar>
            <Button
              className="h-14 text-base"
              disabled={parsedSerials.length !== recQty}
              onClick={handleReceiveWithSerials}
            >
              CONFIRMAR CON SERIES
            </Button>
            <Button variant="outline" className="h-10" onClick={goBack}>
              ← Volver a cantidad
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'qc' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Control de calidad</h2>
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-sm">
              Recibidas: {recQty} · Dañadas: {dmgQty}
            </p>
          </div>
          {receiveError && <WorkerErrorBanner message={receiveError} />}
          <WorkerActionBar>
            <Button
              className="h-14 gap-2 bg-[var(--worker-ok)] text-base text-white hover:opacity-90"
              onClick={handleApproveQc}
            >
              <CheckCircle2 className="size-5" /> Aprobar QC
            </Button>
            <Button variant="destructive" className="h-12 gap-2 text-base" onClick={handleRejectQc}>
              <XCircle className="size-5" /> Rechazar QC
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'print-label' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Imprimir etiquetas</h2>
          {pendingReceiptLabels.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
              <Printer className="mt-0.5 size-4 shrink-0" />
              <span>
                No hay etiquetas pendientes por imprimir para este ASN. Ya se generaron durante la
                recepción.
              </span>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {pendingReceiptLabels.length === 1
                  ? '1 etiqueta para este ASN'
                  : `${pendingReceiptLabels.length} etiquetas para este ASN`}
              </p>
              {/* "Imprimir todas" solo tiene sentido con 2+ etiquetas (p. ej. producto
                  serializado sin paletizar, una etiqueta por serie). Con una sola —el caso
                  del flujo con LPN— basta su botón individual; se oculta el botón masivo. */}
              {pendingReceiptLabels.length > 1 &&
                printedLabelIds.length < pendingReceiptLabels.length && (
                  <Button variant="outline" className="h-11 text-sm" onClick={handlePrintAllLabels}>
                    <Printer className="mr-2 size-4" />
                    Imprimir todas ({pendingReceiptLabels.length - printedLabelIds.length})
                  </Button>
                )}
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
                          {label.type === 'lpn'
                            ? 'Unidad de carga (LPN)'
                            : `${label.receivedQty ?? ''} uds`}
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
            </>
          )}
          <WorkerActionBar>
            <Button
              className="h-14 text-base"
              disabled={printedLabelIds.length < pendingReceiptLabels.length}
              onClick={() => goStep('done')}
            >
              Finalizar
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'palletize' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Armar unidad de carga</h2>
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-sm">
              Agrupa lo recibido en una unidad con su propio código. A partir de aquí un solo
              escaneo mueve toda la carga.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">A paletizar</span>
              <span className="text-xl font-black">{goodToPalletize} uds</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Producto</span>
              <span className="font-semibold">{product?.sku ?? asn.productId}</span>
            </div>
          </div>

          {correctionBar}

          {lpnError && <WorkerErrorBanner message={lpnError} />}

          <p className="text-sm font-semibold">Tipo de unidad</p>
          <div className="grid grid-cols-3 gap-2">
            {UNIT_TYPES.map((u) => (
              <Button
                key={u.id}
                variant={unitType === u.id ? 'default' : 'outline'}
                className="h-16 flex-col gap-1 text-sm"
                onClick={() => setUnitType(u.id)}
              >
                <u.icon className="size-6" />
                <span>{u.label}</span>
              </Button>
            ))}
          </div>

          {unitType && (
            <p className="text-muted-foreground rounded-xl bg-muted px-4 py-3 text-sm">
              {UNIT_TYPES.find((u) => u.id === unitType)?.desc}
            </p>
          )}

          <WorkerActionBar>
            {/* Solo elige el tipo; el LPN se arma al confirmar la ubicación, así puede
                cambiarse pallet↔caja↔cubeta hasta el último momento. */}
            <Button className="h-14 text-base" disabled={!unitType} onClick={() => goStep('putaway')}>
              Continuar →
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-sm"
              onClick={() => {
                setUnitType(null)
                goStep('putaway')
              }}
            >
              Omitir — ubicar como stock suelto →
            </Button>
          </WorkerActionBar>
        </div>
      )}

      {step === 'putaway' && (
        <div className="animate-in fade-in-0 flex flex-col gap-4 duration-300">
          <h2 className="text-lg font-bold">Ubicar mercancía</h2>
          {correctionBar}
          {(builtLpnId || unitType) && (
            <div className="rounded-xl border border-l-4 border-l-[var(--worker-info)] bg-[var(--worker-info-surface)] px-4 py-3">
              <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
                Unidad de carga
              </p>
              <p className="mt-1 text-lg font-bold">
                {builtLpnId ? (
                  <span className="font-mono">
                    {state.lpns.find((l) => l.id === builtLpnId)?.code}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {(() => {
                      const U = UNIT_TYPES.find((u) => u.id === unitType)
                      return U ? <U.icon className="size-4" /> : null
                    })()}
                    {UNIT_TYPES.find((u) => u.id === unitType)?.label}
                    <span className="text-muted-foreground text-sm font-normal">— se arma al confirmar</span>
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Un solo movimiento arrastra todo el contenido a la ubicación.
              </p>
            </div>
          )}
          {suggestedLocation ? (
            <div className="border-border bg-card rounded-xl border p-5 text-center shadow-sm">
              <p className="text-primary flex items-center justify-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase">
                <MapPin className="size-3.5" /> Ir a
              </p>
              <p className="mt-2 font-mono text-5xl leading-none font-black tracking-tight">
                {suggestedLocation.code}
              </p>
              <p className="text-muted-foreground mt-3 font-mono text-sm tracking-wider uppercase">
                Zona {suggestedLocation.zone}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin ubicación sugerida — completa este putaway desde el escritorio.
            </p>
          )}
          {putawayError && <WorkerErrorBanner message={putawayError} />}
          <WorkerActionBar>
            <Button className="h-14 text-base" onClick={handlePutaway} disabled={!suggestedLocation}>
              Confirmar ubicación y finalizar
            </Button>
          </WorkerActionBar>
        </div>
      )}
    </div>
  )
}
