import { addDays } from 'date-fns'
import type {
  Carrier,
  CarrierModality,
  CarrierRateQuote,
  CarrierServiceLevel,
  Shipment,
} from '@/types/wms'

export function routeOccupancy(currentLoadKg: number, capacityKg: number): number {
  if (capacityKg <= 0) return 0
  return Math.min(100, Math.round((currentLoadKg / capacityKg) * 100))
}

export function otifPercentage(
  shipments: { otifStatus: 'on_time' | 'at_risk' | 'late' }[]
): number {
  if (shipments.length === 0) return 0
  const onTime = shipments.filter((s) => s.otifStatus === 'on_time').length
  return Math.round((onTime / shipments.length) * 100)
}

// Returns OTIF breakdown counts by status
export function otifBreakdown(shipments: Pick<Shipment, 'otifStatus'>[]) {
  const counts = { on_time: 0, at_risk: 0, late: 0 }
  for (const s of shipments) counts[s.otifStatus]++
  return counts
}

// Per-carrier OTIF aggregation — used in the carrier performance table
export function otifByCarrier(
  shipments: Pick<Shipment, 'carrierId' | 'carrierName' | 'otifStatus'>[]
): { carrierId: string; carrierName: string; total: number; onTimeRate: number }[] {
  const map = new Map<string, { carrierName: string; total: number; onTime: number }>()

  for (const s of shipments) {
    const key = s.carrierId ?? s.carrierName
    const entry = map.get(key) ?? { carrierName: s.carrierName, total: 0, onTime: 0 }
    entry.total++
    if (s.otifStatus === 'on_time') entry.onTime++
    map.set(key, entry)
  }

  return Array.from(map.entries()).map(([carrierId, v]) => ({
    carrierId,
    carrierName: v.carrierName,
    total: v.total,
    onTimeRate: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
  }))
}

// Calculate quoted cost for a service given weight
export function calculateQuotedCost(
  baseCostUsd: number,
  costPerKgUsd: number,
  weightKg: number
): number {
  return Math.round((baseCostUsd + costPerKgUsd * weightKg) * 100) / 100
}

// Rate shop: returns all available quotes for the given weight + destination zone,
// sorted by cost ascending. Filters out services that don't cover the zone or
// exceed the weight limit.
export interface RateShopOptions {
  // Modalidades habilitadas (/shipping-settings). Vacío o ausente = todas.
  enabledModalities?: CarrierModality[]
  // 'cheapest' ordena por costo, 'fastest' por días de tránsito.
  strategy?: 'cheapest' | 'fastest'
}

export function rateShop(
  carriers: Carrier[],
  weightKg: number,
  destinationZone: string,
  dispatchDate: string, // ISO date string, e.g. "2026-06-16"
  options: RateShopOptions = {}
): CarrierRateQuote[] {
  const quotes: CarrierRateQuote[] = []
  const { enabledModalities, strategy = 'cheapest' } = options

  for (const carrier of carriers) {
    if (!carrier.active) continue
    // A carrier with no declared modality is always eligible — only filter the ones
    // that declare a modality the configuration has switched off.
    if (
      enabledModalities?.length &&
      carrier.modalityType &&
      !enabledModalities.includes(carrier.modalityType)
    )
      continue

    for (const service of carrier.services) {
      if (!service.availableZones.includes(destinationZone)) continue
      if (weightKg > service.maxWeightKg) continue

      const quotedCostUsd = calculateQuotedCost(service.baseCostUsd, service.costPerKgUsd, weightKg)
      const estimatedDeliveryDate = addDays(new Date(dispatchDate), service.transitDays).toISOString().slice(0, 10)

      quotes.push({
        carrierId: carrier.id,
        carrierName: carrier.name,
        serviceLevel: service.serviceLevel,
        serviceLabel: service.label,
        quotedCostUsd,
        estimatedTransitDays: service.transitDays,
        estimatedDeliveryDate,
      })
    }
  }

  return quotes.sort((a, b) =>
    strategy === 'fastest'
      ? a.estimatedTransitDays - b.estimatedTransitDays || a.quotedCostUsd - b.quotedCostUsd
      : a.quotedCostUsd - b.quotedCostUsd || a.estimatedTransitDays - b.estimatedTransitDays
  )
}

// Quote recommended by the configured strategy — the first of an already-sorted list.
// Under 'fastest', a quote is only accepted if its premium over the cheapest option
// stays within maxCostOverBestPct; otherwise the cheapest wins.
export const recommendedQuote = (
  quotes: CarrierRateQuote[],
  maxCostOverBestPct: number
): CarrierRateQuote | null => {
  if (quotes.length === 0) return null
  const cheapest = quotes.reduce((min, q) => (q.quotedCostUsd < min.quotedCostUsd ? q : min))
  const preferred = quotes[0]
  if (preferred.carrierId === cheapest.carrierId && preferred.serviceLevel === cheapest.serviceLevel)
    return preferred
  if (cheapest.quotedCostUsd <= 0) return preferred
  const premium = (preferred.quotedCostUsd - cheapest.quotedCostUsd) / cheapest.quotedCostUsd
  return premium <= maxCostOverBestPct ? preferred : cheapest
}

// Load verification (#7 Estándar) — bultos confirmados vs. bultos esperados.
export type LoadVerificationStatus = 'pending' | 'verified' | 'partial' | 'over'

