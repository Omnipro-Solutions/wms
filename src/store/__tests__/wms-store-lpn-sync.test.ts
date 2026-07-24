import { describe, it, expect, beforeEach } from 'vitest'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'
import { ensureAsnLines } from '@/lib/rules/asn'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
import { abcByProduct, xyzByProduct } from '@/store/selectors'

// asn-3 en el seed: p-microondas (trackBy serial), sin QC.
const ASN_ID = 'asn-3'
// El ASN espera 45 unidades: recibir menos lo deja en 'partial' y el FSM
// no permite putaway hasta 'completed'.
const EXPECTED = 45
const SERIALS = Array.from({ length: EXPECTED }, (_, i) => `MW-T-${String(i + 1).padStart(3, '0')}`)

const asnFor = (id: string) => useWmsStore.getState().asnRecords.find((a) => a.id === id)!

// Usa el mismo motor de sugerencia que la app, para que el destino satisfaga
// todas las restricciones (categoría, peso, rack, ABC) que valida putawayItem.
const validDestination = () => {
  const state = useWmsStore.getState()
  const product = state.products.find((p) => p.id === asnFor(ASN_ID).productId)!
  const suggestion = suggestPutawayLocation({
    product,
    abcClass: abcByProduct(state)[product.id] ?? 'C',
    xyzClass: xyzByProduct(state)[product.id] ?? 'Z',
    locations: state.locations,
    inventoryItems: state.inventoryItems,
    rules: state.putawayRules,
    rackTypes: state.rackTypes,
    warehouseId: 'wh-bog',
  })
  if (!suggestion) throw new Error('El seed no ofrece ubicación válida para este producto')
  return suggestion.location
}

beforeEach(() => {
  useWmsStore.setState({
    asnRecords: seed.asnRecords.map(ensureAsnLines).map((a) =>
      a.id === ASN_ID ? { ...a, status: 'in_progress', receivedQuantity: 0 } : a
    ),
    inventoryItems: [...seed.inventoryItems],
    stockMovements: [...seed.stockMovements],
    labels: [...seed.labels],
    integrations: [...seed.integrations],
    lpns: [],
    lpnLines: [],
    stockSyncLog: [],
    settings: { ...seed.settings },
  })
})

describe('LPN — ciclo de vida', () => {
  it('crea un LPN abierto con código correlativo', () => {
    const lpn = useWmsStore.getState().createLpn('pallet', 'wh-bog', 'inbound', 'Operador', ASN_ID)
    expect(lpn.code).toBe('LPN-000001')
    expect(lpn.status).toBe('open')
    expect(useWmsStore.getState().lpns).toHaveLength(1)
  })

  it('rechaza agregar contenido a un LPN cerrado', () => {
    const store = useWmsStore.getState()
    const lpn = store.createLpn('pallet', 'wh-bog', 'inbound', 'Operador')
    store.addToLpn(lpn.id, 'p-arroz', 10)
    useWmsStore.getState().closeLpn(lpn.id)
    expect(() => useWmsStore.getState().addToLpn(lpn.id, 'p-arroz', 5)).toThrow(/cerrado/)
  })

  it('no permite cerrar un LPN vacío', () => {
    const lpn = useWmsStore.getState().createLpn('case', 'wh-bog', 'inbound', 'Operador')
    expect(() => useWmsStore.getState().closeLpn(lpn.id)).toThrow(/vacío/)
  })

  it('no permite mover un LPN que sigue abierto', () => {
    const store = useWmsStore.getState()
    const lpn = store.createLpn('pallet', 'wh-bog', 'inbound', 'Operador')
    store.addToLpn(lpn.id, 'p-arroz', 10)
    expect(() => useWmsStore.getState().moveLpn(lpn.id, 'loc-a-01-01', 'Operador')).toThrow(
      /cerrarse antes/
    )
  })

  it('vincula el stock de staging al LPN para que la unidad sea rastreable', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(ASN_ID, SERIALS.length, 'Operador', 0, SERIALS)

    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === ASN_ID)!
    const lpn = useWmsStore.getState().createLpn('pallet', 'wh-bog', 'inbound', 'Operador', ASN_ID)
    useWmsStore.getState().addToLpn(lpn.id, asn.productId, SERIALS.length)

    const linked = useWmsStore
      .getState()
      .inventoryItems.filter((i) => i.lpnId === lpn.id)
    expect(linked.length).toBeGreaterThan(0)
  })

  it('mover el LPN genera un StockMovement por cada línea contenida', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(ASN_ID, SERIALS.length, 'Operador', 0, SERIALS)
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === ASN_ID)!

    const lpn = useWmsStore.getState().createLpn('pallet', 'wh-bog', 'inbound', 'Operador', ASN_ID)
    useWmsStore.getState().addToLpn(lpn.id, asn.productId, SERIALS.length)
    useWmsStore.getState().closeLpn(lpn.id)

    const before = useWmsStore.getState().stockMovements.length
    const destination = validDestination()
    useWmsStore.getState().moveLpn(lpn.id, destination.id, 'Operador')

    const after = useWmsStore.getState()
    expect(after.stockMovements.length).toBe(before + 1)
    expect(after.lpns.find((l) => l.id === lpn.id)?.status).toBe('stored')
    expect(after.lpns.find((l) => l.id === lpn.id)?.locationId).toBe(destination.id)
  })

  it('consumir el LPN desvincula el stock pero no lo borra', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(ASN_ID, SERIALS.length, 'Operador', 0, SERIALS)
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === ASN_ID)!

    const lpn = useWmsStore.getState().createLpn('pallet', 'wh-bog', 'inbound', 'Operador', ASN_ID)
    useWmsStore.getState().addToLpn(lpn.id, asn.productId, SERIALS.length)
    useWmsStore.getState().closeLpn(lpn.id)

    const itemsBefore = useWmsStore.getState().inventoryItems.length
    useWmsStore.getState().consumeLpn(lpn.id, 'Operador')

    const after = useWmsStore.getState()
    expect(after.lpns.find((l) => l.id === lpn.id)?.status).toBe('consumed')
    expect(after.inventoryItems).toHaveLength(itemsBefore)
    expect(after.inventoryItems.filter((i) => i.lpnId === lpn.id)).toHaveLength(0)
  })

  it('genera una etiqueta imprimible del LPN', () => {
    const lpn = useWmsStore.getState().createLpn('pallet', 'wh-bog', 'inbound', 'Operador')
    const label = useWmsStore.getState().generateLpnLabel(lpn.id, 'Operador')
    expect(label.type).toBe('lpn')
    expect(label.code).toBe(lpn.code)
  })
})

