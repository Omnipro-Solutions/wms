'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  gauges: { name: string; value: number; fill: string }[]
}

const chartConfig = {
  value: { label: 'Valor' },
} satisfies ChartConfig

export const OtifIraGauge = ({ gauges }: Props) => {
  if (gauges.length === 0) return null

  const otif = gauges.find((g) => g.name === 'OTIF')
  const ira = gauges.find((g) => g.name === 'IRA')

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">OTIF + IRA</CardTitle>
        <CardDescription>Cumplimiento entrega e inventario</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-8 pb-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-[180px]">
          <RadialBarChart
            data={gauges}
            innerRadius={40}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background cornerRadius={4} />
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="flex flex-col gap-3">
          {otif && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">OTIF</span>
              <span className="text-2xl font-bold" style={{ color: otif.fill }}>
                {otif.value}%
              </span>
            </div>
          )}
          {ira && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">IRA</span>
              <span className="text-2xl font-bold" style={{ color: ira.fill }}>
                {ira.value}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
