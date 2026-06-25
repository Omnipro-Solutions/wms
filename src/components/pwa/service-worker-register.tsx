'use client'

import { useEffect } from 'react'

export const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // SW registration failure is non-fatal — app works without it
        })
    }
  }, [])

  return null
}
