'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { selectSlottingRecommendations, abcByProduct, xyzByProduct } from '@/store/selectors'
import { idealLocationTier } from '@/lib/rules/slotting'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import type { AbcClass, XyzClass } from '@/types/wms'

export interface PutawayDialogData {
  asnId: string
  productName: string
  asnCode: string
  suggestedLocationId: string | null
  abcClass: AbcClass
  xyzClass: XyzClass
  tierLabel: string
  suggestionReason: string
  isCrossDocking: boolean
}

const TIER_LABEL: Record<string, string> = {
  golden: 'Golden zone — alta rotación, acceso ergonómico',
  standard: 'Zona estándar — rotación media',
  remote: 'Zona remota — baja rotación o demanda errática',
}

export const usePutawayDialog = () => {
  const state = useWmsStore()
  const { putawayItem } = state
  const { locationCode } = useStoreHelpers()
  const { operator } = useCurrentOperator()

  const dialog = useDialogState<PutawayDialogData>()
  const [selectedLocation, setSelectedLocation] = useState('')

  const recommendations = useMemo(
    () => selectSlottingRecommendations(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems, state.locations, state.demandStats]
  )

  const abc = useMemo(() => abcByProduct(state), [state.demandStats, state.settings])
  const xyz = useMemo(() => xyzByProduct(state), [state.demandStats, state.settings])

  const allLocations = useMemo(
    () =>
      state.locations.filter(
        (l) => l.type === 'pick' || l.type === 'staging' || l.type === 'reserve'
      ),
    [state.locations]
  )

  const getSuggestion = useCallback(
    (asnId: string): { locationId: string | null; reason: string } => {
      const asn = state.asnRecords.find((a) => a.id === asnId)
      if (!asn) return { locationId: null, reason: '' }
      const rec = recommendations.find((r) => r.productId === asn.productId)
      if (rec) {
        const loc = state.locations.find((l) => l.id === rec.suggestedLocationId)
        return {
          locationId: rec.suggestedLocationId,
          reason: `Calculada por slotting (score ${rec.score}/100) — ahorra ~${Math.round(rec.estimatedDistanceSavedM)} m por ciclo hacia ${loc?.code ?? ''}`,
        }
      }
      if (asn.suggestedPutawayLocationId) {
        return {
          locationId: asn.suggestedPutawayLocationId,
          reason: 'Sugerencia estática del ASN (sin recomendación de slotting activa)',
        }
      }
      // ABC-directed fallback: derive from product weight/volume + class
      const product = state.products.find((p) => p.id === asn.productId)
      const abcClass: AbcClass = (abc[asn.productId] ?? 'C') as AbcClass
      const abcLoc = product
        ? suggestPutawayLocation({
            abcClass,
            productWeightKg: product.unitWeightKg,
            productVolumeM3: product.unitVolumeM3,
            locations: allLocations,
          })
        : null
      if (abcLoc) {
        return {
          locationId: abcLoc.id,
          reason: `Sugerencia automática (clase ${abcClass}) — ${abcLoc.golden ? 'zona dorada' : `zona ${abcLoc.zone}`}`,
        }
      }
      return { locationId: null, reason: 'Sin sugerencia disponible — selecciona manualmente.' }
    },
    [state.asnRecords, state.locations, state.products, recommendations, abc, allLocations]
  )

  const open = (
    asnId: string,
    asnCode: string,
    productName: string,
    rawAbcClass: string,
    isCrossDocking: boolean
  ) => {
    const asn = state.asnRecords.find((a) => a.id === asnId)
    const abcClass: AbcClass = (abc[asn?.productId ?? ''] ?? rawAbcClass ?? 'C') as AbcClass
    const xyzClass: XyzClass = (xyz[asn?.productId ?? ''] ?? 'Z') as XyzClass
    const tier = idealLocationTier(abcClass, xyzClass)
    const { locationId, reason } = getSuggestion(asnId)

    dialog.open({
      asnId,
      asnCode,
      productName,
      suggestedLocationId: locationId,
      abcClass,
      xyzClass,
      tierLabel: TIER_LABEL[tier] ?? tier,
      suggestionReason: reason,
      isCrossDocking,
    })
    setSelectedLocation(locationId ?? '')
  }

  const handleSubmit = () => {
    if (!dialog.data) return
    if (!selectedLocation) {
      dialog.setError('Selecciona una ubicación.')
      return
    }
    try {
      putawayItem(dialog.data.asnId, selectedLocation, operator?.name ?? 'Operador')
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
