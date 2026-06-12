'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { selectSlottingRecommendations } from '@/store/selectors'

export interface PutawayDialogData {
  asnId: string
  productName: string
  asnCode: string
  suggestedLocationId: string | null
  abcClass: string
  isCrossDocking: boolean
}

export const usePutawayDialog = () => {
  const state = useWmsStore()
  const { putawayItem } = state
  const { locationCode } = useStoreHelpers()

  const dialog = useDialogState<PutawayDialogData>()
  const [selectedLocation, setSelectedLocation] = useState('')

  const recommendations = useMemo(
    () => selectSlottingRecommendations(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems, state.locations, state.demandStats]
  )

  const allLocations = useMemo(
    () =>
      state.locations.filter(
        (l) => l.type === 'pick' || l.type === 'staging' || l.type === 'reserve'
      ),
    [state.locations]
  )

  const getSuggestedLocationId = useCallback(
    (asnId: string): string | null => {
      const asn = state.asnRecords.find((a) => a.id === asnId)
      if (!asn) return null
      const rec = recommendations.find((r) => r.productId === asn.productId)
      return rec?.suggestedLocationId ?? asn.suggestedPutawayLocationId ?? null
    },
    [state.asnRecords, recommendations]
  )

  const open = (
    asnId: string,
    asnCode: string,
    productName: string,
    abcClass: string,
    isCrossDocking: boolean
  ) => {
    const sug = getSuggestedLocationId(asnId)
    dialog.open({ asnId, asnCode, productName, suggestedLocationId: sug, abcClass, isCrossDocking })
    setSelectedLocation(sug ?? '')
  }

  const handleSubmit = () => {
    if (!dialog.data) return
    if (!selectedLocation) {
      dialog.setError('Selecciona una ubicación.')
      return
    }
    try {
      putawayItem(dialog.data.asnId, selectedLocation, 'Operador')
      dialog.close()
      setSelectedLocation('')
    } catch (e: unknown) {
      dialog.setError(e instanceof Error ? e.message : 'Error en putaway')
    }
  }

  return {
    dialog,
    open,
    handleSubmit,
    selectedLocation,
    setSelectedLocation: (v: string) => {
      setSelectedLocation(v)
      dialog.clearError?.()
    },
    allLocations,
    locationCode,
  }
}
