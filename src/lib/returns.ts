// Returns module (#12) — shared UI labels, color maps and pure helpers.
// Single source of truth for everything the returns pages, columns, dialogs and
// the detail sheet render. No React, no store imports.

import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  ItemCondition,
  ItemDisposition,
  RepairTicketStatus,
  RepairType,
  ReturnInspection,
  ReturnOrder,
  ReturnStatus,
  ScrapMethod,
} from '@/types/wms'

// ── Return type (route) ─────────────────────────────────────────────────────

export const RETURN_TYPE_LABELS: Record<ReturnOrder['type'], string> = {
  customer_to_store: 'Cliente → Tienda',
  customer_store_to_dc: 'Cliente / Tienda → CD',
  store_to_dc: 'Tienda → CD',
  store_to_store: 'Tienda → Tienda',
  dc_to_supplier: 'CD → Proveedor',
}

export const RETURN_TYPES = Object.keys(RETURN_TYPE_LABELS) as ReturnOrder['type'][]

// ── Disposition (return-level) ──────────────────────────────────────────────

export const DISPOSITION_LABELS: Record<ReturnOrder['disposition'], string> = {
  restock: 'Reingresar',
  scrap: 'Desecho',
  quality_control: 'Control calidad',
  repair: 'Reparación',
  rejected: 'Rechazada',
}

export const DISPOSITION_COLORS: Record<ReturnOrder['disposition'], string> = {
  restock:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  scrap:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
  quality_control:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  repair:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
  rejected: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-300',
}

// ── Item disposition (per-line recommendation / grading policy) ─────────────

export const ITEM_DISPOSITION_LABELS: Record<ItemDisposition, string> = {
  restock: 'Reingresar al stock',
  repair: 'Enviar a reparación',
  scrap: 'Enviar a desecho',
  reject: 'Rechazar',
}

// ── Item condition (grading) ────────────────────────────────────────────────

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  defective: 'Defectuoso',
  damaged: 'Dañado',
}

export const CONDITION_ORDER: ItemCondition[] = [
  'new',
  'like_new',
  'good',
  'fair',
  'defective',
  'damaged',
]

export const CONDITION_DOT: Record<ItemCondition, string> = {
  new: 'bg-green-500',
  like_new: 'bg-emerald-500',
  good: 'bg-blue-500',
  fair: 'bg-amber-500',
  defective: 'bg-orange-500',
  damaged: 'bg-red-500',
}

export const CONDITION_COLORS: Record<ItemCondition, string> = {
  new: 'border-green-200 bg-green-100 text-green-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  like_new:
    'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  good: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300',
  fair: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
  defective:
    'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-300',
  damaged: 'border-red-200 bg-red-100 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300',
}

// ── Inspection result ───────────────────────────────────────────────────────

export const RESULT_LABELS: Record<ReturnInspection['overallResult'], string> = {
  pass: 'Aprobada',
  partial_pass: 'Aprobación parcial',
  fail: 'Rechazada',
}

export const RESULT_STYLES: Record<ReturnInspection['overallResult'], string> = {
  pass: 'border-green-200 bg-green-50 text-green-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  partial_pass:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
  fail: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300',
}

// ── Repair ──────────────────────────────────────────────────────────────────

export const REPAIR_TYPE_LABELS: Record<RepairType, string> = {
  cosmetic: 'Cosmética',
  functional: 'Funcional',
  warranty: 'Garantía',
}

export const REPAIR_STATUS_LABELS: Record<RepairTicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En proceso',
  ready_to_receive: 'Listo para recibir',
  received: 'Recibido',
  completed: 'Completado',
  failed: 'Fallido',
}

// ── Scrap ───────────────────────────────────────────────────────────────────

export const SCRAP_METHOD_LABELS: Record<ScrapMethod, string> = {
  incinerate: 'Incineración',
  landfill: 'Relleno sanitario',
  donate: 'Donación',
  liquidate: 'Liquidación',
  recycle: 'Reciclaje',
}

// ── Status flow ─────────────────────────────────────────────────────────────

// Ordered by lifecycle progression — used to populate the status filter dropdown.
export const RETURN_STATUS_ORDER: ReturnStatus[] = [
  'requested',
  'received_at_store',
  'in_transit_to_dc',
  'received_at_dc',
  'under_validation',
  'sent_to_quality_control',
  'reentered',
  'sent_to_repair',
  'sent_to_scrap',
  'rejected',
  'closed',
]

export const TERMINAL_RETURN_STATUSES = new Set<ReturnStatus>(['closed', 'rejected'])

export const isTerminalReturnStatus = (status: ReturnStatus): boolean =>
  TERMINAL_RETURN_STATUSES.has(status)

// Statuses from which a return can be rejected outright (mirrors returnTransitions).
export const REJECTABLE_RETURN_STATUSES = new Set<ReturnStatus>([
  'requested',
  'received_at_store',
  'under_validation',
  'sent_to_quality_control',
])

export const canRejectReturn = (status: ReturnStatus): boolean =>
  REJECTABLE_RETURN_STATUSES.has(status)

// Single source of truth for the FSM's "next step" given a return's current
// status + chosen disposition. Consumed by the store (advanceReturn) and the UI
// (advance dialog). Returns null when the return is terminal / has no next step.
export const nextReturnStatus = (
  ret: Pick<ReturnOrder, 'status' | 'disposition'>
): ReturnStatus | null => {
  switch (ret.status) {
    case 'requested':
      return 'received_at_store'
    case 'received_at_store':
      return 'in_transit_to_dc'
    case 'in_transit_to_dc':
      return 'received_at_dc'
    case 'received_at_dc':
      return 'under_validation'
    case 'under_validation':
      return ret.disposition === 'restock'
        ? 'reentered'
        : ret.disposition === 'scrap'
          ? 'sent_to_scrap'
          : ret.disposition === 'repair'
            ? 'sent_to_repair'
            : ret.disposition === 'rejected'
              ? 'rejected'
              : 'sent_to_quality_control'
    case 'sent_to_quality_control':
      return ret.disposition === 'restock'
        ? 'reentered'
        : ret.disposition === 'repair'
          ? 'sent_to_repair'
          : ret.disposition === 'rejected'
            ? 'rejected'
            : 'sent_to_scrap'
    case 'sent_to_repair':
      return 'reentered'
    case 'reentered':
      return 'closed'
    case 'sent_to_scrap':
      return 'closed'
    case 'rejected':
      return 'closed'
    default:
      return null
  }
}

// ── Return window ─────────────────────────────────────────────────────────────

// Returns the number of days a return is *beyond* the accepted window, or null
// if it's within the window (or there's no dispatch date to check against).
export const returnWindowExceededBy = (
  dispatchDate: string | undefined,
  windowDays: number,
  nowIso: string
): number | null => {
  if (!dispatchDate) return null
  const elapsed = differenceInCalendarDays(parseISO(nowIso), parseISO(dispatchDate))
  return elapsed > windowDays ? elapsed : null
}
