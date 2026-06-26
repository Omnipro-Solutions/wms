import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AnalyticsKpiStrip } from './_components/analytics-kpi-strip'
import { AnalyticsToolbar } from './_components/analytics-toolbar'
import { DashboardFiltersProvider } from './_components/dashboard-filters'
import { RealtimeVisitors } from './_components/realtime-visitors'
import { TabEnvios } from './_components/tab-envios'
import { TabInventario } from './_components/tab-inventario'
import { TabRecepcion } from './_components/tab-recepcion'
import { TopPages } from './_components/top-pages'
import { TopTrafficSources } from './_components/top-traffic-sources'
import { TrafficQuality } from './_components/traffic-quality'

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Bienvenido</h1>
        <p className="text-muted-foreground text-sm">
          Operaciones del centro de distribución — estado en tiempo real.
        </p>
      </div>

      <DashboardFiltersProvider>
        <Tabs defaultValue="overview" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="gap-1">
              <TabsTrigger value="overview">Visión General</TabsTrigger>
              <TabsTrigger value="recepcion">Recepción</TabsTrigger>
              <TabsTrigger value="inventario">Inventario</TabsTrigger>
              <TabsTrigger value="envios">Envíos</TabsTrigger>
            </TabsList>
            <AnalyticsToolbar />
          </div>

          <TabsContent value="overview" className="flex flex-col gap-4">
            <AnalyticsKpiStrip />
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7"><TrafficQuality /></div>
              <div className="xl:col-span-5"><RealtimeVisitors /></div>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7"><TopPages /></div>
              <div className="xl:col-span-5 xl:col-start-8"><TopTrafficSources /></div>
            </div>
          </TabsContent>

          <TabsContent value="recepcion">
            <TabRecepcion />
          </TabsContent>

          <TabsContent value="inventario">
            <TabInventario />
          </TabsContent>

          <TabsContent value="envios">
            <TabEnvios />
          </TabsContent>
        </Tabs>
      </DashboardFiltersProvider>
    </div>
  )
}
