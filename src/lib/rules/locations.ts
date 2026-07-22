// Pure rules for the warehouse-structure module (#4). No store or React imports.
// Cover the hierarchical layout model, golden-zone eligibility, occupancy and
// rack/product compatibility ("tipo de estiba según rack y producto").

import type { Product, RackType, StorageLocation, WmsSettings } from '@/types/wms'

// Rough volume (m³) a single unit occupies. The /locations occupancy bar has
// always used this factor; centralised here so the map and the table agree.
export const UNIT_VOLUME_M3_APPROX = 0.002

export const LOCATION_TYPE_LABELS: Record<StorageLocation['type'], string> = {
  pick: 'Pick',
  reserve: 'Reserva',
  quality_control: 'Control de calidad',
  staging: 'Staging',
  returns: 'Devoluciones',
}

export const RACK_STYLE_LABELS: Record<RackType['storageStyle'], string> = {
  selective: 'Selectivo',
  drive_in: 'Drive-in / compacto',
  push_back: 'Push-back',
  cantilever: 'Cantilever',
  floor: 'Piso / bulk',
  mezzanine: 'Entrepiso / picking',
}

// ── Hierarchy ────────────────────────────────────────────────────────────────

export interface LocationHierarchyParts {
  zone: string
  aisle?: string
  rack?: string
  level?: string
  position?: string
}

// Builds the canonical code "Z-AA-RR-LL-PP" from the structured parts, skipping
// missing segments. Used by the layout generator and the create/edit form.
export function buildLocationCode(parts: LocationHierarchyParts): string {
  return [parts.zone, parts.aisle, parts.rack, parts.level, parts.position]
    .filter((p): p is string => Boolean(p))
    .join('-')
}

// Human-readable breadcrumb for the detail view / tooltips.
export function locationHierarchyPath(loc: StorageLocation): string {
  const segments: string[] = [`Zona ${loc.zone}`]
  if (loc.aisle) segments.push(`Pasillo ${loc.aisle}`)
  if (loc.rack) segments.push(`Rack ${loc.rack}`)
  if (loc.level) segments.push(`Nivel ${loc.level}`)
  if (loc.position) segments.push(`Pos. ${loc.position}`)
  return segments.join(' · ')
}

// ── Golden zone ──────────────────────────────────────────────────────────────

// A location qualifies for the golden zone when it is both close to dispatch and
// highly accessible, per the two configurable thresholds. This is what the golden
// flag *should* be; the stored `golden` boolean can drift until reclassified.
export function isGoldenEligible(
  loc: Pick<StorageLocation, 'distanceToDispatchM' | 'accessibilityScore' | 'type'>,
  settings: Pick<WmsSettings, 'goldenMaxDistanceM' | 'goldenMinAccessibility'>
): boolean {
  if (loc.type !== 'pick') return false // solo las posiciones de picking pueden ser golden
  return (
    loc.distanceToDispatchM <= settings.goldenMaxDistanceM &&
    loc.accessibilityScore >= settings.goldenMinAccessibility
  )
}

// True when the stored golden flag disagrees with the threshold-derived eligibility.
export function hasGoldenMismatch(
  loc: StorageLocation,
  settings: Pick<WmsSettings, 'goldenMaxDistanceM' | 'goldenMinAccessibility'>
): boolean {
  return isGoldenEligible(loc, settings) !== loc.golden
}

// ── Occupancy ────────────────────────────────────────────────────────────────

export function estimatedVolumeUsedM3(onHandUnits: number): number {
  return onHandUnits * UNIT_VOLUME_M3_APPROX
}

export function locationUtilizationPct(onHandUnits: number, capacityM3: number): number {
  if (capacityM3 <= 0) return 0
  return Math.round((estimatedVolumeUsedM3(onHandUnits) / capacityM3) * 100)
}

export function isOverUtilized(
  utilizationPct: number,
  settings: Pick<WmsSettings, 'locationHighUtilizationPct'>
): boolean {
  return utilizationPct >= settings.locationHighUtilizationPct
}

// ── Rack / product compatibility ("tipo de estiba según rack y producto") ─────

export interface RackCompatibility {
  compatible: boolean
  reasons: string[] // motivos de incompatibilidad (vacío = compatible)
}

export function checkRackCompatibility(
  rack: RackType,
  loc: Pick<StorageLocation, 'type'>,
  product?: Pick<Product, 'category' | 'unitWeightKg'>
): RackCompatibility {
  const reasons: string[] = []

  if (!rack.active) reasons.push('El tipo de estiba está inactivo')

  if (rack.compatibleLocationTypes.length > 0 && !rack.compatibleLocationTypes.includes(loc.type)) {
    reasons.push(`No admite ubicaciones de tipo ${LOCATION_TYPE_LABELS[loc.type]}`)
  }

  if (product) {
    if (rack.compatibleCategories.length > 0 && !rack.compatibleCategories.includes(product.category)) {
      reasons.push(`No admite la categoría «${product.category}»`)
    }
    if (product.unitWeightKg > rack.maxWeightKgPerLevel) {
      reasons.push(
        `Peso unitario (${product.unitWeightKg} kg) supera el máximo por nivel (${rack.maxWeightKgPerLevel} kg)`
      )
    }
  }

  return { compatible: reasons.length === 0, reasons }
}
