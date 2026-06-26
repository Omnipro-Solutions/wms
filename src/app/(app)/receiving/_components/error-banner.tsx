import { AlertTriangle } from 'lucide-react'

interface ErrorBannerProps {
  message: string
}

export const ErrorBanner = ({ message }: ErrorBannerProps) => (
  <p className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
    <AlertTriangle className="size-3.5 shrink-0" /> {message}
  </p>
)
