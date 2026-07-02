'use client'

import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ItemCondition, ReturnItemInspection, ReturnOrder } from '@/types/wms'

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: 'good', label: 'Bueno' },
  { value: 'damaged', label: 'Dañado' },
]

const DISPOSITIONS: { value: ReturnOrder['disposition']; label: string }[] = [
  { value: 'restock', label: 'Reingreso' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'repair', label: 'Reparación' },
  { value: 'quality_control', label: 'Control de calidad' },
]

const ReturnInspectionCard = ({ ret }: { ret: ReturnOrder }) => {
  const { operator } = useCurrentOperator()
  const { getProduct } = useStoreHelpers()
  const advanceReturn = useWmsStore((s) => s.advanceReturn)
  const inspectReturn = useWmsStore((s) => s.inspectReturn)
  const setReturnDisposition = useWmsStore((s) => s.setReturnDisposition)

  const [conditions, setConditions] = useState<Record<string, ItemCondition>>({})
  const [notes, setNotes] = useState('')
  const [inspected, setInspected] = useState(false)
  const [dispositionChosen, setDispositionChosen] = useState(false)

  const opName = operator?.name ?? 'Operador'
  const needsAdvanceToValidation = ['received_at_store', 'received_at_dc'].includes(ret.status)
  const isInspected = inspected || Boolean(ret.inspectionId)
  const readyToInspect = ret.status === 'under_validation' && !isInspected

  const handleAdvance = () => {
    advanceReturn(ret.id, opName)
  }

  const handleSetCondition = (lineId: string, condition: ItemCondition) => {
    setConditions((prev) => ({ ...prev, [lineId]: condition }))
  }

  const handleInspect = () => {
    const items: ReturnItemInspection[] = ret.items.map((line) => {
      const condition = conditions[line.id] ?? 'good'
      return {
        returnLineId: line.id,
        productId: line.productId,
        inspectedQuantity: line.requestedQuantity,
        conditionRating: condition,
        notes,
        recommendedDisposition: condition === 'damaged' ? 'scrap' : 'restock',
      }
    })
    inspectReturn(ret.id, opName, items, notes)
    setInspected(true)
  }

  const handleDisposition = (disposition: ReturnOrder['disposition']) => {
    setReturnDisposition(ret.id, disposition)
    setDispositionChosen(true)
  }

  const allConditionsSet = ret.items.every((line) => conditions[line.id])

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="font-semibold">{ret.rmaCode}</p>
        <p className="text-muted-foreground text-sm">{ret.customerName}</p>
        <div className="mt-1 flex flex-col gap-0.5">
          {ret.items.map((line) => {
            const product = getProduct(line.productId)
            return (
              <p key={line.id} className="text-sm">
                {product?.name ?? line.productId} · {line.requestedQuantity} uds
              </p>
            )
          })}
        </div>
      </div>

      {needsAdvanceToValidation && (
        <Button variant="outline" className="h-12" onClick={handleAdvance}>
          Avanzar a validación
        </Button>
      )}

      {readyToInspect && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-sm font-semibold">Condición por producto</p>
          {ret.items.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">{getProduct(line.productId)?.name ?? line.productId}</span>
              <div className="flex gap-2">
                {CONDITIONS.map((c) => (
                  <Button
                    key={c.value}
                    type="button"
                    variant={conditions[line.id] === c.value ? 'default' : 'outline'}
                    className="h-10"
                    onClick={() => handleSetCondition(line.id, c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <textarea
            className="min-h-16 rounded-xl border px-3 py-2 text-sm"
            placeholder="Notas de inspección (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button className="h-12" disabled={!allConditionsSet} onClick={handleInspect}>
            Confirmar inspección
          </Button>
        </div>
      )}

      {isInspected && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-semibold">Disposición</p>
          <div className="grid grid-cols-2 gap-2">
            {DISPOSITIONS.map((d) => (
              <Button
                key={d.value}
                variant={dispositionChosen && ret.disposition === d.value ? 'default' : 'outline'}
                className="h-12"
                onClick={() => handleDisposition(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkerReturnsPage() {
  const returnOrders = useWmsStore((s) => s.returnOrders)

  const pending = returnOrders.filter((r) =>
    ['received_at_store', 'received_at_dc', 'under_validation'].includes(r.status)
  )

  if (!pending.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <RotateCcw className={cn('size-12 text-muted-foreground')} />
        <p className="font-semibold">Sin devoluciones pendientes</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Devoluciones pendientes</h1>
      <div className="flex flex-col gap-3">
        {pending.map((ret) => (
          <ReturnInspectionCard key={ret.id} ret={ret} />
        ))}
      </div>
    </div>
  )
}
