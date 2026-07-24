import { describe, expect, it } from 'vitest'
import type { Asn, CommerceOrder, Dock, DockAppointment, InventoryItem, Lpn, LpnLine, QcRule } from '@/types/wms'
import {
  applyLineReceipt,
  asnExpectedTotal,
  ensureAsnLines,
  isAsnFullyReceived,
  lineOutstanding,
  syncAsnAggregates,
} from '@/lib/rules/asn'
import { canCloseLpn, canMoveLpn, isMixedLpn, lpnTotalUnits, nextLpnCode } from '@/lib/rules/lpn'
import { evaluateQcRules } from '@/lib/rules/qc'
import { findCrossDockOpportunities, isBackordered } from '@/lib/rules/crossdock'
import { suggestDock } from '@/lib/rules/yard'

const baseAsn: Asn = {
  id: 'asn-1',
  code: 'ASN-001',
  supplierName: 'Importadora Andina',
  appointmentDate: '2026-07-24',
  expectedQuantity: 100,
  receivedQuantity: 0,
  damagedQuantity: 0,
  status: 'pending',
  requiresQualityControl: false,
  crossDocking: false,
  productId: 'prod-1',
  deliveryCount: 0,
  sourceType: 'purchase',
}

describe('ASN multi-línea', () => {
  it('hidrata lines[] desde los campos legacy', () => {
    const hydrated = ensureAsnLines(baseAsn)
    expect(hydrated.lines).toHaveLength(1)
    expect(hydrated.lines?.[0]).toMatchObject({ productId: 'prod-1', expectedQuantity: 100 })
  })

  it('no re-hidrata un ASN que ya tiene líneas', () => {
    const multi = { ...baseAsn, lines: [
      { productId: 'prod-1', expectedQuantity: 60, receivedQuantity: 0, damagedQuantity: 0 },
      { productId: 'prod-2', expectedQuantity: 40, receivedQuantity: 0, damagedQuantity: 0 },
    ] }
    expect(ensureAsnLines(multi).lines).toHaveLength(2)
  })

  it('syncAsnAggregates recalcula los campos espejo desde lines[]', () => {
    const multi: Asn = { ...baseAsn, expectedQuantity: 0, lines: [
      { productId: 'prod-1', expectedQuantity: 60, receivedQuantity: 10, damagedQuantity: 2 },
      { productId: 'prod-2', expectedQuantity: 40, receivedQuantity: 5, damagedQuantity: 0 },
    ] }
    const synced = syncAsnAggregates(multi)
    expect(synced.expectedQuantity).toBe(100)
    expect(synced.receivedQuantity).toBe(15)
    expect(synced.damagedQuantity).toBe(2)
    expect(synced.productId).toBe('prod-1')
  })

  it('applyLineReceipt solo afecta la línea del SKU recibido', () => {
    const lines = [
      { productId: 'prod-1', expectedQuantity: 60, receivedQuantity: 0, damagedQuantity: 0 },
      { productId: 'prod-2', expectedQuantity: 40, receivedQuantity: 0, damagedQuantity: 0 },
    ]
    const next = applyLineReceipt(lines, 'prod-2', 30, 5)
    expect(next[0].receivedQuantity).toBe(0)
    expect(next[1]).toMatchObject({ receivedQuantity: 30, damagedQuantity: 5 })
  })

  it('applyLineReceipt rechaza un SKU ajeno al ASN', () => {
    const lines = [{ productId: 'prod-1', expectedQuantity: 60, receivedQuantity: 0, damagedQuantity: 0 }]
    expect(() => applyLineReceipt(lines, 'prod-9', 10, 0)).toThrow(/no pertenece/)
  })

  it('el ASN queda completo solo cuando TODAS las líneas están saldadas', () => {
    const partial = [
      { productId: 'prod-1', expectedQuantity: 60, receivedQuantity: 60, damagedQuantity: 0 },
      { productId: 'prod-2', expectedQuantity: 40, receivedQuantity: 10, damagedQuantity: 0 },
    ]
    expect(isAsnFullyReceived(partial)).toBe(false)
    const full = applyLineReceipt(partial, 'prod-2', 30, 0)
    expect(isAsnFullyReceived(full)).toBe(true)
  })

  it('las unidades dañadas saldan la línea (no quedan pendientes por siempre)', () => {
    const line = { productId: 'prod-1', expectedQuantity: 10, receivedQuantity: 8, damagedQuantity: 2 }
    expect(lineOutstanding(line)).toBe(0)
  })

  it('un excedente no produce saldo negativo', () => {
    const line = { productId: 'prod-1', expectedQuantity: 10, receivedQuantity: 15, damagedQuantity: 0 }
    expect(lineOutstanding(line)).toBe(0)
  })

  it('asnExpectedTotal suma todas las líneas', () => {
    expect(asnExpectedTotal([
      { productId: 'a', expectedQuantity: 10, receivedQuantity: 0, damagedQuantity: 0 },
      { productId: 'b', expectedQuantity: 25, receivedQuantity: 0, damagedQuantity: 0 },
    ])).toBe(35)
  })
})

