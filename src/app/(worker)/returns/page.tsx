'use client'

import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

export default function WorkerReturnsPage() {
  const { operator } = useCurrentOperator()
  const returnOrders = useWmsStore((s) => s.returnOrders)
  const advanceReturn = useWmsStore((s) => s.advanceReturn)
  const { getProduct } = useStoreHelpers()

  const pending = returnOrders.filter((r) =>
    ['received_at_store', 'received_at_dc'].includes(r.status)
  )

  if (!pending.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <RotateCcw className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin devoluciones pendientes</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Devoluciones pendientes</h1>
      <div className="flex flex-col gap-2">
        {pending.map((ret) => {
          const firstProductId = ret.items[0]?.productId
          const product = firstProductId ? getProduct(firstProductId) : null
          return (
            <div key={ret.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <div>
                <p className="font-semibold">{ret.rmaCode}</p>
                <p className="text-sm text-muted-foreground">{ret.customerName}</p>
                {product && <p className="text-sm">{product.name}</p>}
              </div>
              <Button
                variant="outline"
                className="h-12"
                onClick={() => advanceReturn(ret.id, operator?.name ?? 'Operador')}
              >
                Avanzar estado
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