export const loadVerificationStatus = (
  verifiedPackages: number,
  expectedPackages: number
): LoadVerificationStatus => {
  if (verifiedPackages <= 0) return 'pending'
  if (verifiedPackages > expectedPackages) return 'over'
  if (verifiedPackages < expectedPackages) return 'partial'
  return 'verified'
}

export interface ConsolidationGroup {
  destinationCity: string
  shipmentIds: string[]
  totalPackages: number
  totalWeightKg: number
  carrierNames: string[]
}

// Groups pending shipments that share a destination city, so they can travel on one
// route instead of one truck per order. Only groups of 2+ are worth consolidating.
export const consolidationGroups = (
  shipments: Pick<
    Shipment,
    'id' | 'status' | 'destinationCity' | 'packageCount' | 'weightKg' | 'carrierName'
  >[]
): ConsolidationGroup[] => {
  const map = new Map<string, ConsolidationGroup>()

  for (const s of shipments) {
    if (s.status !== 'pending') continue
    const city = s.destinationCity?.trim()
    if (!city) continue
    const key = city.toLowerCase()
    const group = map.get(key) ?? {
      destinationCity: city,
      shipmentIds: [],
      totalPackages: 0,
      totalWeightKg: 0,
      carrierNames: [],
    }
    group.shipmentIds.push(s.id)
    group.totalPackages += s.packageCount
    group.totalWeightKg += s.weightKg
    if (!group.carrierNames.includes(s.carrierName)) group.carrierNames.push(s.carrierName)
    map.set(key, group)
  }

  return Array.from(map.values())
    .filter((g) => g.shipmentIds.length > 1)
    .sort((a, b) => b.shipmentIds.length - a.shipmentIds.length)
}

export const MODALITY_LABELS: Record<CarrierModality, string> = {
  own: 'Flota propia',
  third_party: 'Tercero',
  courier: 'Courier',
  last_mile: 'Última milla',
}

// Resolve the carrier zone code for a given city
export function resolveCarrierZone(carrier: Carrier, city: string): string | null {
  for (const zone of carrier.zones) {
    if (zone.cities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      return zone.code
    }
  }
  return null
}

// Returns an OTIF status based on promised date vs. estimated delivery date
export function deriveOtifStatus(
  promisedDate: string,
  estimatedDeliveryDate: string,
  atRiskDays = 1 // holgura configurable — settings.shippingOtifAtRiskDays
): Shipment['otifStatus'] {
  const promised = new Date(promisedDate).getTime()
  const estimated = new Date(estimatedDeliveryDate).getTime()
  const diffDays = (estimated - promised) / (1000 * 60 * 60 * 24)

  if (diffDays <= 0) return 'on_time'
  if (diffDays <= atRiskDays) return 'at_risk'
  return 'late'
}

export interface OtifAlert {
  shipmentId: string
  orderNumber: string
  customerName: string
  carrierName: string
  serviceLabel: string
  promisedDate: string
  estimatedDeliveryDate: string
  otifStatus: Shipment['otifStatus']
  daysOverdue: number // negative = early, 0 = on promised date, positive = late
}

// Returns at-risk and late shipments that haven't been delivered yet,
// sorted by urgency (most overdue first).
export function otifAlerts(
  shipments: Shipment[],
  orderNumberMap: Record<string, string>, // orderId → orderNumber
  today: string // ISO date string e.g. "2026-06-16"
): OtifAlert[] {
  const todayMs = new Date(today).getTime()

  return shipments
    .filter(
      (s) =>
        (s.otifStatus === 'at_risk' || s.otifStatus === 'late') &&
        s.status !== 'completed' &&
        s.status !== 'cancelled'
    )
    .map((s) => {
      const promised = s.promisedDate ? new Date(s.promisedDate).getTime() : todayMs
      const daysOverdue = Math.round((todayMs - promised) / (1000 * 60 * 60 * 24))
      return {
        shipmentId: s.id,
        orderNumber: orderNumberMap[s.orderId] ?? s.orderId,
        customerName: s.customerName,
        carrierName: s.carrierName,
        serviceLabel: s.serviceLevel ? SERVICE_LEVEL_LABELS[s.serviceLevel] : '—',
        promisedDate: s.promisedDate ?? today,
        estimatedDeliveryDate: s.estimatedDeliveryDate ?? today,
        otifStatus: s.otifStatus,
        daysOverdue,
      }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

// Cost summary per carrier
export function costByCarrier(
  shipments: Pick<Shipment, 'carrierId' | 'carrierName' | 'quotedCostUsd'>[]
): { carrierId: string; carrierName: string; totalCost: number; shipmentCount: number }[] {
  const map = new Map<string, { carrierName: string; totalCost: number; shipmentCount: number }>()

  for (const s of shipments) {
    const key = s.carrierId ?? s.carrierName
    const entry = map.get(key) ?? { carrierName: s.carrierName, totalCost: 0, shipmentCount: 0 }
    entry.totalCost += s.quotedCostUsd ?? 0
    entry.shipmentCount++
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([carrierId, v]) => ({ carrierId, ...v }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

// Human-readable label for a CarrierServiceLevel
export const SERVICE_LEVEL_LABELS: Record<CarrierServiceLevel, string> = {
  same_day: 'Mismo día',
  next_day: 'Día siguiente',
  two_day: 'Dos días',
  ground: 'Terrestre estándar',
  economy: 'Económico',
}
