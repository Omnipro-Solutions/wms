'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWmsStore } from '@/store/wms-store'
import { ZplPreviewDialog } from '@/app/(app)/labels/_components/zpl-preview-dialog'
import type { WmsLabel } from '@/types/wms'

interface Props {
  label: WmsLabel
}

export const ReceiptLabelButton = ({ label }: Props) => {
  const [open, setOpen] = useState(false)
  const { printReceiptLabel } = useWmsStore()

  const handleClose = () => {
    setOpen(false)
    if (label.status === 'pending') {
      printReceiptLabel(label.id)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={label.status === 'completed' ? 'outline' : 'default'}
        onClick={() => setOpen(true)}
        className="h-7 gap-1 text-xs"
      >
        <Printer className="size-3" />
        {label.status === 'completed' ? 'Reimprimir' : 'Imprimir'}
      </Button>
      <ZplPreviewDialog label={label} open={open} onClose={handleClose} />
    </>
  )
}
