"use client"

import { useWmsStore } from "@/store/wms-store"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"

export const AnalyticsToolbar = () => {
  const warehouses = useWmsStore((s) => s.warehouses)
  const primary = warehouses[0]

  if (!primary) return null

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
        <Building2 className="size-3.5" />
        {primary.name}
      </Badge>
    </div>
  )
}
