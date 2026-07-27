'use client'

import { Building2, Printer, Tag } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { LabelTemplatesSection } from './_components/label-templates-section'

export default function LabelsSettingsPage() {
  const labelTemplates = useWmsStore((s) => s.labelTemplates)

  const total = labelTemplates.length
  const autoPrint = labelTemplates.filter((t) => t.autoPrint).length
  const overrides = labelTemplates.filter((t) => t.warehouseId).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Etiquetas"
        description="Plantillas por tipo de etiqueta: tamaño, densidad (DPI), simbología (Code 128 / GS1-128 / QR / DataMatrix) y campos visibles. Una plantilla por bodega sobrescribe la global de ese tipo. Los cambios se reflejan al instante en la previsualización e impresión ZPL de /etiquetas."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <Tag className="size-3.5" /> Plantillas
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{total}</p>
            <p className="mt-1 text-xs text-zinc-500">configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <Printer className="size-3.5" /> Auto-impresión
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{autoPrint}</p>
            <p className="mt-1 text-xs text-zinc-500">generan etiqueta en su evento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <Building2 className="size-3.5" /> Overrides por bodega
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{overrides}</p>
            <p className="mt-1 text-xs text-zinc-500">sobre las plantillas globales</p>
          </CardContent>
        </Card>
      </div>

      <LabelTemplatesSection />
    </div>
  )
}
