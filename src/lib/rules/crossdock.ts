import type { Asn, CommerceOrder } from '@/types/wms'

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
      o.items.some(i => i.productId === productId && i.pickedQuantity < i.quantity)
  )
}
