import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TabPanelProps {
  icon: LucideIcon
  iconClass: string
  title: string
  description: string
  children: ReactNode
}

export const TabPanel = ({ icon: Icon, iconClass, title, description, children }: TabPanelProps) => (
  <Card className="border-0 shadow-sm">
    <CardHeader className="pt-4 pb-2">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', iconClass)} />
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        </div>
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)
