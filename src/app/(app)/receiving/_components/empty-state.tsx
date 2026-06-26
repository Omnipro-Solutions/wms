import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export const EmptyState = ({ icon: Icon, title, description }: EmptyStateProps) => (
  <div className="text-muted-foreground flex flex-col items-center gap-3 py-16">
    <div className="bg-muted flex size-16 items-center justify-center rounded-full">
      <Icon className="size-8 opacity-40" />
    </div>
    <p className="text-sm font-medium">{title}</p>
    <p className="max-w-xs text-center text-xs">{description}</p>
  </div>
)
