import { describe, it, expect } from 'vitest'
import { canCrossDock, matchCrossDockOrders } from '@/lib/rules/crossdock'
import type { Asn, CommerceOrder } from '@/types/wms'

const makeAsn = (overrides: Partial<Asn>): Asn => ({
  id: 'asn-1', code: 'ASN-001', supplierName: 'Proveedor', appointmentDate: '2026-07-01',
  expectedQuantity: 100, receivedQuantity: 0, damagedQuantity: 0,
  status: 'in_progress', requiresQualityControl: false, crossDocking: true,
  productId: 'p-1', deliveryCount: 0, sourceType: 'purchase',
  ...overrides,
})

const makeOrder = (overrides: Partial<CommerceOrder>): CommerceOrder => ({
  id: 'order-1', code: 'ORD-001', customerId: 'cust-1', customerName: 'Cliente',
  warehouseId: 'wh-1', channel: 'ecommerce', fulfillmentType: 'cross_docking',
  status: 'pending', priority: 'normal', isUrgent: false,
  items: [{ productId: 'p-1', quantity: 50, pickedQuantity: 0 }],
  createdAt: '2026-07-01T08:00:00Z', promisedDeliveryAt: '2026-07-02T08:00:00Z',
  ...overrides,
})

describe('canCrossDock', () => {
  it('returns true for ASN with crossDocking=true and in_progress status', () => {
    expect(canCrossDock(makeAsn({}))).toBe(true)
  })

  it('returns false when ASN crossDocking=false', () => {
    expect(canCrossDock(makeAsn({ crossDocking: false }))).toBe(false)
  })

  it('returns false when ASN requires QC', () => {
    expect(canCrossDock(makeAsn({ requiresQualityControl: true }))).toBe(false)
  })

  it('returns false when ASN is completed or cancelled', () => {
    expect(canCrossDock(makeAsn({ status: 'completed' }))).toBe(false)
    expect(canCrossDock(makeAsn({ status: 'cancelled' }))).toBe(false)
  })
})

describe('matchCrossDockOrders', () => {
  it('returns pending cross_docking orders that need the product', () => {
    const orders = [
      makeOrder({}),
      makeOrder({ id: 'order-2', code: 'ORD-002', items: [{ productId: 'p-2', quantity: 10, pickedQuantity: 0 }] }),
      makeOrder({ id: 'order-3', code: 'ORD-003', status: 'completed', items: [{ productId: 'p-1', quantity: 5, pickedQuantity: 5 }] }),
    ]
    const result = matchCrossDockOrders('p-1', orders)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-1')
  })
})
