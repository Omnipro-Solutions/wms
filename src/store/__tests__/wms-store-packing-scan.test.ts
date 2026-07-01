import { describe, it, expect, beforeEach } from 'vitest'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'

// pk-eco-2: in_progress, 1 line (p-cafetera, requestedQuantity 1, scannedQuantity 0)
const TEST_ORDER_ID = 'pk-eco-2'
const TEST_PRODUCT_ID = 'p-cafetera'

beforeEach(() => {
  useWmsStore.setState({
    packingOrders: seed.packingOrders.map((p) => ({ ...p, items: p.items?.map((i) => ({ ...i })) })),
  })
})

describe('scanItem', () => {
  it('updates the matching line scannedQuantity, clamped to requestedQuantity', () => {
    const store = useWmsStore.getState()
    store.scanItem(TEST_ORDER_ID, TEST_PRODUCT_ID, 5)
    const order = useWmsStore.getState().packingOrders.find((p) => p.id === TEST_ORDER_ID)
    const line = order?.items?.find((i) => i.productId === TEST_PRODUCT_ID)
    expect(line?.scannedQuantity).toBe(1)
  })

  it('recomputes order.scannedItems as the sum across all lines', () => {
    const store = useWmsStore.getState()
    store.scanItem(TEST_ORDER_ID, TEST_PRODUCT_ID, 1)
    const order = useWmsStore.getState().packingOrders.find((p) => p.id === TEST_ORDER_ID)
    expect(order?.scannedItems).toBe(1)
  })

  it('sets verificationStatus to verified when every line is fully scanned', () => {
    const store = useWmsStore.getState()
    store.scanItem(TEST_ORDER_ID, TEST_PRODUCT_ID, 1)
    const order = useWmsStore.getState().packingOrders.find((p) => p.id === TEST_ORDER_ID)
    expect(order?.verificationStatus).toBe('verified')
  })

  it('leaves verificationStatus pending when a line is still incomplete', () => {
    useWmsStore.setState((state) => ({
      packingOrders: state.packingOrders.map((p) =>
        p.id === TEST_ORDER_ID
          ? {
              ...p,
              items: [
                ...(p.items ?? []),
                { productId: 'p-microondas', productName: 'Microondas 28L Digital', requestedQuantity: 1, scannedQuantity: 0 },
              ],
            }
          : p
      ),
    }))
    const store = useWmsStore.getState()
    store.scanItem(TEST_ORDER_ID, TEST_PRODUCT_ID, 1)
    const order = useWmsStore.getState().packingOrders.find((p) => p.id === TEST_ORDER_ID)
    expect(order?.verificationStatus).toBe('pending')
  })

  it('throws when the order is not in_progress', () => {
    useWmsStore.setState((state) => ({
      packingOrders: state.packingOrders.map((p) => (p.id === TEST_ORDER_ID ? { ...p, status: 'pending' as const } : p)),
    }))
    const store = useWmsStore.getState()
    expect(() => store.scanItem(TEST_ORDER_ID, TEST_PRODUCT_ID, 1)).toThrow('El packing no está en progreso')
  })

  it('throws when no line matches the given productId', () => {
    const store = useWmsStore.getState()
    expect(() => store.scanItem(TEST_ORDER_ID, 'p-does-not-exist', 1)).toThrow('línea de producto no encontrada')
  })
})
