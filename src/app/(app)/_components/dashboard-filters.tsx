"use client"

import { createContext, useContext, useState } from "react"

export type DashboardFilters = {
  warehouseId: string
  days: number
}

type DashboardFiltersContextValue = DashboardFilters & {
  setWarehouseId: (id: string) => void
  setDays: (days: number) => void
}

const DashboardFiltersContext = createContext<DashboardFiltersContextValue>({
  warehouseId: "all",
  days: 30,
  setWarehouseId: () => {},
  setDays: () => {},
})

export const DashboardFiltersProvider = ({ children }: { children: React.ReactNode }) => {
  const [warehouseId, setWarehouseId] = useState("all")
  const [days, setDays] = useState(30)

  return (
    <DashboardFiltersContext.Provider value={{ warehouseId, days, setWarehouseId, setDays }}>
      {children}
    </DashboardFiltersContext.Provider>
  )
}

export const useDashboardFilters = () => useContext(DashboardFiltersContext)
