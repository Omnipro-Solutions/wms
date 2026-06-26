"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export const TrafficQuality = () => {
  const { weeklyDemand } = useWmsStore(
    useShallow((s) => selectDashboardChartData(s))
  )

  if (!weeklyDemand || weeklyDemand.length === 0) return null

  const productKeys = Object.keys(weeklyDemand[0]).filter((k) => k !== "week")

  const chartConfig = productKeys.reduce<ChartConfig>((acc, key, i) => {
    acc[key] = { color: CHART_COLORS[i % CHART_COLORS.length], label: key }
    return acc
  }, {})

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Demanda Semanal — Top 5 Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-68 w-full">
          <ComposedChart data={weeklyDemand} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tickMargin={14}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              width={34}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="w-48" />}
            />
            {productKeys.map((key, i) => (
              <Line
                key={key}
                dataKey={key}
                dot={false}
                activeDot={{ r: 4 }}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
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
