import type { Asn, CommerceOrder, InventoryItem } from '@/types/wms'
import { availableStock } from '@/lib/rules/inventory'

/**
 * An ASN can cross-dock if: flag is set, no QC required, and reception is active.
 */
export function canCrossDock(asn: Pick<Asn, 'crossDocking' | 'requiresQualityControl' | 'status'>): boolean {
  return (
    asn.crossDocking &&
    !asn.requiresQualityControl &&
    (asn.status === 'in_progress' || asn.status === 'partial' || asn.status === 'pending')
  )
}

/**
 * Returns pending commerce orders with fulfillmentType=cross_docking that need productId.
 */
export function matchCrossDockOrders(productId: string, orders: CommerceOrder[]): CommerceOrder[] {
  return orders.filter(
    o =>
      o.fulfillmentType === 'cross_docking' &&
      o.status === 'pending' &&
      o.items.some(i => i.productId === productId && (i.pickedQuantity ?? 0) < i.requestedQuantity)
  )
}

// ─── Cross-dock proactivo ─────────────────────────────────────────────────────
// Manhattan avisa solo: cuando entra mercancía que un pedido está esperando,
// el sistema alerta en vez de esperar a que el operario abra un diálogo.

// Unidades de un SKU que un pedido todavía necesita.
function outstandingUnits(order: CommerceOrder, productId: string): number {
  return order.items
    .filter(i => i.productId === productId)
    .reduce((sum, i) => sum + Math.max(0, i.requestedQuantity - (i.pickedQuantity ?? 0)), 0)
}

/**
 * Un pedido está en backorder para un SKU cuando necesita unidades que el stock
 * disponible del almacén no alcanza a cubrir. Es el disparador más fuerte de
 * cross-dock: la mercancía que llega desbloquea un pedido detenido.
 */
export function isBackordered(
  order: CommerceOrder,
  productId: string,
  warehouseId: string,
  inventory: InventoryItem[]
): boolean {
  const needed = outstandingUnits(order, productId)
  if (needed === 0) return false
  const onHand = inventory
    .filter(i => i.productId === productId && i.warehouseId === warehouseId)
    .reduce((sum, i) => sum + availableStock(i), 0)
  return onHand < needed
}

export interface CrossDockOpportunity {
  asnId: string
  asnCode: string
  productId: string
  order: CommerceOrder
  neededQuantity: number
  /** Un pedido sin stock que lo cubra es más urgente que uno que solo prefiere cross-dock. */
  isBackorder: boolean
}

/**
 * Cruza los ASN en recepción contra los pedidos que esperan ese SKU.
 * Los backorders se listan primero — son los que están frenando despacho.
 */
export function findCrossDockOpportunities(
  asns: Asn[],
  orders: CommerceOrder[],
  inventory: InventoryItem[],
  warehouseId = 'wh-bog'
): CrossDockOpportunity[] {
  const opportunities: CrossDockOpportunity[] = []

  for (const asn of asns) {
    if (!canCrossDock(asn)) continue
    // Recorre lines[] cuando existe; cae a productId para ASNs legacy.
    const productIds = asn.lines?.length ? asn.lines.map(l => l.productId) : [asn.productId]

    for (const productId of productIds) {
      for (const order of matchCrossDockOrders(productId, orders)) {
        opportunities.push({
          asnId: asn.id,
          asnCode: asn.code,
          productId,
          order,
          neededQuantity: outstandingUnits(order, productId),
          isBackorder: isBackordered(order, productId, warehouseId, inventory),
        })
      }
    }
  }

  return opportunities.sort((a, b) => Number(b.isBackorder) - Number(a.isBackorder))
}
