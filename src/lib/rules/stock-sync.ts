import type {
  IntegrationConnection,
  InventoryItem,
  Product,
  StockSyncEntry,
  StockSyncTrigger,
} from '@/types/wms'
import { availableStock } from '@/lib/rules/inventory'

// ─── Publicación de inventario hacia ERP/OMS ──────────────────────────────────
// Sin backend real: se arma el payload y se registra la publicación, que es lo
// que alimenta la salud mostrada en /integrations. Al conectar un backend, el
// único cambio es hacer el POST con buildStockSyncPayload().
//
// ponytail: registro en memoria, sin reintentos ni cola. Si se necesita entrega
// garantizada, agregar cola persistente con backoff — no antes.

export interface StockSyncPayload {
  sku: string
  warehouseId: string
  locationId: string
  quantityAvailable: number
  lot?: string
  serial?: string
  timestamp: string
}

export const buildStockSyncPayload = (
  item: InventoryItem,
  product: Pick<Product, 'sku'>
): StockSyncPayload => {
  return {
    sku: product.sku,
    warehouseId: item.warehouseId,
    locationId: item.locationId,
    quantityAvailable: availableStock(item),
    lot: item.lot,
    serial: item.serial,
    timestamp: new Date().toISOString(),
  }
}

// Conexiones elegibles: activas y de tipo ERP/OMS/SAP.
export const syncTargets = (
  connections: IntegrationConnection[],
  configuredIds: string[]
): IntegrationConnection[] => {
  if (configuredIds.length > 0) {
    return connections.filter((c) => configuredIds.includes(c.id) && c.status === 'active')
  }
  return connections.filter(
    (c) => c.status === 'active' && (c.type === 'erp' || c.type === 'oms' || c.type === 'sap')
  )
}

export const buildSyncEntries = (
  payload: StockSyncPayload,
  targets: IntegrationConnection[],
  trigger: StockSyncTrigger,
  idSeed: string
): StockSyncEntry[] => {
  return targets.map((conn) => ({
    id: `sync-${idSeed}-${conn.id}`,
    connectionId: conn.id,
    trigger,
    sku: payload.sku,
    warehouseId: payload.warehouseId,
    locationId: payload.locationId,
    quantityAvailable: payload.quantityAvailable,
    lot: payload.lot,
    serial: payload.serial,
    status: 'sent' as const,
    createdAt: payload.timestamp,
  }))
}

// Salud por conexión, para las tarjetas de /integrations.
export interface SyncHealth {
  connectionId: string
  sent: number
  failed: number
  lastSyncAt?: string
}

export const syncHealthByConnection = (log: StockSyncEntry[]): SyncHealth[] => {
  const byConn = new Map<string, SyncHealth>()
  for (const entry of log) {
    const current = byConn.get(entry.connectionId) ?? {
      connectionId: entry.connectionId,
      sent: 0,
      failed: 0,
    }
    if (entry.status === 'sent') current.sent += 1
    else current.failed += 1
    if (!current.lastSyncAt || entry.createdAt > current.lastSyncAt) {
      current.lastSyncAt = entry.createdAt
    }
    byConn.set(entry.connectionId, current)
  }
  return [...byConn.values()]
}
