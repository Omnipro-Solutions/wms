"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const chartConfig = {
  unitsPicked: {
    color: "var(--chart-3)",
    label: "Unidades",
  },
} satisfies ChartConfig

export const RealtimeVisitors = () => {
  const { operatorProductivity } = useWmsStore(
    useShallow((s) => selectDashboardChartData(s))
  )

  if (!operatorProductivity || operatorProductivity.length === 0) return null

  const top = operatorProductivity[0]
  const top4 = operatorProductivity.slice(0, 4)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Productividad de Operadores</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl tabular-nums leading-none tracking-tight">
              {top.unitsPicked}
            </span>
            <span className="text-muted-foreground text-sm">uds. — {top.operatorName}</span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-36 w-full">
          <BarChart
            data={operatorProductivity}
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
            barCategoryGap={3}
          >
            <XAxis dataKey="operatorName" hide />
            <YAxis hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="unitsPicked" fill="var(--color-unitsPicked)" radius={2} />
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-2">
          {top4.map((row, i) => {
            const isLastRow = i >= 2
            const isRightCol = i % 2 === 1
            return (
              <div
                key={row.operatorName}
                className={cn(
                  "flex items-center gap-3",
                  !isLastRow && "border-b border-border/50",
                  !isRightCol ? "border-r border-border/50 pr-5" : "pl-5",
                  isLastRow ? "pt-4 pb-1" : "pt-1 pb-4",
                )}
              >
                <span className="size-2 rounded-full bg-chart-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{row.operatorName}</span>
                <span className="text-sm tabular-nums">{row.unitsPicked}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
