"use client"

import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useDashboardFilters } from "./dashboard-filters"
import { getMockWeeklyDemand, WEEKLY_DEMAND_PRODUCT_KEYS } from "./dashboard-mock-data"

const CHART_MARGIN = { bottom: 0, left: 0, right: 0, top: 0 }

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const chartConfig: ChartConfig = WEEKLY_DEMAND_PRODUCT_KEYS.reduce<ChartConfig>((acc, key, i) => {
  acc[key] = { color: CHART_COLORS[i], label: key }
  return acc
}, {})

export const TrafficQuality = () => {
  const { warehouseId, days } = useDashboardFilters()
  const weeklyDemand = getMockWeeklyDemand(warehouseId, days)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Demanda Semanal — Top 5 Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-68 w-full">
          <ComposedChart data={weeklyDemand} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tickMargin={14} />
            <YAxis axisLine={false} tickLine={false} tickMargin={10} width={34} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent className="w-48" />} />
            {WEEKLY_DEMAND_PRODUCT_KEYS.map((key, i) => (
              <Line
                key={key}
                dataKey={key}
                dot={false}
                activeDot={{ r: 4 }}
                stroke={CHART_COLORS[i]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
