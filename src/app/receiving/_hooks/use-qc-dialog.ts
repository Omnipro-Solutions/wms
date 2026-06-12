'use client'

import { useState } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'

export interface QcDialogData {
  asnId: string
  productName: string
  asnCode: string
  blockedQty: number
  supplierName: string
}

export type Decision = 'approve' | 'reject' | null

export const useQcDialog = () => {
  const { approveQc, rejectQc } = useWmsStore()
  const dialog = useDialogState<QcDialogData>()
  const [decision, setDecision] = useState<Decision>(null)

  const handleApprove = () => {
    if (!dialog.data) return
    try {
      approveQc(dialog.data.asnId, 'Operador')
      dialog.close()
      setDecision(null)
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error al aprobar QC')
    }
  }

  const handleReject = () => {
    if (!dialog.data) return
    try {
      rejectQc(dialog.data.asnId, 'Operador')
      dialog.close()
      setDecision(null)
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error al rechazar QC')
    }
  }

  const close = () => {
    setDecision(null)
    dialog.close()
  }

  return { dialog, decision, setDecision, handleApprove, handleReject, close }
}
