'use client'

import { useMemo, useState } from 'react'
import { Boxes, Layers, MapPin, PackageCheck, Printer } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime } from '@/lib/formatters'
import { isMixedLpn, lpnLinesOf, lpnTotalUnits } from '@/lib/rules/lpn'
import { cn } from '@/lib/utils'
import type { Lpn, LpnStatus, LpnType } from '@/types/wms'

const LPN_TYPE_LABELS: Record<LpnType, string> = {
  pallet: 'Pallet',
  case: 'Caja',
  tote: 'Cubeta',
  container: 'Contenedor',
}

const LPN_STATUS_LABELS: Record<LpnStatus, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
  in_transit: 'En tránsito',
  stored: 'Almacenado',
  consumed: 'Consumido',
}

const LPN_STATUS_TONE: Record<LpnStatus, string> = {
  open: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  closed: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  in_transit: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  stored: 'bg-green-500/10 text-green-700 dark:text-green-300',
  consumed: 'bg-muted text-muted-foreground',
}

export default function LpnPage() {
  const lpns = useWmsStore((s) => s.lpns)
  const lpnLines = useWmsStore((s) => s.lpnLines)
  const products = useWmsStore((s) => s.products)
  const locations = useWmsStore((s) => s.locations)
  const generateLpnLabel = useWmsStore((s) => s.generateLpnLabel)
  const currentOperatorId = useWmsStore((s) => s.currentOperatorId)
  const operators = useWmsStore((s) => s.operators)

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const operatorName =
    operators.find((o) => o.id === currentOperatorId)?.name ?? 'Operario'

  const activeLpns = lpns.filter((l) => l.status !== 'consumed')
  const openLpns = lpns.filter((l) => l.status === 'open')
  const storedLpns = lpns.filter((l) => l.status === 'stored')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return lpns
    return lpns.filter(
      (l) =>
        l.code.toLowerCase().includes(term) ||
        LPN_TYPE_LABELS[l.type].toLowerCase().includes(term)
    )
  }, [lpns, search])

  const selected = selectedId ? lpns.find((l) => l.id === selectedId) : null
  const selectedContents = selected ? lpnLinesOf(selected.id, lpnLines) : []

  const handlePrint = (lpn: Lpn) => {
    generateLpnLabel(lpn.id, operatorName)
  }

  const renderTable = (rows: Lpn[]) => {
    if (rows.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay unidades de carga en esta vista. Se crean al paletizar en el flujo de recepción.
        </p>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">SKU</TableHead>
            <TableHead className="text-right">Unidades</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((lpn) => {
            const contents = lpnLinesOf(lpn.id, lpnLines)
            const location = locations.find((l) => l.id === lpn.locationId)
            const mixed = isMixedLpn(lpn.id, lpnLines)
            return (
              <TableRow
                key={lpn.id}
                onClick={() => setSelectedId(lpn.id === selectedId ? null : lpn.id)}
                className={cn('cursor-pointer', lpn.id === selectedId && 'bg-muted/50')}
              >
                <TableCell className="font-mono text-sm font-medium">{lpn.code}</TableCell>
                <TableCell>{LPN_TYPE_LABELS[lpn.type]}</TableCell>
                <TableCell>
                  <Badge className={cn(LPN_STATUS_TONE[lpn.status])}>
                    {LPN_STATUS_LABELS[lpn.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {location ? location.code : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm">
                    {new Set(contents.map((c) => c.productId)).size}
                  </span>
                  {mixed && (
                    <Badge variant="outline" className="ml-2">
                      Mixto
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {lpnTotalUnits(lpn.id, lpnLines)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(lpn.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrint(lpn)
                    }}
                    title="Imprimir etiqueta"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unidades de carga (LPN)"
        description="Cada pallet, caja o cubeta con su propio código escaneable. Un escaneo mueve todo su contenido."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard icon={Boxes} label="LPN activos" value={activeLpns.length} tone="blue" />
        <KpiCard icon={Layers} label="Abiertos (en armado)" value={openLpns.length} tone="amber" />
        <KpiCard icon={MapPin} label="Almacenados" value={storedLpns.length} tone="green" />
        <KpiCard
          icon={PackageCheck}
          label="Unidades contenidas"
          value={activeLpns.reduce((sum, l) => sum + lpnTotalUnits(l.id, lpnLines), 0)}
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventario de unidades de carga</CardTitle>
          <CardDescription>
            Los LPN nacen en el muelle de recepción al paletizar y acompañan la mercancía hasta el
            despacho.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            placeholder="Buscar por código LPN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          <Tabs defaultValue="todos">
            <TabsList>
              <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
              <TabsTrigger value="abiertos">
                Abiertos ({filtered.filter((l) => l.status === 'open').length})
              </TabsTrigger>
              <TabsTrigger value="almacenados">
                Almacenados ({filtered.filter((l) => l.status === 'stored').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todos">{renderTable(filtered)}</TabsContent>
            <TabsContent value="abiertos">
              {renderTable(filtered.filter((l) => l.status === 'open'))}
            </TabsContent>
            <TabsContent value="almacenados">
              {renderTable(filtered.filter((l) => l.status === 'stored'))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">{selected.code}</CardTitle>
            <CardDescription>
              {LPN_TYPE_LABELS[selected.type]} · {LPN_STATUS_LABELS[selected.status]}
              {selected.asnId && ` · Origen: ${selected.asnId}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedContents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Unidad de carga vacía.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Serie</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedContents.map((line) => {
                    const product = products.find((p) => p.id === line.productId)
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono text-sm">{product?.sku ?? '—'}</TableCell>
                        <TableCell>{product?.name ?? line.productId}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.lot ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.serial ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{line.quantity}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
