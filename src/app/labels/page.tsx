'use client'

import { useMemo, useState } from 'react'
import { Tag } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { buildLabelColumns, TYPE_LABELS, TYPE_COLORS, type LabelRow } from './columns'
import { ZplPreviewDialog } from './_components/zpl-preview-dialog'
import type { WmsLabel } from '@/types/wms'

export default function LabelsPage() {
  const state = useWmsStore()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [previewLabel, setPreviewLabel] = useState<WmsLabel | null>(null)

  const handlePreview = (row: LabelRow) => {
    const label = state.labels.find((l) => l.id === row.id) ?? null
    setPreviewLabel(label)
  }

  const rows = useMemo<LabelRow[]>(
    () =>
      state.labels.map((l) => ({
        id: l.id,
        code: l.code,
        type: l.type,
        reference: l.reference,
        status: l.status,
        createdBy: l.createdBy,
        createdAt: l.createdAt,
      })),
    [state.labels]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        return true
      }),
    [rows, typeFilter, statusFilter]
  )

  const completedCount = state.labels.filter((l) => l.status === 'completed').length
  const pendingCount = state.labels.filter((l) => l.status === 'pending').length


  const columns = useMemo(() => buildLabelColumns(handlePreview), [state.labels])

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Type chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            typeFilter === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground hover:border-foreground/40'
          )}
          onClick={() => setTypeFilter('all')}
        >
          Todos
        </button>
        {Object.entries(TYPE_LABELS).map(([val, label]) => {
          const count = state.labels.filter((l) => l.type === val).length
          return (
            <button
              key={val}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === val
                  ? cn('border-transparent', TYPE_COLORS[val as WmsLabel['type']])
                  : 'bg-background text-muted-foreground hover:border-foreground/40'
              )}
              onClick={() => setTypeFilter(typeFilter === val ? 'all' : val)}
            >
              {label}
              <span className="ml-1 tabular-nums opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="completed">Completada</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Etiquetas"
        description="Gestión de etiquetas de producto, ubicación, caja, pallet, envío y devolución."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Total etiquetas</p>
            <p className="text-2xl font-bold tabular-nums">{state.labels.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Generadas</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Pendientes</p>
            <p className="text-2xl font-bold text-amber-600 tabular-nums">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

<Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Tag className="size-4" /> Etiquetas
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="code"
            searchPlaceholder="Buscar código..."
            filters={filtersNode}
            emptyMessage="No hay etiquetas con los filtros seleccionados."
          />
        </CardContent>
      </Card>

      <ZplPreviewDialog
        label={previewLabel}
        open={previewLabel !== null}
        onClose={() => setPreviewLabel(null)}
      />
    </>
  )
}
