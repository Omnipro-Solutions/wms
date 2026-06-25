'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  weeklyDemand: Record<string, string | number>[]
}

const AREA_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export const DemandTrendChart = ({ weeklyDemand }: Props) => {
  if (weeklyDemand.length === 0) return null

  const productNames = Object.keys(weeklyDemand[0]).filter((k) => k !== 'week')

  const chartConfig = Object.fromEntries(
    productNames.map((name, i) => [name, { label: name, color: AREA_COLORS[i % AREA_COLORS.length] }])
  ) satisfies ChartConfig

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Demanda Semanal</CardTitle>
        <CardDescription>Top 5 productos — últimas 8 semanas</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={weeklyDemand} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {productNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={AREA_COLORS[i % AREA_COLORS.length]}
                fill={AREA_COLORS[i % AREA_COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
