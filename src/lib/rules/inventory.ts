// Pure inventory quantity rules. The store pairs each successful transform
// with an appended StockMovement so the log and the stock never diverge.

import { InventoryItem } from '@/types/wms'

export interface StockLevels {
  onHandQuantity: number
  reservedQuantity: number
  holdQuantity: number
  expirationDate?: string
}

// Returns true when an item is past its expiration date (FIFO gate).
export function isExpired(item: Pick<StockLevels, 'expirationDate'>): boolean {
  if (!item.expirationDate) return false
  return new Date(item.expirationDate) < new Date()
}

export function isNearExpiration(item: Pick<StockLevels, 'expirationDate'>, days: number): boolean {
  if (!item.expirationDate) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  return new Date(item.expirationDate) <= cutoff && !isExpired(item)
}

export function availableStock(item: StockLevels): number {
  return Math.max(0, item.onHandQuantity - item.reservedQuantity - item.holdQuantity)
}

export function applyReserve(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (isExpired(item)) throw new Error('No se puede reservar stock vencido (FIFO)')
  if (qty > availableStock(item)) throw new Error('insufficient available stock')
  return { ...item, reservedQuantity: item.reservedQuantity + qty }
}

export function applyPick(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (qty > item.onHandQuantity || qty > item.reservedQuantity) {
    throw new Error('cannot pick more than on-hand/reserved')
  }
  return {
    ...item,
    onHandQuantity: item.onHandQuantity - qty,
    reservedQuantity: item.reservedQuantity - qty,
  }
}

export function applyReceipt(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  return { ...item, onHandQuantity: item.onHandQuantity + qty }
}

export function applyHold(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (qty > availableStock(item)) throw new Error('insufficient available stock to hold')
  return { ...item, holdQuantity: item.holdQuantity + qty }
}

export function applyRelease(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (qty > item.holdQuantity) throw new Error('cannot release more than held')
  return { ...item, holdQuantity: item.holdQuantity - qty }
}

export function applyScrap(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (qty > item.onHandQuantity) throw new Error('cannot scrap more than on-hand')
  return { ...item, onHandQuantity: item.onHandQuantity - qty }
}

// Internal move — step 1 (pick): pull available units off the source bin. The
// units then live "on the move task" until dropped, so they leave on-hand here.
export function applyInternalMovePick(item: StockLevels, qty: number): StockLevels {
  if (qty <= 0) throw new Error('quantity must be positive')
  if (qty > availableStock(item)) throw new Error('insufficient available stock to move')
  return { ...item, onHandQuantity: item.onHandQuantity - qty }
}

// Internal move — step 2 (drop): land the units on the destination bin. Same math
// as a receipt; the store also stamps the audit movement and the destination status.
export function applyInternalMoveDrop(item: StockLevels, qty: number): StockLevels {
  return applyReceipt(item, qty)
}

// Adjustment sets on-hand to the counted value; caller records the delta.
export function applyAdjustment(item: StockLevels, countedOnHand: number): StockLevels {
  if (countedOnHand < 0) throw new Error('counted quantity cannot be negative')
  return { ...item, onHandQuantity: countedOnHand }
}

// Days since the item first entered stock (InventoryItem.receivedDate). Used for
// aging/low-rotation reporting — never for the FIFO/FEFO expiry gate (that's isExpired).
export const agingDays = (item: { receivedDate?: string }, now: Date = new Date()): number => {
  if (!item.receivedDate) return 0
  const received = new Date(item.receivedDate)
  return Math.max(0, Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24)))
}

export const isLowRotation = (agingInDays: number, thresholdDays: number): boolean =>
  agingInDays > thresholdDays

export type StockStateCode =
  | 'available'
  | 'reserved'
  | 'on_hold'
  | 'quarantine'
  | 'damaged'
  | 'expired'
  | 'in_transit'

// Single source of truth for the "multiple stock states" the catalog asks for.
// Most of these are computed on read rather than stored, so they can never drift
// from the underlying quantities/dates (same principle as availableStock).
export const resolveStockState = (
  item: Pick<StockLevels, 'onHandQuantity' | 'reservedQuantity' | 'holdQuantity' | 'expirationDate'> & {
    status: InventoryItem['status']
  },
  locationType?: string
): StockStateCode => {
  if (isExpired(item)) return 'expired'
  if (item.status === 'damaged') return 'damaged'
  if (item.status === 'on_hold') return locationType === 'quality_control' ? 'quarantine' : 'on_hold'
  if (item.status === 'in_transit') return 'in_transit'
  if (item.reservedQuantity > 0 && availableStock(item) === 0) return 'reserved'
  return 'available'
}

export function selectByStrategy(
  items: Pick<InventoryItem, 'id' | 'onHandQuantity' | 'expirationDate' | 'status' | 'reservedQuantity' | 'holdQuantity'>[],
  strategy: 'fifo' | 'fefo' | 'lifo'
): typeof items {
  const eligible = items.filter(
    i => i.status !== 'on_hold' && i.status !== 'expired' && availableStock(i as InventoryItem) > 0
  )
  if (strategy === 'fefo') {
    return [...eligible].sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0
      if (!a.expirationDate) return 1
      if (!b.expirationDate) return -1
      return a.expirationDate.localeCompare(b.expirationDate)
    })
  }
  if (strategy === 'lifo') {
    return [...eligible].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
  }
  return [...eligible].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}
