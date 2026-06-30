'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import { ScanStep } from './_components/scan-step'
import { QuantityStep } from './_components/quantity-step'

type ScanPhase = 'location' | 'product' | 'quantity' | 'done'

export default function ScanPickingPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { pickingTasks, locations, products, startPicking, completePick, approvePart } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)

  const [phase, setPhase] = useState<ScanPhase>('location')
  const [scanError, setScanError] = useState<string | null>(null)

  if (!task) return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">Tarea no encontrada.</p>
    </div>
  )
  if (!location || !product) return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">Datos de tarea incompletos.</p>
    </div>
  )

  const handleLocationMatch = () => {
    if (task.status === 'assigned') startPicking(task.id, 'Operador')
    setScanError(null)
    setPhase('product')
  }

  const handleProductMatch = () => {
    setScanError(null)
    setPhase('quantity')
  }

  const handleQuantityConfirm = (qty: number) => {
    completePick(task.id, qty)
    if (qty < task.requestedQuantity) approvePart(task.id)
    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <p className="text-2xl font-semibold">¡Pick completado!</p>
        <p className="text-muted-foreground text-sm">Tarea {task.code}</p>
        <Button className="w-full max-w-xs" onClick={() => router.push('/picking')}>
          Volver a picking
        </Button>
      </div>
    )
  }

  if (phase === 'location') {
    return (
      <ScanStep
        title="Paso 1 de 3 — Ubicación"
        hint={`Escanea el barcode de la ubicación ${location.code}`}
        expectedCode={location.barcode}
        onMatch={handleLocationMatch}
        onError={(s) => setScanError(`Código incorrecto: ${s}`)}
      >
        <div className="text-center">
          <p className="text-4xl font-bold">{location.zone}</p>
          <p className="text-2xl font-mono">{location.code}</p>
          {scanError && <p className="mt-2 text-sm text-red-500">{scanError}</p>}
        </div>
      </ScanStep>
    )
  }

  if (phase === 'product') {
    return (
      <ScanStep
        title="Paso 2 de 3 — Producto"
        hint="Escanea el barcode del producto"
        expectedCode={product.barcode}
        onMatch={handleProductMatch}
        onError={(s) => setScanError(`Código incorrecto: ${s}`)}
      >
        <div className="text-center">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="mx-auto mb-2 h-24 w-24 rounded object-cover"
            />
          )}
          <p className="font-mono text-sm text-gray-500">{product.sku}</p>
          <p className="text-xl font-semibold">{product.name}</p>
          {scanError && <p className="mt-2 text-sm text-red-500">{scanError}</p>}
        </div>
      </ScanStep>
    )
  }

  return (
    <QuantityStep
      requestedQty={task.requestedQuantity}
      onConfirm={handleQuantityConfirm}
    />
  )
}
