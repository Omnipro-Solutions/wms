"use client"

import { Bar, BarChart, CartesianGrid, LabelList, type LabelProps, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDashboardFilters } from "./dashboard-filters"
import {
  getMockOrdersByStatus,
  getMockPickingByStatus,
  getMockReturnsByStatus,
  type StatusDatum,
} from "./dashboard-mock-data"

const chartConfig = {
  count: { color: "var(--chart-1)", label: "Cantidad" },
} satisfies ChartConfig

const renderValueLabel = (props: LabelProps) => {
  const { height, value, y } = props
  if (value == null || y == null || height == null) return null
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
    <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
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
  const { warehouseId, days } = useDashboardFilters()

  const ordersByStatus  = getMockOrdersByStatus(warehouseId, days)
  const pickingByStatus = getMockPickingByStatus(warehouseId, days)
  const returnsByStatus = getMockReturnsByStatus(warehouseId, days)

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Distribución por Estado</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="orders" className="flex flex-col gap-3">
          <TabsList className="w-full justify-start border-b px-2.5" variant="line">
            <TabsTrigger className="flex-none font-normal" value="orders">Órdenes</TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="picking">Picking</TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="devoluciones">Devoluciones</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="px-4">
            <StatusBarChart data={ordersByStatus} />
          </TabsContent>
          <TabsContent value="picking" className="px-4">
            <StatusBarChart data={pickingByStatus} />
          </TabsContent>
          <TabsContent value="devoluciones" className="px-4">
            <StatusBarChart data={returnsByStatus} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
