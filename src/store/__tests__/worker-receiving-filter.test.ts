import { describe, it, expect } from 'vitest'
import type { Asn } from '@/types/wms'

// Mirrors the filter logic in src/app/(worker)/worker/receiving/page.tsx
const filterTodayOrEarlierAsns = (asnRecords: Asn[], today: string) =>
  asnRecords
    .filter((a) => ['pending', 'in_progress'].includes(a.status) && a.appointmentDate <= today)
    .sort((a, b) => (b.status === 'in_progress' ? 1 : 0) - (a.status === 'in_progress' ? 1 : 0))

const baseAsn: Asn = {
  id: 'a1',
  code: 'ASN-1',
  supplierName: 'Proveedor Demo',
  appointmentDate: '2026-06-30',
  expectedQuantity: 10,
  receivedQuantity: 0,
  damagedQuantity: 0,
  status: 'pending',
  requiresQualityControl: false,
  crossDocking: false,
  productId: 'p-microondas',
  deliveryCount: 0,
  sourceType: 'purchase',
}

describe('filterTodayOrEarlierAsns', () => {
  it('incluye un ASN con fecha pasada respecto a hoy', () => {
    const result = filterTodayOrEarlierAsns([baseAsn], '2026-07-02')
    expect(result).toHaveLength(1)
  })

  it('excluye un ASN con fecha futura respecto a hoy', () => {
    const future = { ...baseAsn, appointmentDate: '2026-07-10' }
    const result = filterTodayOrEarlierAsns([future], '2026-07-02')
    expect(result).toHaveLength(0)
  })

  it('excluye ASNs completados aunque la fecha sea pasada', () => {
    const completed = { ...baseAsn, status: 'completed' as const }
    const result = filterTodayOrEarlierAsns([completed], '2026-07-02')
    expect(result).toHaveLength(0)
  })
})