describe('LPN', () => {
  const lpn: Lpn = {
    id: 'lpn-1',
    code: 'LPN-000001',
    type: 'pallet',
    status: 'open',
    warehouseId: 'wh-bog',
    sourceType: 'inbound',
    createdAt: '2026-07-24T10:00:00.000Z',
  }
  const lines: LpnLine[] = [
    { id: 'l1', lpnId: 'lpn-1', productId: 'prod-1', quantity: 30 },
    { id: 'l2', lpnId: 'lpn-1', productId: 'prod-2', quantity: 20 },
  ]

  it('genera códigos correlativos con padding', () => {
    expect(nextLpnCode([], 'LPN')).toBe('LPN-000001')
    expect(nextLpnCode([lpn], 'LPN')).toBe('LPN-000002')
  })

  it('ignora códigos que no siguen el patrón al calcular el siguiente', () => {
    const foreign: Lpn = { ...lpn, id: 'x', code: 'SSCC-99999999' }
    expect(nextLpnCode([foreign], 'LPN')).toBe('LPN-000001')
  })

  it('detecta un pallet mixto y cuenta sus unidades', () => {
    expect(isMixedLpn('lpn-1', lines)).toBe(true)
    expect(lpnTotalUnits('lpn-1', lines)).toBe(50)
  })

  it('no permite cerrar un LPN vacío', () => {
    expect(canCloseLpn(lpn, []).valid).toBe(false)
    expect(canCloseLpn(lpn, []).reasons).toContain('el LPN está vacío')
  })

  it('permite cerrar un LPN abierto con contenido', () => {
    expect(canCloseLpn(lpn, lines).valid).toBe(true)
  })

  it('no permite mover un LPN todavía abierto', () => {
    expect(canMoveLpn(lpn).valid).toBe(false)
  })

  it('permite mover un LPN cerrado y bloquea uno consumido', () => {
    expect(canMoveLpn({ ...lpn, status: 'closed' }).valid).toBe(true)
    expect(canMoveLpn({ ...lpn, status: 'consumed' }).valid).toBe(false)
  })
})

