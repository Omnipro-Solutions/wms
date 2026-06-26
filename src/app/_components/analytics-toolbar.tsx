"use client"

import { Building2, CalendarDays } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDashboardFilters } from "./dashboard-filters"

const WAREHOUSES = [
  { id: "all",          name: "Todos los almacenes" },
  { id: "wh-bog",       name: "CEDI Bogotá" },
  { id: "wh-med",       name: "CEDI Medellín" },
  { id: "wh-andino",    name: "Tienda Andino" },
  { id: "wh-santafe",   name: "Tienda Santa Fe" },
  { id: "wh-viva",      name: "Tienda Viva Envigado" },
  { id: "wh-unicentro", name: "Tienda Unicentro" },
]

const DATE_RANGES = [
  { value: 7,  label: "Últimos 7 días" },
  { value: 15, label: "Últimos 15 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
]

export const AnalyticsToolbar = () => {
  const { warehouseId, days, setWarehouseId, setDays } = useDashboardFilters()

  return (
    <div className="flex items-center gap-2">
      <Select value={warehouseId} onValueChange={setWarehouseId}>
        <SelectTrigger className="h-8 w-52 gap-1.5 text-sm font-normal">
          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WAREHOUSES.map((w) => (
            <SelectItem key={w.id} value={w.id} className="text-sm">
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
        <SelectTrigger className="h-8 w-44 gap-1.5 text-sm font-normal">
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map((r) => (
            <SelectItem key={r.value} value={String(r.value)} className="text-sm">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
