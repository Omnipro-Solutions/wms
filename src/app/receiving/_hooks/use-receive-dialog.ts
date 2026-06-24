'use client'

import { useState } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'

export interface ReceiveDialogData {
  asnId: string
  asnCode: string
  productName: string
  supplierName: string
  expectedTotal: number
  receivedSoFar: number
  pendingQty: number
  deliveryCount: number
  requiresQC: boolean
  isCrossDocking: boolean
  requiresSerial: boolean
  productId: string
}

export const useReceiveDialog = () => {
  const { receiveAsn, closeAsnWithDiscrepancy, products, unitsOfMeasure } = useWmsStore()

  const dialog = useDialogState<ReceiveDialogData>()
  const [goodQty, setGoodQty] = useState('')
  const [damagedQty, setDamagedQty] = useState('')
  const [discrepancyReason, setDiscrepancyReason] = useState('')
  const [closeIntent, setCloseIntent] = useState<'leave_open' | 'close_now'>('leave_open')
  // Serial input: one entry per line, or comma-separated
  const [serialsRaw, setSerialsRaw] = useState('')
  const [selectedUomId, setSelectedUomId] = useState<string | undefined>(undefined)

  const goodQtyNum = parseInt(goodQty, 10) || 0
  const damagedQtyNum = parseInt(damagedQty, 10) || 0
  const totalCounted = goodQtyNum + damagedQtyNum
  const pendingQty = dialog.data?.pendingQty ?? 0
  const isOverCount = totalCounted > pendingQty
  const isDiscrepancy = totalCounted > 0 && totalCounted < pendingQty
  const missingInForm = pendingQty - totalCounted
  const requiresSerial = dialog.data?.requiresSerial ?? false

  // UoM: derive available UoMs for the product
  const product = products.find((p) => p.id === dialog.data?.productId)
  const baseUomId = product?.baseUomId
  const activeUoms = unitsOfMeasure.filter((u) => u.active)
  // Selectable UoMs = base + any that appear in uomConversions
  const selectableUomIds = new Set([
    baseUomId,
    ...(product?.uomConversions?.map((c) => c.fromUomId) ?? []),
  ].filter(Boolean) as string[])
  const selectableUoms = activeUoms.filter((u) => selectableUomIds.has(u.id))
  const hasUomChoice = selectableUoms.length > 1
  const effectiveUomId = selectedUomId ?? baseUomId

  const parsedSerials = serialsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const serialsCount = requiresSerial ? parsedSerials.length : goodQtyNum
  const serialsMismatch = requiresSerial && goodQtyNum > 0 && serialsCount !== goodQtyNum
  const serialsDuplicated = requiresSerial && new Set(parsedSerials).size !== parsedSerials.length

  const canSubmit =
    totalCounted > 0 &&
    !isOverCount &&
    (!isDiscrepancy || !!discrepancyReason) &&
    (!requiresSerial || (parsedSerials.length === goodQtyNum && !serialsDuplicated))

  const open = (data: ReceiveDialogData) => {
    dialog.open(data)
    setGoodQty(String(data.pendingQty))
    setDamagedQty('0')
    setDiscrepancyReason('')
    setCloseIntent('leave_open')
    setSerialsRaw('')
    const p = products.find((pr) => pr.id === data.productId)
    setSelectedUomId(p?.baseUomId)
  }

  const handleSubmit = () => {
    if (!dialog.data) return
    const good = parseInt(goodQty, 10)
    const damaged = parseInt(damagedQty, 10) || 0
    const total = (isNaN(good) ? 0 : good) + damaged
    const pending = dialog.data.pendingQty

    if (isNaN(good) || good < 0) {
      dialog.setError('Ingresa un número válido en «Unidades en buen estado».')
      return
    }
    if (damaged < 0) {
      dialog.setError('Las unidades dañadas no pueden ser negativas.')
      return
    }
    if (total <= 0) {
      dialog.setError('Debes contar al menos 1 unidad para registrar la entrega.')
      return
    }
    if (total > pending) {
      dialog.setError(
        `El total contado (${total}) supera las unidades pendientes (${pending}). Revisa los valores.`
      )
      return
    }
    if (total < pending && !discrepancyReason) {
      dialog.setError('Faltan unidades. Selecciona el motivo de la diferencia.')
      return
    }
    if (requiresSerial && good > 0 && parsedSerials.length !== good) {
      dialog.setError(`Ingresa exactamente ${good} número(s) de serie para las unidades en buen estado.`)
      return
    }
    if (requiresSerial && serialsDuplicated) {
      dialog.setError('Hay números de serie duplicados. Revisa la lista.')
      return
    }
    try {
      receiveAsn(
        dialog.data.asnId,
        good,
        'Operador',
        damaged,
        requiresSerial && parsedSerials.length > 0 ? parsedSerials : undefined,
        effectiveUomId
      )
      if (closeIntent === 'close_now' && total < pending && discrepancyReason) {
        closeAsnWithDiscrepancy(dialog.data.asnId, discrepancyReason, 'Operador')
      }
      dialog.close()
      setGoodQty('')
      setDamagedQty('')
      setDiscrepancyReason('')
      setCloseIntent('leave_open')
      setSerialsRaw('')
      setSelectedUomId(undefined)
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error inesperado. Intenta de nuevo.')
    }
  }

  return {
    dialog,
    open,
    handleSubmit,
    goodQty,
    setGoodQty: (v: string) => {
      setGoodQty(v)
      dialog.clearError?.()
    },
    damagedQty,
    setDamagedQty: (v: string) => {
      setDamagedQty(v)
      dialog.clearError?.()
    },
    discrepancyReason,
    setDiscrepancyReason: (v: string) => {
      setDiscrepancyReason(v)
      dialog.clearError?.()
    },
    closeIntent,
    setCloseIntent,
    serialsRaw,
    setSerialsRaw: (v: string) => {
      setSerialsRaw(v)
      dialog.clearError?.()
    },
    parsedSerials,
    serialsCount,
    serialsMismatch,
    serialsDuplicated,
    requiresSerial,
    goodQtyNum,
    damagedQtyNum,
    totalCounted,
    pendingQty,
    isOverCount,
    isDiscrepancy,
    missingInForm,
    canSubmit,
    // UoM
    selectedUomId: effectiveUomId,
    setSelectedUomId,
    selectableUoms,
    hasUomChoice,
    baseUomId,
  }
}
