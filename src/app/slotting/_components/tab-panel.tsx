import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TabPanelProps {
  icon: LucideIcon
  iconClass?: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}

export const TabPanel = ({ icon: Icon, iconClass, title, description, action, children }: TabPanelProps) => (
  <Card className="border-0 shadow-sm">
    <CardHeader className="pb-2 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 size-5 shrink-0', iconClass)} />
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)
