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
  id: 'order-1', orderNumber: 'ORD-001', customerName: 'Cliente',
  channel: 'ecommerce', fulfillmentType: 'cross_docking',
  status: 'pending',
  items: [{ id: 'li-1', productId: 'p-1', requestedQuantity: 50, pickedQuantity: 0 }],
  createdAt: '2026-07-01T08:00:00Z', promisedDeliveryDate: '2026-07-02',
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
      makeOrder({ id: 'order-2', orderNumber: 'ORD-002', items: [{ id: 'li-2', productId: 'p-2', requestedQuantity: 10, pickedQuantity: 0 }] }),
      makeOrder({ id: 'order-3', orderNumber: 'ORD-003', status: 'completed', items: [{ id: 'li-3', productId: 'p-1', requestedQuantity: 5, pickedQuantity: 5 }] }),
    ]
    const result = matchCrossDockOrders('p-1', orders)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-1')
  })
})
