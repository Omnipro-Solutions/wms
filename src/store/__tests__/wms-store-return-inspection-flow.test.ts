import { describe, it, expect, beforeEach } from 'vitest'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'

beforeEach(() => {
  useWmsStore.setState({
    returnOrders: [...seed.returnOrders, seed.demoReturnOrder, seed.demoReturnOrder2],
    returnInspections: [...seed.returnInspections],
    stockMovements: [...seed.stockMovements],
  })
})

describe('flujo de inspección de devolución en worker view', () => {
  it('advanceReturn mueve una devolución de received_at_dc a under_validation', () => {
    const store = useWmsStore.getState()
    store.advanceReturn('demo-ret-1', 'María Recepcionista')
    const ret = useWmsStore.getState().returnOrders.find((r) => r.id === 'demo-ret-1')
    expect(ret?.status).toBe('under_validation')
  })

  it('inspectReturn registra la inspección de una devolución en under_validation', () => {
    const store = useWmsStore.getState()
    const inspection = store.inspectReturn(
      'demo-ret-2',
      'María Recepcionista',
      [
        {
          returnLineId: 'demo-retl-2',
          productId: 'p-cafetera',
          inspectedQuantity: 1,
          conditionRating: 'good',
          notes: 'Sin daños visibles',
          recommendedDisposition: 'restock',
        },
      ],
      'Inspección completa en punto de recepción'
    )
    expect(inspection.overallResult).toBe('pass')
    const ret = useWmsStore.getState().returnOrders.find((r) => r.id === 'demo-ret-2')
    expect(ret?.inspectionId).toBe(inspection.id)
  })

  it('setReturnDisposition cambia la disposición de una devolución en under_validation', () => {
    const store = useWmsStore.getState()
    store.setReturnDisposition('demo-ret-2', 'restock')
    const ret = useWmsStore.getState().returnOrders.find((r) => r.id === 'demo-ret-2')
    expect(ret?.disposition).toBe('restock')
  })
})
