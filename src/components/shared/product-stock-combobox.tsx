'use client'

import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { Product } from '@/types/wms'

export interface ProductStockOption {
  product: Product
  available: number
}

interface Props {
  options: ProductStockOption[] // productos con stock en el origen (0 disp. ya excluidos)
  value: string // productId seleccionado
  onSelect: (productId: string) => void
  excludeIds?: string[] // productos ya agregados en otras líneas
  disabled?: boolean
}

// Combobox buscable, consciente del stock del origen: solo ofrece productos con
// disponible > 0 en la bodega origen, muestra SKU + "disp: N", y oculta los que ya
// se agregaron en otras líneas (evita duplicados).
export const ProductStockCombobox = ({
  options,
  value,
  onSelect,
  excludeIds = [],
  disabled,
}: Props) => {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.product.id === value)
  const visible = options.filter(
    (o) => o.product.id === value || !excludeIds.includes(o.product.id)
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">
            {selected ? (
              <>
                {selected.product.name}
                <span className="text-muted-foreground ml-1.5 text-xs">
                  · disp {selected.available}
                </span>
              </>
            ) : disabled ? (
              'Selecciona el origen primero'
            ) : (
              'Seleccionar producto'
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar SKU o nombre..." />
          <CommandList>
            <CommandEmpty>Sin productos con stock en el origen.</CommandEmpty>
            <CommandGroup>
              {visible.map((o) => (
                <CommandItem
                  key={o.product.id}
                  value={`${o.product.name} ${o.product.sku}`}
                  onSelect={() => {
                    onSelect(o.product.id)
                    setOpen(false)
                  }}
                >
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{o.product.name}</p>
                      <p className="text-muted-foreground text-xs">{o.product.sku}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      disp: {o.available}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