describe('Publicación de inventario (ERP/OMS)', () => {
  it('el putaway publica el stock y mueve la salud de la conexión', () => {
    const store = useWmsStore.getState()
    store.receiveAsn(ASN_ID, SERIALS.length, 'Operador', 0, SERIALS)

    const destination = validDestination()
    useWmsStore.getState().putawayItem(ASN_ID, destination.id, 'Operador')

    const after = useWmsStore.getState()
    expect(after.stockSyncLog.length).toBeGreaterThan(0)
    expect(after.stockSyncLog.every((e) => e.trigger === 'putaway')).toBe(true)

    // La conexión destino deja de mostrar una salud decorativa.
    const target = after.integrations.find((c) => c.id === after.stockSyncLog[0].connectionId)!
    const seedTarget = seed.integrations.find((c) => c.id === target.id)!
    expect(target.processedMessages).toBeGreaterThan(seedTarget.processedMessages)
  })

  it('no publica nada cuando la sincronización está desactivada', () => {
    useWmsStore.setState({
      settings: { ...useWmsStore.getState().settings, stockSyncEnabled: false },
    })
    const store = useWmsStore.getState()
    store.receiveAsn(ASN_ID, SERIALS.length, 'Operador', 0, SERIALS)
    const destination = validDestination()
    useWmsStore.getState().putawayItem(ASN_ID, destination.id, 'Operador')

    expect(useWmsStore.getState().stockSyncLog).toHaveLength(0)
  })
})

describe('Reglas de QC — CRUD', () => {
  it('crea, edita y elimina una regla', () => {
    const created = useWmsStore.getState().addQcRule({
      name: 'Prueba',
      matchType: 'category',
      matchValue: 'Alimentos',
      samplingPercent: 15,
      active: true,
      priority: 20,
      reason: 'muestreo de prueba',
    })
    expect(useWmsStore.getState().qcRules.some((r) => r.id === created.id)).toBe(true)

    useWmsStore.getState().updateQcRule(created.id, { samplingPercent: 40 })
    expect(useWmsStore.getState().qcRules.find((r) => r.id === created.id)?.samplingPercent).toBe(40)

    useWmsStore.getState().deleteQcRule(created.id)
    expect(useWmsStore.getState().qcRules.some((r) => r.id === created.id)).toBe(false)
  })
})
