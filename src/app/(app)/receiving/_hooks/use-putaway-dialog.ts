'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { selectSlottingRecommendations, abcByProduct, xyzByProduct } from '@/store/selectors'
import { idealLocationTier } from '@/lib/rules/slotting'
import { suggestPutawayLocation, validatePutawayDestination } from '@/lib/rules/putaway'
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
  locationCompat: Record<string, { compatible: boolean; reasons: string[] }>
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

  // Compatibility for every candidate in the manual dropdown, computed once per
  // open() call against the ASN's actual product — used to grey out/annotate
  // invalid options instead of letting the operator pick a destination that will
  // be rejected by putawayItem.
  const compatFor = useCallback(
    (productId: string): Record<string, { compatible: boolean; reasons: string[] }> => {
      const product = state.products.find((p) => p.id === productId)
      const abcClass: AbcClass = (abc[productId] ?? 'C') as AbcClass
      const result: Record<string, { compatible: boolean; reasons: string[] }> = {}
      if (!product) return result
      for (const loc of allLocations) {
        const rackType = loc.rackTypeId ? state.rackTypes.find((r) => r.id === loc.rackTypeId) : undefined
        const hasOtherLotAtLocation =
          product.trackBy === 'lot' &&
          state.inventoryItems.some(
            (i) => i.locationId === loc.id && i.productId === productId && i.onHandQuantity > 0 && i.lot !== undefined
          )
        result[loc.id] = validatePutawayDestination({
          product,
          destination: loc,
          rackType,
          hasOtherLotAtLocation,
          rules: state.putawayRules,
          abcClass,
        })
      }
      return result
    },
    [allLocations, abc, state.products, state.rackTypes, state.inventoryItems, state.putawayRules]
  )

  const getSuggestion = useCallback(
    (
      asnId: string,
      compat: Record<string, { compatible: boolean; reasons: string[] }>
    ): { locationId: string | null; reason: string } => {
      const asn = state.asnRecords.find((a) => a.id === asnId)
      if (!asn) return { locationId: null, reason: '' }
      const product = state.products.find((p) => p.id === asn.productId)

      // Tier 1: an active slotting recommendation for this product — re-validated
      // against the current restrictions before being trusted (it may have been
      // computed before the product/location gained a hazmat/cold-chain flag).
      const rec = recommendations.find((r) => r.productId === asn.productId)
      if (rec && compat[rec.suggestedLocationId]?.compatible) {
        const loc = state.locations.find((l) => l.id === rec.suggestedLocationId)
        return {
          locationId: rec.suggestedLocationId,
          reason: `Calculada por slotting (score ${rec.score}/100) — ahorra ~${Math.round(rec.estimatedDistanceSavedM)} m por ciclo hacia ${loc?.code ?? ''}`,
        }
      }

      // Tier 2: the ASN's static seed suggestion — same re-validation.
      if (asn.suggestedPutawayLocationId && compat[asn.suggestedPutawayLocationId]?.compatible) {
        return {
          locationId: asn.suggestedPutawayLocationId,
          reason: 'Sugerencia estática del ASN (sin recomendación de slotting activa)',
        }
      }

      // Tier 3: the full putaway engine (ABC/XYZ + PutawayRule + restrictions).
      if (product) {
        const abcClass: AbcClass = (abc[asn.productId] ?? 'C') as AbcClass
        const xyzClass: XyzClass = (xyz[asn.productId] ?? 'Z') as XyzClass
        const suggestion = suggestPutawayLocation({
          product,
          abcClass,
          xyzClass,
          locations: allLocations,
          inventoryItems: state.inventoryItems,
          rules: state.putawayRules,
          rackTypes: state.rackTypes,
          warehouseId: 'wh-bog',
        })
        if (suggestion) return { locationId: suggestion.location.id, reason: suggestion.reason }
      }

      return { locationId: null, reason: 'Sin sugerencia disponible — selecciona manualmente.' }
    },
    [
      state.asnRecords,
      state.locations,
      state.products,
      state.inventoryItems,
      state.putawayRules,
      state.rackTypes,
      recommendations,
      abc,
      xyz,
      allLocations,
    ]
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
    const locationCompat = compatFor(asn?.productId ?? '')
    const { locationId, reason } = getSuggestion(asnId, locationCompat)

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
      locationCompat,
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
