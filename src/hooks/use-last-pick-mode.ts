'use client'

import { useState } from 'react'

const KEY = 'wms-last-pick-mode'

type PickMode = 'visible' | 'blind'

export const useLastPickMode = () => {
  const [lastMode, setLastMode] = useState<PickMode | null>(() => {
    if (typeof window === 'undefined') return null
    return (sessionStorage.getItem(KEY) as PickMode | null) ?? null
  })

  const remember = (mode: PickMode) => {
    sessionStorage.setItem(KEY, mode)
    setLastMode(mode)
  }

  return { lastMode, remember }
}
