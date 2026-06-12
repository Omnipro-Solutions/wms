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
}

export const useReceiveDialog = () => {
  const { receiveAsn, closeAsnWithDiscrepancy } = useWmsStore()

  const dialog = useDialogState<ReceiveDialogData>()
  const [goodQty, setGoodQty] = useState('')
  const [damagedQty, setDamagedQty] = useState('')
  const [discrepancyReason, setDiscrepancyReason] = useState('')
  const [closeIntent, setCloseIntent] = useState<'leave_open' | 'close_now'>('leave_open')

  const goodQtyNum = parseInt(goodQty, 10) || 0
  const damagedQtyNum = parseInt(damagedQty, 10) || 0
  const totalCounted = goodQtyNum + damagedQtyNum
  const pendingQty = dialog.data?.pendingQty ?? 0
  const isOverCount = totalCounted > pendingQty
  const isDiscrepancy = totalCounted > 0 && totalCounted < pendingQty
  const missingInForm = pendingQty - totalCounted
  const canSubmit = totalCounted > 0 && !isOverCount && (!isDiscrepancy || !!discrepancyReason)

  const open = (data: ReceiveDialogData) => {
    dialog.open(data)
    setGoodQty(String(data.pendingQty))
    setDamagedQty('0')
    setDiscrepancyReason('')
    setCloseIntent('leave_open')
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
    try {
      receiveAsn(dialog.data.asnId, good, 'Operador', damaged)
      if (closeIntent === 'close_now' && total < pending && discrepancyReason) {
        closeAsnWithDiscrepancy(dialog.data.asnId, discrepancyReason, 'Operador')
      }
      dialog.close()
      setGoodQty('')
      setDamagedQty('')
      setDiscrepancyReason('')
      setCloseIntent('leave_open')
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
    goodQtyNum,
    damagedQtyNum,
    totalCounted,
    pendingQty,
    isOverCount,
    isDiscrepancy,
    missingInForm,
    canSubmit,
  }
}
