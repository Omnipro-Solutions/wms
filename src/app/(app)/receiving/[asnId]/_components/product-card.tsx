import { Package, Barcode, RotateCcw, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatNumber } from '@/lib/formatters'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import type { Product, PurchaseOrder, Asn } from '@/types/wms'

const AbcChip = ({ abcClass }: { abcClass: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
      abcClass === 'A'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : abcClass === 'B'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-zinc-200 bg-zinc-50 text-zinc-600'
    )}
  >
    {abcClass}
    <span className="font-normal opacity-70">
      {abcClass === 'A' ? 'Alta' : abcClass === 'B' ? 'Media' : 'Baja'}
    </span>
  </span>
)

const TRACK_BY_LABEL: Record<string, string> = {
  none: 'Sin trazabilidad',
  lot: 'Por lote',
  serial: 'Por serial',
}

const Attr = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-start gap-2">
    <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{children}</div>
    </div>
  </div>
)

interface PoLinesTableProps {
  po: PurchaseOrder
  currentProductId: string
}

const PoLinesTable = ({ po, currentProductId }: PoLinesTableProps) => {
  const { productName, productSku } = useStoreHelpers()
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Líneas de la orden de compra · {po.code}
      </p>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              {['Producto', 'Pedido', 'Recibido', 'Pendiente'].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    'px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60',
                    i === 0 ? 'text-left' : 'text-right'
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {po.lines.map((line) => {
              const pending = line.orderedQty - line.receivedQty
              const isThisLine = line.productId === currentProductId
              return (
                <tr key={line.id} className={cn('transition-colors', isThisLine && 'bg-primary/5')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isThisLine && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <div>
                        <p className="font-semibold leading-snug">{productName(line.productId)}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {productSku(line.productId)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(line.orderedQty)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                    {formatNumber(line.receivedQty)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={cn('font-bold', pending > 0 ? 'text-amber-600' : 'text-muted-foreground/50')}>
                      {formatNumber(pending)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface Props {
  asn: Asn
  product: Product
  po: PurchaseOrder | null
  abcClass: string
}

export const ProductCard = ({ asn, product, po, abcClass }: Props) => (
  <Card className="shadow-sm">
    <CardContent className="p-0">
      <div className="px-4 pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
            <span className="text-sm font-bold text-muted-foreground">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold leading-tight">{product.name}</h2>
              <Badge variant="secondary" className="font-mono text-xs font-semibold">
                {product.sku}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{product.category}</span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <AbcChip abcClass={abcClass} />
            </div>
          </div>
        </div>

        {/* Attributes row */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Attr icon={ScanLine} label="Trazabilidad">
            {TRACK_BY_LABEL[product.trackBy] ?? product.trackBy}
          </Attr>
          <Attr icon={Barcode} label="Código de barras">
            <span className="font-mono text-xs">{product.barcode}</span>
          </Attr>
          <Attr icon={RotateCcw} label="Rotación">
            <AbcChip abcClass={abcClass} />
          </Attr>
        </div>
      </div>

      {po && (
        <>
          <Separator />
          <div className="px-4 py-4">
            <PoLinesTable po={po} currentProductId={asn.productId} />
          </div>
        </>
      )}
    </CardContent>
  </Card>
)
