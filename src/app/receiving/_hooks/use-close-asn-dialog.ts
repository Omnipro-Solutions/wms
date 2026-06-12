'use client'

import { useState } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'

export interface CloseDialogData {
  asnId: string
  asnCode: string
  productName: string
  supplierName: string
  expectedTotal: number
  receivedSoFar: number
  missingQty: number
}

export const useCloseAsnDialog = () => {
  const { closeAsnWithDiscrepancy } = useWmsStore()
  const dialog = useDialogState<CloseDialogData>()
  const [closeReason, setCloseReason] = useState('')

  const open = (data: CloseDialogData) => {
    dialog.open(data)
    setCloseReason('')
  }

  const handleSubmit = () => {
    if (!dialog.data) return
    if (!closeReason) {
      dialog.setError('Selecciona el motivo para cerrar el ASN con diferencia.')
      return
    }
    try {
      closeAsnWithDiscrepancy(dialog.data.asnId, closeReason, 'Supervisor')
      dialog.close()
      setCloseReason('')
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error al cerrar el ASN.')
    }
  }

  return {
    dialog,
    open,
    closeReason,
    setCloseReason: (v: string) => {
      setCloseReason(v)
      dialog.clearError?.()
    },
    handleSubmit,
  }
}
