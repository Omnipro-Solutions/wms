import { useWmsStore } from '@/store/wms-store'

/**
 * Shared lookup helpers derived from the central store.
 * Avoids re-defining the same closures in every page component.
 */
export function useStoreHelpers() {
  const products = useWmsStore((s) => s.products)
  const locations = useWmsStore((s) => s.locations)
  const warehouses = useWmsStore((s) => s.warehouses)

  const productName = (id: string): string => products.find((p) => p.id === id)?.name ?? id

  const productSku = (id: string): string => products.find((p) => p.id === id)?.sku ?? id

  const getProduct = (id: string) => products.find((p) => p.id === id)

  const locationCode = (id: string): string => locations.find((l) => l.id === id)?.code ?? id

  const warehouseName = (id: string): string => warehouses.find((w) => w.id === id)?.name ?? id

  return { productName, productSku, getProduct, locationCode, warehouseName }
}
