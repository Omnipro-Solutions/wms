'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useWmsStore } from '@/store/wms-store'
import { OperatorPicker } from '@/components/shared/operator-picker'

interface OperatorPickerContextValue {
  openPicker: () => void
}

const OperatorPickerContext = createContext<OperatorPickerContextValue>({ openPicker: () => {} })

export const useOperatorPicker = () => useContext(OperatorPickerContext)

export const OperatorPickerProvider = ({ children }: { children: React.ReactNode }) => {
  const { operator } = useCurrentOperator()
  const [hydrated, setHydrated] = useState(false)
  const [changingOperator, setChangingOperator] = useState(false)

  useEffect(() => {
    if (useWmsStore.persist?.hasHydrated?.()) {
      setHydrated(true)
      return
    }
    return useWmsStore.persist?.onFinishHydration(() => setHydrated(true))
  }, [])

  // open only after hydration — before that keep picker closed to match SSR tree
  const open = hydrated && (!operator || changingOperator)

  return (
    <OperatorPickerContext.Provider value={{ openPicker: () => setChangingOperator(true) }}>
      <OperatorPicker
        open={open}
        canClose={changingOperator}
        onClose={() => setChangingOperator(false)}
      />
      {children}
    </OperatorPickerContext.Provider>
  )
}
