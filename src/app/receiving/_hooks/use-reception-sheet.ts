'use client'

import { useState, useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import type { PoRow } from '../columns'

export interface ReceptionLine {
  lineId: string
  productId: string
  productName: string
  orderedQty: number
  alreadyReceivedQty: number
  qty: string
}

export const useReceptionSheet = () => {
  const state = useWmsStore()
  const { createReceptionFromPO } = state
  const { productName: getProductName } = useStoreHelpers()

  const [sheetPoId, setSheetPoId] = useState<string | null>(null)
  const [receptionLines, setReceptionLines] = useState<ReceptionLine[]>([])
  const [appointmentDate, setAppointmentDate] = useState('')
  const [receptionCarrier, setReceptionCarrier] = useState('')
  const [receptionNotes, setReceptionNotes] = useState('')
  const [requiresQc, setRequiresQc] = useState(false)
  const [sheetError, setSheetError] = useState('')

  const sheetPo = useMemo(
    () => state.purchaseOrders.find((p) => p.id === sheetPoId) ?? null,
    [state.purchaseOrders, sheetPoId]
  )

  const open = (row: PoRow) => {
    const po = state.purchaseOrders.find((p) => p.id === row.id)
    if (!po) return
    const lines: ReceptionLine[] = po.lines
      .filter((l) => l.orderedQty - l.receivedQty > 0)
      .map((l) => ({
        lineId: l.id,
        productId: l.productId,
        productName: getProductName(l.productId),
        orderedQty: l.orderedQty,
        alreadyReceivedQty: l.receivedQty,
        qty: String(l.orderedQty - l.receivedQty),
      }))
    setSheetPoId(row.id)
    setReceptionLines(lines)
    setAppointmentDate(row.expectedDate)
    setReceptionCarrier(po.carrierId ?? '')
    setReceptionNotes('')
    setSheetError('')
  }

  const close = () => {
    setSheetPoId(null)
    setReceptionLines([])
    setRequiresQc(false)
    setSheetError('')
  }

  const updateLineQty = (lineId: string, delta: number) => {
    setReceptionLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l
        const max = l.orderedQty - l.alreadyReceivedQty
        const current = parseInt(l.qty, 10) || 0
        const next = Math.max(0, Math.min(max, current + delta))
        return { ...l, qty: String(next) }
      })
    )
    setSheetError('')
  }

  const setLineQty = (lineId: string, rawValue: string, max: number) => {
    const v = Math.max(0, Math.min(max, parseInt(rawValue, 10) || 0))
    setReceptionLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, qty: String(v) } : l))
    )
    setSheetError('')
  }

  const handleSubmit = () => {
    if (!sheetPoId) return
    if (!appointmentDate) {
      setSheetError('Selecciona la fecha de cita.')
      return
    }
    const entries = receptionLines
      .map((l) => ({ lineId: l.lineId, qty: parseInt(l.qty, 10) || 0 }))
      .filter((e) => e.qty > 0)
    if (entries.length === 0) {
      setSheetError('Agrega al menos una unidad en alguna línea.')
      return
    }
    try {
      createReceptionFromPO(
        sheetPoId,
        entries,
        appointmentDate,
        receptionCarrier || undefined,
        receptionNotes || undefined,
        requiresQc
      )
      close()
    } catch (e: unknown) {
      setSheetError(e instanceof Error ? e.message : 'Error al crear la recepción.')
    }
  }

  return {
    isOpen: !!sheetPoId,
    sheetPo,
    receptionLines,
    appointmentDate,
    setAppointmentDate: (v: string) => {
      setAppointmentDate(v)
      setSheetError('')
    },
    receptionCarrier,
    setReceptionCarrier,
    receptionNotes,
    setReceptionNotes,
    requiresQc,
    setRequiresQc,
    sheetError,
    carriers: state.carriers,
    open,
    close,
    updateLineQty,
    setLineQty,
    handleSubmit,
  }
}
