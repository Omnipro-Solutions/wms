'use client'

import type { AbcClass, OperationalStatus, PurchaseOrderStatus } from '@/types/wms'

// ── ASN row ───────────────────────────────────────────────────────────────────

export interface AsnRow {
  id: string
  code: string
  supplierName: string
  productName: string
  productId: string
  productCategory: string
  abcClass: AbcClass
  appointmentDate: string
  expectedQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  pendingQuantity: number
  progressPct: number
  status: OperationalStatus
  requiresQualityControl: boolean
  crossDocking: boolean
  deliveryCount: number
  canReceive: boolean
  canClose: boolean
  canPutaway: boolean
  canQc: boolean
  isOverdue: boolean
  requiresSerial: boolean
}

// ── PO row ────────────────────────────────────────────────────────────────────

export interface PoRow {
  id: string
  code: string
  supplierName: string
  expectedDate: string
  lineCount: number
  totalOrdered: number
  totalReceived: number
  pendingQty: number
  progressPct: number
  status: PurchaseOrderStatus
  isOverdue: boolean
  canCreateReception: boolean
}

// ── Action types ──────────────────────────────────────────────────────────────

export type ActionType = 'confirm' | 'receive' | 'close' | 'putaway' | 'qc' | 'crossdock'

// ── Column builders (re-exported from per-tab files) ──────────────────────────

export { buildPoColumns } from './_columns/columns-po'
export { buildAppointmentColumns } from './_columns/columns-appointments'
export { buildReceivingColumns } from './_columns/columns-receiving'
export { buildQcColumns } from './_columns/columns-qc'
export { buildPutawayColumns } from './_columns/columns-putaway'