describe('Reglas de QC', () => {
  const rules: QcRule[] = [
    { id: 'r-cat', name: 'Electrónica 20%', matchType: 'category', matchValue: 'Electrónica', samplingPercent: 20, active: true, priority: 10, reason: 'daño en transporte' },
    { id: 'r-sup', name: 'Proveedor total', matchType: 'supplier', matchValue: 'Importadora Andina', samplingPercent: 100, active: true, priority: 5, reason: 'vigilancia' },
  ]
  const product = { id: 'prod-1', category: 'Electrónica' }

  it('gana la regla de menor priority', () => {
    const verdict = evaluateQcRules(product, 'Importadora Andina', 'A', 50, rules)
    expect(verdict.rule?.id).toBe('r-sup')
    expect(verdict.sampledQuantity).toBe(50)
  })

  it('aplica la regla de categoría cuando el proveedor no coincide', () => {
    const verdict = evaluateQcRules(product, 'Otro Proveedor', 'A', 50, rules)
    expect(verdict.rule?.id).toBe('r-cat')
    expect(verdict.sampledQuantity).toBe(10)
  })

  it('redondea el muestreo hacia arriba — nunca desvía media unidad', () => {
    const verdict = evaluateQcRules(product, 'Otro', 'A', 15, rules)
    expect(verdict.sampledQuantity).toBe(3) // ceil(15 * 0.20) = 3
  })

  it('compara el proveedor sin distinguir mayúsculas ni espacios', () => {
    const verdict = evaluateQcRules(product, '  importadora andina ', 'A', 10, rules)
    expect(verdict.rule?.id).toBe('r-sup')
  })

  it('no desvía nada cuando ninguna regla aplica', () => {
    const verdict = evaluateQcRules({ id: 'p9', category: 'Alimentos' }, 'Otro', 'C', 10, rules)
    expect(verdict.requiresQc).toBe(false)
    expect(verdict.sampledQuantity).toBe(0)
  })

  it('ignora las reglas inactivas', () => {
    const inactive = rules.map((r) => ({ ...r, active: false }))
    expect(evaluateQcRules(product, 'Importadora Andina', 'A', 10, inactive).requiresQc).toBe(false)
  })

  it('el muestreo nunca supera la cantidad esperada', () => {
    const verdict = evaluateQcRules(product, 'Importadora Andina', 'A', 3, rules)
    expect(verdict.sampledQuantity).toBe(3)
  })
})

describe('Cross-dock proactivo', () => {
  const order: CommerceOrder = {
    id: 'ord-1',
    orderNumber: 'ORD-001',
    channel: 'ecommerce',
    fulfillmentType: 'cross_docking',
    status: 'pending',
    customerName: 'Cliente',
    createdAt: '2026-07-24T08:00:00.000Z',
    promisedDeliveryDate: '2026-07-25T08:00:00.000Z',
    items: [{ id: 'oi-1', productId: 'prod-1', requestedQuantity: 20, pickedQuantity: 0 }],
  }

  const asn: Asn = { ...baseAsn, crossDocking: true, status: 'in_progress' }

  it('marca backorder cuando el stock disponible no cubre lo pedido', () => {
    const noStock: InventoryItem[] = []
    expect(isBackordered(order, 'prod-1', 'wh-bog', noStock)).toBe(true)
  })

  it('no marca backorder cuando hay stock suficiente', () => {
    const stocked: InventoryItem[] = [{
      id: 'inv-1', productId: 'prod-1', warehouseId: 'wh-bog', locationId: 'loc-a',
      onHandQuantity: 50, reservedQuantity: 0, holdQuantity: 0, status: 'available',
    }]
    expect(isBackordered(order, 'prod-1', 'wh-bog', stocked)).toBe(false)
  })

  it('el stock reservado no cuenta como disponible', () => {
    const reserved: InventoryItem[] = [{
      id: 'inv-1', productId: 'prod-1', warehouseId: 'wh-bog', locationId: 'loc-a',
      onHandQuantity: 50, reservedQuantity: 45, holdQuantity: 0, status: 'available',
    }]
    expect(isBackordered(order, 'prod-1', 'wh-bog', reserved)).toBe(true)
  })

  it('encuentra la oportunidad y ordena los backorders primero', () => {
    const covered: CommerceOrder = { ...order, id: 'ord-2', orderNumber: 'ORD-002' }
    const stocked: InventoryItem[] = [{
      id: 'inv-1', productId: 'prod-1', warehouseId: 'wh-bog', locationId: 'loc-a',
      onHandQuantity: 100, reservedQuantity: 0, holdQuantity: 0, status: 'available',
    }]
    // Con stock de sobra, ninguno es backorder; sin stock, ambos lo son.
    const withStock = findCrossDockOpportunities([asn], [order, covered], stocked)
    expect(withStock.every((o) => !o.isBackorder)).toBe(true)

    const without = findCrossDockOpportunities([asn], [order], [])
    expect(without[0].isBackorder).toBe(true)
    expect(without[0].neededQuantity).toBe(20)
  })

  it('ignora ASNs que no pueden cross-dockear', () => {
    const qcAsn: Asn = { ...asn, requiresQualityControl: true }
    expect(findCrossDockOpportunities([qcAsn], [order], [])).toHaveLength(0)
  })

  it('recorre todas las líneas de un ASN multi-SKU', () => {
    const multi: Asn = { ...asn, lines: [
      { productId: 'prod-9', expectedQuantity: 10, receivedQuantity: 0, damagedQuantity: 0 },
      { productId: 'prod-1', expectedQuantity: 10, receivedQuantity: 0, damagedQuantity: 0 },
    ] }
    // prod-1 está en la segunda línea: sin recorrer lines[] no se encontraría.
    expect(findCrossDockOpportunities([multi], [order], [])).toHaveLength(1)
  })
})

