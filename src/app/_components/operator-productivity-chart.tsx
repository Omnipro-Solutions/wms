'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ProductivityRow } from '@/types/wms'

interface Props {
  operatorProductivity: ProductivityRow[]
}

const chartConfig = {
  unitsPicked: { label: 'Unidades pickeadas', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

export const OperatorProductivityChart = ({ operatorProductivity }: Props) => {
  if (operatorProductivity.length === 0) return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Productividad por Operador</CardTitle>
        <CardDescription>Sin tareas completadas en este turno</CardDescription>
      </CardHeader>
    </Card>
  )

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Productividad por Operador</CardTitle>
        <CardDescription>Unidades pickeadas — top 8 operadores</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart
            layout="vertical"
            data={operatorProductivity}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="operatorName"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="unitsPicked" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
