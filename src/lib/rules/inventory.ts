// Pure inventory quantity rules. The store pairs each successful transform
// with an appended StockMovement so the log and the stock never diverge.

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

// Adjustment sets on-hand to the counted value; caller records the delta.
export function applyAdjustment(item: StockLevels, countedOnHand: number): StockLevels {
  if (countedOnHand < 0) throw new Error('counted quantity cannot be negative')
  return { ...item, onHandQuantity: countedOnHand }
}
