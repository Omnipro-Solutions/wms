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
import type { WmsLabel } from '@/types/wms'

export default function LabelsPage() {
  const state = useWmsStore()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const byType = Object.keys(TYPE_LABELS).map((t) => ({
    type: t as WmsLabel['type'],
    count: state.labels.filter((l) => l.type === t).length,
  }))

  const columns = useMemo(() => buildLabelColumns(), [])

  const filtersNode = (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <SelectItem key={val} value={val}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
    </>
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

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {byType.map(({ type, count }) => (
          <Card
            key={type}
            className={cn(
              'cursor-pointer transition-colors',
              typeFilter === type && 'ring-primary ring-2'
            )}
            onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
          >
            <CardContent className="pt-4 pb-4">
              <p className="text-muted-foreground text-xs">{TYPE_LABELS[type]}</p>
              <p className="text-xl font-bold tabular-nums">{count}</p>
              {typeFilter === type && (
                <div
                  className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}
                >
                  Filtrando
                </div>
              )}
            </CardContent>
          </Card>
        ))}
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
    </>
  )
}
