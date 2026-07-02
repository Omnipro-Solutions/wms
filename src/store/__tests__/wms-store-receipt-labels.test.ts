import { describe, it, expect, beforeEach } from 'vitest'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'

// Reset to seed state before each test to avoid cross-test contamination.
// p-nevera requires trackBy='serial', so receiveAsn needs serials passed.
const TEST_ASN_ID = 'asn-4' // in_progress in seed, productId: p-nevera (trackBy: serial)
const TEST_SERIAL = 'NEV-TEST-9999'

beforeEach(() => {
  useWmsStore.setState({
    asnRecords: seed.asnRecords.map((a) =>
      a.id === TEST_ASN_ID ? { ...a, status: 'in_progress' } : a
    ),
    labels: [...seed.labels],
    inventoryItems: [...seed.inventoryItems],
    stockMovements: [...seed.stockMovements],
  })
})

describe('receiveAsn — generación de labels', () => {
  it('genera WmsLabel tipo receipt al recibir un ASN', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(TEST_ASN_ID, 1, 'Operador', 0, [TEST_SERIAL])
    const state = useWmsStore.getState()
    const receiptLabels = state.labels.filter(
      (l) => l.type === 'receipt' && l.asnId === TEST_ASN_ID
    )
    expect(receiptLabels.length).toBeGreaterThan(0)
    expect(receiptLabels[0].status).toBe('pending')
  })

  it('avanza ASN a labels_pending después de receiveAsn', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(TEST_ASN_ID, 1, 'Operador', 0, [TEST_SERIAL])
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === TEST_ASN_ID)
    expect(asn?.status).toBe('labels_pending')
  })
})

describe('printReceiptLabel', () => {
  it('marca label como completed y avanza ASN a putaway_ready si todas impresas', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(TEST_ASN_ID, 1, 'Operador', 0, [TEST_SERIAL])
    const labels = useWmsStore.getState().labels.filter(
      (l) => l.type === 'receipt' && l.asnId === TEST_ASN_ID && l.status === 'pending'
    )
    expect(labels.length).toBeGreaterThan(0)
    labels.forEach((l) => store.printReceiptLabel(l.id))
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === TEST_ASN_ID)
    expect(asn?.status).toBe('putaway_ready')
  })
})

describe('flujo completo receiving worker — receive, putaway, print', () => {
  it('lista las receipt labels pendientes de un ASN después de recibir', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(TEST_ASN_ID, 1, 'Operador', 0, [TEST_SERIAL])
    const state = useWmsStore.getState()
    const pendingLabels = state.labels.filter(
      (l) => l.type === 'receipt' && l.asnId === TEST_ASN_ID && l.status === 'pending'
    )
    expect(pendingLabels.length).toBeGreaterThan(0)
  })

  it('después de imprimir todas las labels, no quedan receipt labels pendientes para ese ASN', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(TEST_ASN_ID, 1, 'Operador', 0, [TEST_SERIAL])
    const pendingLabels = useWmsStore
      .getState()
      .labels.filter((l) => l.type === 'receipt' && l.asnId === TEST_ASN_ID && l.status === 'pending')
    pendingLabels.forEach((l) => store.printReceiptLabel(l.id))
    const stillPending = useWmsStore
      .getState()
      .labels.filter((l) => l.type === 'receipt' && l.asnId === TEST_ASN_ID && l.status === 'pending')
    expect(stillPending).toHaveLength(0)
  })
})
