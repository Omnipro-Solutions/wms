'use client'

import Image from 'next/image'
import { MoreHorizontal, Package, TrendingDown } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectAgingReport, selectLowRotationAlerts } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { InventoryRow } from '../columns'

const ABC_PILL: Record<string, string> = {
  A: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  B: 'border-amber-200 bg-amber-50 text-amber-700',
  C: 'border-zinc-200 bg-zinc-50 text-zinc-500',
}

const ProductCell = ({ name, sku, imageUrl }: { name: string; sku: string; imageUrl?: string }) => (
  <div className="flex items-center gap-3">
    <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      <p className="font-mono text-[11px] leading-tight text-muted-foreground">{sku}</p>
    </div>
  </div>
)

interface AgingReportPanelProps {
  inventoryRows: InventoryRow[]
  onRelocate: (row: InventoryRow) => void
  onOpenDetail: (row: InventoryRow) => void
}

export const AgingReportPanel = ({ inventoryRows, onRelocate, onOpenDetail }: AgingReportPanelProps) => {
  const state = useWmsStore()
  const { productName, productSku, getProduct, locationCode } = useStoreHelpers()

  const rows = selectAgingReport(state)
  const lowRotationCount = selectLowRotationAlerts(state).length
  const threshold = state.settings.agingLowRotationDays

  return (
    <div className="flex flex-col gap-6">
      {lowRotationCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <TrendingDown className="size-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">
              {lowRotationCount} posición{lowRotationCount !== 1 ? 'es' : ''} con baja rotación
            </span>{' '}
            — más de {threshold} días en bodega sin salir. Candidatas a promoción, reubicación a
            zona remota o revisión de compra.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Antigüedad de inventario</CardTitle>
          <CardDescription>
            Días transcurridos desde la recepción de cada posición. Baja rotación = más de{' '}
            {threshold} días (<code className="text-[11px]">WmsSettings.agingLowRotationDays</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Sin posiciones de inventario.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Lote/Serial</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Días en bodega</TableHead>
                  <TableHead>Rotación</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const fullRow = inventoryRows.find((row) => row.id === r.itemId)
                  return (
                  <TableRow
                    key={r.itemId}
                    onClick={fullRow ? () => onOpenDetail(fullRow) : undefined}
                    className={cn('border-border/60 transition-colors hover:bg-muted/40', fullRow && 'cursor-pointer')}
                  >
                    <TableCell>
                      <ProductCell
                        name={productName(r.productId)}
                        sku={productSku(r.productId)}
                        imageUrl={getProduct(r.productId)?.imageUrl}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(r.locationId)}</TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {r.lot ? `L: ${r.lot}` : r.serial ? `S: ${r.serial}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', ABC_PILL[r.abcClass])}>
                        {r.abcClass}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(r.available)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono font-semibold tabular-nums',
                        r.isLowRotation ? 'text-amber-600' : 'text-muted-foreground'
                      )}
                    >
                      {r.agingInDays}
                    </TableCell>
                    <TableCell>
                      {r.isLowRotation ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-700">
                          Baja rotación
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Normal</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {fullRow && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="size-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onRelocate(fullRow)}>Reubicar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
