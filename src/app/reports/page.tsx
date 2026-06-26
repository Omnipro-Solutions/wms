'use client'

import { useSearchParams } from 'next/navigation'
import { BarChart3, Package, Truck, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { ProductivityTab } from './_components/productivity-tab'
import { InventoryTab } from './_components/inventory-tab'
import { OtifTab } from './_components/otif-tab'
import { ForecastTab } from './_components/forecast-tab'

type TabValue = 'productividad' | 'inventario' | 'otif' | 'proyeccion'

const TABS: SubNavItem[] = [
  { value: 'productividad', label: 'Productividad', icon: BarChart3 },
  { value: 'inventario', label: 'Inventario', icon: Package },
  { value: 'otif', label: 'OTIF', icon: Truck },
  { value: 'proyeccion', label: 'Proyección', icon: TrendingUp },
]

const DEFAULT_TAB: TabValue = 'productividad'

export default function ReportsPage() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? DEFAULT_TAB) as TabValue

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes"
        description="Productividad por operador, exactitud de inventario, OTIF y proyección de demanda"
      />
      <SubNav items={TABS} defaultValue={DEFAULT_TAB} />
      {tab === 'productividad' && <ProductivityTab />}
      {tab === 'inventario' && <InventoryTab />}
      {tab === 'otif' && <OtifTab />}
      {tab === 'proyeccion' && <ForecastTab />}
    </div>
  )
}
