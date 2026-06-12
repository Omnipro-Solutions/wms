import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy', { locale: es })
  } catch {
    return iso
  }
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm', { locale: es })
  } catch {
    return iso
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

export function formatWeight(kg: number): string {
  return `${formatNumber(kg)} kg`
}

export function formatVolume(m3: number): string {
  return `${formatNumber(m3)} m³`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
