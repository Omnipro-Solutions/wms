'use client'

import { useMemo, useState } from 'react'
import { Plus, Tag } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LabelTemplateDialog } from './label-template-dialog'
import type { LabelSymbology, LabelTemplate, LabelType } from '@/types/wms'

const TYPE_LABELS: Record<LabelType, string> = {
  product: 'Producto',
  location: 'Ubicación',
  box: 'Caja',
  pallet: 'Pallet',
  shipping: 'Despacho',
  return: 'Devolución',
  receipt: 'Recepción',
  lpn: 'LPN',
}

const SYMBOLOGY_LABELS: Record<LabelSymbology, string> = {
  code128: 'Code 128',
  'gs1-128': 'GS1-128',
  qr: 'QR',
  datamatrix: 'DataMatrix',
}

export const LabelTemplatesSection = () => {
  const { labelTemplates, warehouses, deleteLabelTemplate } = useWmsStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LabelTemplate | null>(null)

  const warehouseName = useMemo(() => new Map(warehouses.map((w) => [w.id, w.name])), [warehouses])

  const sorted = useMemo(
    () =>
      [...labelTemplates].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        // Global default first, then overrides.
        return Number(!!a.warehouseId) - Number(!!b.warehouseId)
      }),
    [labelTemplates]
  )

  const handleCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (tpl: LabelTemplate) => {
    setEditing(tpl)
    setDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Tag className="size-4" /> Plantillas de etiquetas ({labelTemplates.length})
          </CardTitle>
          <CardDescription>
            Tamaño, densidad, simbología y campos por tipo de etiqueta. Las plantillas por bodega
            sobrescriben la global de ese tipo.
          </CardDescription>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1.5 size-3.5" /> Nueva plantilla
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Simbología</TableHead>
              <TableHead>Auto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center text-sm">
                  No hay plantillas configuradas.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TYPE_LABELS[tpl.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    {tpl.warehouseId ? (
                      <Badge variant="secondary">
                        {warehouseName.get(tpl.warehouseId) ?? tpl.warehouseId}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Global</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {tpl.sizePreset} · {tpl.dpi} dpi
                  </TableCell>
                  <TableCell>{SYMBOLOGY_LABELS[tpl.symbology]}</TableCell>
                  <TableCell>
                    {tpl.autoPrint ? (
                      <Badge className="bg-emerald-600">Sí</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(tpl)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={tpl.isDefault}
                        title={
                          tpl.isDefault ? 'La plantilla global no se puede eliminar' : undefined
                        }
                        onClick={() => deleteLabelTemplate(tpl.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <LabelTemplateDialog
        open={dialogOpen}
        template={editing}
        onClose={() => setDialogOpen(false)}
      />
    </Card>
  )
}
