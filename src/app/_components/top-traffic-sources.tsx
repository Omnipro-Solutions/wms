"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { statusLabel } from "@/lib/status"
import { Bar, BarChart, CartesianGrid, LabelList, type LabelProps, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const chartConfig = {
  count: {
    color: "var(--chart-1)",
    label: "Cantidad",
  },
} satisfies ChartConfig

type StatusDatum = { label: string; status: string; count: number }

const renderValueLabel = (props: LabelProps) => {
  const { height, value, y } = props
  return (
    <text
      className="fill-foreground"
      dominantBaseline="middle"
      dx={-6}
      fontSize={14}
      textAnchor="end"
      x="100%"
      y={Number(y) + Number(height) / 2}
    >
      {value}
    </text>
  )
}

const StatusBarChart = ({ data }: { data: StatusDatum[] }) => (
  <ChartContainer config={chartConfig} className="h-64 w-full">
    <BarChart
      accessibilityLayer
      data={data}
      layout="vertical"
      margin={{ left: 0, right: 48 }}
    >
      <CartesianGrid horizontal={false} vertical={false} />
      <YAxis dataKey="status" hide tickLine={false} tickMargin={10} type="category" />
      <XAxis dataKey="count" hide type="number" />
      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
      <Bar barSize={40} dataKey="count" fill="var(--color-count)" fillOpacity={0.5} radius={8}>
        <LabelList className="fill-foreground" dataKey="status" fontSize={14} offset={12} position="insideLeft" />
        <LabelList content={renderValueLabel} dataKey="label" />
      </Bar>
    </BarChart>
  </ChartContainer>
)

export const TopTrafficSources = () => {
  const { ordersByStatus, pickingData, returnData } = useWmsStore(
    useShallow((s) => {
      const chart = selectDashboardChartData(s)

      const pickingCounts: Record<string, number> = {}
      for (const t of s.pickingTasks) {
        pickingCounts[t.status] = (pickingCounts[t.status] ?? 0) + 1
      }
      const pickingData: StatusDatum[] = Object.entries(pickingCounts).map(([st, count]) => ({
        status: statusLabel(st),
        label: String(count),
        count,
      }))

      const returnCounts: Record<string, number> = {}
      for (const r of s.returnOrders) {
        returnCounts[r.status] = (returnCounts[r.status] ?? 0) + 1
      }
      const returnData: StatusDatum[] = Object.entries(returnCounts).map(([st, count]) => ({
        status: statusLabel(st),
        label: String(count),
        count,
      }))

      return {
        ordersByStatus: chart.ordersByStatus.map((o) => ({
          status: o.status,
          label: String(o.count),
          count: o.count,
        })) as StatusDatum[],
        pickingData,
        returnData,
      }
    })
  )

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Distribución por Estado</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="orders" className="flex flex-col gap-3">
          <TabsList className="w-full justify-start border-b px-2.5" variant="line">
            <TabsTrigger className="flex-none font-normal" value="orders">
              Órdenes
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="picking">
              Picking
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="devoluciones">
              Devoluciones
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="px-4">
            <StatusBarChart data={ordersByStatus} />
          </TabsContent>
          <TabsContent value="picking" className="px-4">
            <StatusBarChart data={pickingData} />
          </TabsContent>
          <TabsContent value="devoluciones" className="px-4">
            <StatusBarChart data={returnData} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
