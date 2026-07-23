import { describe, it, expect } from 'vitest'
import { useWmsStore } from '../wms-store'

describe('demo seed data — worker views', () => {
  it('incluye al menos 2 ASNs pendientes/en progreso para la vista de recepción', () => {
    const state = useWmsStore.getState()
    const activeAsns = state.asnRecords.filter((a) =>
      ['pending', 'in_progress'].includes(a.status)
    )
    expect(activeAsns.length).toBeGreaterThanOrEqual(2)
  })

  it('incluye una devolución en estado under_validation para el flujo de inspección', () => {
    const state = useWmsStore.getState()
    const inspectable = state.returnOrders.filter((r) => r.status === 'under_validation')
    expect(inspectable.length).toBeGreaterThanOrEqual(1)
  })

  it('incluye al menos una devolución en received_at_dc/received_at_store para avanzar a validación', () => {
    const state = useWmsStore.getState()
    const pending = state.returnOrders.filter((r) =>
      ['received_at_store', 'received_at_dc'].includes(r.status)
    )
    expect(pending.length).toBeGreaterThanOrEqual(1)
  })
})

describe('demo seed data — rediseño móvil (picking/packing/driver)', () => {
  it('Ana Picker tiene una tarea con producto trackBy lot', () => {
    const state = useWmsStore.getState()
    const lotTask = state.pickingTasks.find(
      (t) =>
        t.assignedOperatorId === 'op-picker-1' &&
        state.products.find((p) => p.id === t.productId)?.trackBy === 'lot'
    )
    expect(lotTask).toBeDefined()
  })

  it('Pedro Packer tiene al menos 3 órdenes pendientes de distinto tamaño', () => {
    const state = useWmsStore.getState()
    const pending = state.packingOrders.filter((o) => o.status === 'pending')
    expect(pending.length).toBeGreaterThanOrEqual(3)
  })

  it('Carlos Driver tiene manifiestos y transferencias variadas', () => {
    const state = useWmsStore.getState()
    expect(
      state.loadManifests.filter((m) => m.assignedDriverId === 'op-driver-1').length
    ).toBeGreaterThanOrEqual(3)
    expect(
      state.transfers.filter((t) => t.assignedDriverId === 'op-driver-1' && t.status === 'in_transit')
        .length
    ).toBeGreaterThanOrEqual(2)
  })
})
