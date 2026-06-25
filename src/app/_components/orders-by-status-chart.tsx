'use client'

import { BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  ordersByStatus: { status: string; count: number; fill: string }[]
}

const chartConfig = {
  count: { label: 'Órdenes' },
} satisfies ChartConfig

export const OrdersByStatusChart = ({ ordersByStatus }: Props) => {
  if (ordersByStatus.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Órdenes por Estado</CardTitle>
        <CardDescription>Distribución actual de órdenes de comercio</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart
            data={ordersByStatus}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {ordersByStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
