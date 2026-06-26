import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AnalyticsKpiStrip } from './_components/analytics-kpi-strip'
import { AnalyticsToolbar } from './_components/analytics-toolbar'
import { RealtimeVisitors } from './_components/realtime-visitors'
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
            <div className="xl:col-span-7">
              <TrafficQuality />
            </div>
            <div className="xl:col-span-5">
              <RealtimeVisitors />
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TopPages />
            </div>
            <div className="xl:col-span-5 xl:col-start-8">
              <TopTrafficSources />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recepcion">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de recepción próximamente.
          </div>
        </TabsContent>

        <TabsContent value="inventario">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de inventario próximamente.
          </div>
        </TabsContent>

        <TabsContent value="envios">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de envíos próximamente.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