describe('Sugerencia de muelle', () => {
  const docks: Dock[] = [
    { id: 'd1', code: 'M-01', name: 'Muelle 1', warehouseId: 'wh-bog', type: 'inbound', status: 'active' },
    { id: 'd2', code: 'M-02', name: 'Muelle 2', warehouseId: 'wh-bog', type: 'mixed', status: 'active' },
    { id: 'd3', code: 'M-03', name: 'Muelle 3', warehouseId: 'wh-bog', type: 'inbound', status: 'blocked' },
    { id: 'd4', code: 'M-04', name: 'Muelle 4', warehouseId: 'wh-bog', type: 'outbound', status: 'active' },
  ]
  const appointment = {
    id: 'ap-1', type: 'inbound' as const, warehouseId: 'wh-bog',
    scheduledStart: '2026-07-24T08:00:00.000Z', scheduledEnd: '2026-07-24T10:00:00.000Z',
  }

  it('prefiere el muelle dedicado sobre el mixto', () => {
    const ranked = suggestDock(appointment, docks, [], undefined, [])
    expect(ranked[0].dock.id).toBe('d1')
  })

  it('descarta el muelle bloqueado y el de dirección contraria', () => {
    const ranked = suggestDock(appointment, docks, [], undefined, [])
    expect(ranked.find((r) => r.dock.id === 'd3')?.score).toBe(0)
    expect(ranked.find((r) => r.dock.id === 'd4')?.score).toBe(0)
  })

  it('penaliza el muelle con una cita solapada', () => {
    const conflicting: DockAppointment[] = [{
      id: 'ap-x', code: 'CITA-X', warehouseId: 'wh-bog', dockId: 'd1', type: 'inbound',
      status: 'scheduled', scheduledStart: '2026-07-24T09:00:00.000Z', scheduledEnd: '2026-07-24T11:00:00.000Z',
    }]
    const ranked = suggestDock(appointment, docks, conflicting, undefined, [])
    const d1 = ranked.find((r) => r.dock.id === 'd1')!
    const d2 = ranked.find((r) => r.dock.id === 'd2')!
    expect(d1.score).toBeLessThan(d2.score)
    expect(d1.reasons).toContain('ya tiene una cita solapada')
  })

  it('solo considera muelles del almacén de la cita', () => {
    const otherWh: Dock[] = [{ ...docks[0], id: 'd9', warehouseId: 'wh-mde' }]
    expect(suggestDock(appointment, otherWh, [], undefined, [])).toHaveLength(0)
  })

  it('premia el cross-dock cuando no hay datos de distancia', () => {
    const plain = suggestDock(appointment, docks, [], { crossDocking: false }, [])
    const cross = suggestDock(appointment, docks, [], { crossDocking: true }, [])
    expect(cross[0].score).toBeGreaterThan(plain[0].score)
  })
})
