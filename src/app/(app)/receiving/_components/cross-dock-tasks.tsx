'use client'

import { PackageCheck, Truck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Cierre del flujo de cross-docking: lista las tareas creadas desde el diálogo de
 * asignación y permite completarlas ("Completar despacho"), que descuenta la
 * mercancía del staging y la aplica al pedido. Las completadas quedan marcadas
 * como "Despachado" para que la transición sea visible en la demo.
 */
export const CrossDockTasks = () => {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const { productName } = useStoreHelpers()
  const tasks = state.crossDockTasks

  if (tasks.length === 0) return null

  const orderNumber = (id: string) =>
    state.commerceOrders.find((o) => o.id === id)?.orderNumber ?? id

  const handleComplete = (taskId: string) => {
    try {
      state.completeCrossDockTask(taskId, operator?.name ?? 'sistema')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <Alert className="border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30">
      <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      <AlertTitle className="text-emerald-900 dark:text-emerald-200">
        {tasks.length} tarea{tasks.length === 1 ? '' : 's'} de cross-docking
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-col gap-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-background/60 px-3 py-2 dark:border-emerald-900/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{productName(t.productId)}</span>
                <Badge variant="outline">{t.quantity} u.</Badge>
                <span className="text-muted-foreground">→ {orderNumber(t.commerceOrderId)}</span>
              </div>
              {t.status === 'completed' ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <PackageCheck className="mr-1 h-3 w-3" /> Despachado
                </Badge>
              ) : (
                <Button size="sm" onClick={() => handleComplete(t.id)}>
                  Completar despacho
                </Button>
              )}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}
