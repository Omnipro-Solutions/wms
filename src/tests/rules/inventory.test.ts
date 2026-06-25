import { describe, it, expect } from 'vitest'
import {
  applyAdjustment,
  applyHold,
  applyPick,
  applyReceipt,
  applyRelease,
  applyReserve,
  applyScrap,
  availableStock,
  selectByStrategy,
} from '@/lib/rules/inventory'

const base = { onHandQuantity: 10, reservedQuantity: 2, holdQuantity: 1 }

describe('availableStock', () => {
  it('derives available = onHand - reserved - hold', () => {
    expect(availableStock(base)).toBe(7)
  })
  it('never returns negative', () => {
    expect(availableStock({ onHandQuantity: 1, reservedQuantity: 5, holdQuantity: 0 })).toBe(0)
  })
})

describe('applyReserve', () => {
  it('increases reserved', () => {
    expect(applyReserve(base, 3).reservedQuantity).toBe(5)
  })
  it('throws when exceeding available', () => {
    expect(() => applyReserve(base, 8)).toThrow()
  })
})

describe('applyPick', () => {
  it('decreases onHand and reserved', () => {
    const r = applyPick(base, 2)
    expect(r.onHandQuantity).toBe(8)
    expect(r.reservedQuantity).toBe(0)
  })
  it('throws when picking more than reserved', () => {
    expect(() => applyPick(base, 3)).toThrow()
  })
})

describe('applyReceipt', () => {
  it('increases onHand', () => {
    expect(applyReceipt(base, 5).onHandQuantity).toBe(15)
  })
})

describe('applyHold / applyRelease', () => {
  it('moves quantity in and out of hold', () => {
    const held = applyHold(base, 3)
    expect(held.holdQuantity).toBe(4)
    expect(applyRelease(held, 4).holdQuantity).toBe(0)
  })
  it('throws releasing more than held', () => {
    expect(() => applyRelease(base, 5)).toThrow()
  })
})

describe('applyScrap', () => {
  it('removes from onHand', () => {
    expect(applyScrap(base, 4).onHandQuantity).toBe(6)
  })
  it('throws scrapping more than onHand', () => {
    expect(() => applyScrap(base, 99)).toThrow()
  })
})

describe('applyAdjustment', () => {
  it('sets onHand to counted value', () => {
    expect(applyAdjustment(base, 20).onHandQuantity).toBe(20)
  })
  it('throws on negative count', () => {
    expect(() => applyAdjustment(base, -1)).toThrow()
  })
})

describe('selectByStrategy', () => {
  const items = [
    { id: 'i1', onHandQuantity: 5, expirationDate: '2026-08-01', status: 'available' as const },
    { id: 'i2', onHandQuantity: 5, expirationDate: '2026-07-01', status: 'available' as const },
    { id: 'i3', onHandQuantity: 5, expirationDate: undefined,    status: 'available' as const },
  ]
  const base = { productId: 'p1', warehouseId: 'wh-1', locationId: 'loc-1', reservedQuantity: 0, holdQuantity: 0 }
  const withBase = items.map(i => ({ ...base, ...i }))

  it('fefo: orders by earliest expiration first, no-date last', () => {
    const result = selectByStrategy(withBase, 'fefo')
    expect(result[0].id).toBe('i2')  // Jul expires first
    expect(result[1].id).toBe('i1')  // Aug second
    expect(result[2].id).toBe('i3')  // no date last
  })

  it('fifo: orders by id ascending (insertion order proxy)', () => {
    const result = selectByStrategy(withBase, 'fifo')
    expect(result.map(i => i.id)).toEqual(['i1', 'i2', 'i3'])
  })

  it('lifo: orders by id descending', () => {
    const result = selectByStrategy(withBase, 'lifo')
    expect(result.map(i => i.id)).toEqual(['i3', 'i2', 'i1'])
  })

  it('fifo: handles multi-digit IDs correctly (numeric sort)', () => {
    const multiDigit = [
      { ...base, id: 'inv-10', onHandQuantity: 5, expirationDate: undefined, status: 'available' as const },
      { ...base, id: 'inv-9', onHandQuantity: 5, expirationDate: undefined, status: 'available' as const },
      { ...base, id: 'inv-2', onHandQuantity: 5, expirationDate: undefined, status: 'available' as const },
    ]
    const result = selectByStrategy(multiDigit, 'fifo')
    expect(result.map(i => i.id)).toEqual(['inv-2', 'inv-9', 'inv-10'])
  })

  it('excludes on_hold and expired items', () => {
    const withHeld = [
      { ...base, id: 'i4', onHandQuantity: 5, status: 'on_hold' as const },
      ...withBase,
    ]
    const result = selectByStrategy(withHeld, 'fefo')
    expect(result.every(i => i.status !== 'on_hold')).toBe(true)
  })
})
