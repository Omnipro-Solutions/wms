import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icon: LucideIcon
  value: number | string
  label: string
  sublabel?: string
  tone: 'blue' | 'red' | 'amber' | 'green' | 'neutral'
}

const TONE_BADGE: Record<KpiCardProps['tone'], string> = {
  blue: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

export const KpiCard = ({ icon: Icon, value, label, sublabel, tone }: KpiCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-1.5 font-normal text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-2xl leading-none tracking-tight">{value}</div>
        {sublabel && (
          <Badge className={cn(TONE_BADGE[tone])}>{sublabel}</Badge>
        )}
      </div>
    </CardContent>
  </Card>
)
