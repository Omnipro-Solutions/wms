'use client'

import { useMemo, useState } from 'react'
import { MapPinned, Plus, TriangleAlert } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import { CreateManifestDialog } from './_components/create-manifest-dialog'
import { ManifestCard } from './_components/manifest-card'

interface CloseDialogData {
  manifestId: string
  code: string
}

export default function LoadManifestsPage() {
  const state = useWmsStore()
  const { createManifest, dispatchManifest, closeManifest } = state

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const closeDialog = useDialogState<CloseDialogData>()

  // ── Derived data for the create dialog ────────────────────────────────────

  const pendingOrders = useMemo(
    () => state.commerceOrders.filter((o) => o.status === 'completed'),
    [state.commerceOrders]
  )

  const pendingTransfers = useMemo(
    () => state.transfers.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [state.transfers]
  )

  const pendingReturns = useMemo(
    () => state.returnOrders.filter((r) => r.status === 'in_transit_to_dc'),
    [state.returnOrders]
  )

  // ── Filtered manifests ─────────────────────────────────────────────────────

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? state.loadManifests
        : state.loadManifests.filter((m) => m.status === statusFilter),
    [state.loadManifests, statusFilter]
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const { totalUnits, totalWeight, activeCount, pendingCount } = useMemo(() => {
    let units = 0, weight = 0, active = 0, pending = 0
    for (const m of state.loadManifests) {
      units += m.totalUnits
      weight += m.totalWeightKg
      if (m.status === 'in_progress') active++
      if (m.status === 'pending') pending++
    }
    return { totalUnits: units, totalWeight: weight, activeCount: active, pendingCount: pending }
  }, [state.loadManifests])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateManifest = (data: {
    sapRouteId: string
    manifestDate: string
    orderIds: string[]
    transferIds: string[]
    returnIds: string[]
  }) => {
    try {
      createManifest(data)
      setCreateOpen(false)
      setCreateError('')
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Error al crear manifiesto')
    }
  }

  const handleDispatch = (manifestId: string) => {
    try {
      dispatchManifest(manifestId)
    } catch (e: unknown) {
      console.error(e)
    }
  }

  const handleCloseConfirm = () => {
    if (!closeDialog.data) return
    try {
      closeManifest(closeDialog.data.manifestId)
      closeDialog.close()
    } catch (e: unknown) {
      closeDialog.setError(e instanceof Error ? e.message : 'Error al cerrar manifiesto')
    }
  }

  return (
    <>
      <PageHeader
        title="Manifiestos de carga"
        description="Crea y gestiona los manifiestos de despacho por ruta SAP. Asigna documentos, despacha y cierra manifiestos."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Manifiestos activos</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatNumber(activeCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Pendientes de despacho</p>
            <p className="text-2xl font-bold text-amber-600 tabular-nums">
              {formatNumber(pendingCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Unidades totales</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalUnits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Peso total (kg)</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalWeight)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <MapPinned className="size-4" /> Manifiestos
          <span className="text-muted-foreground font-normal">({filtered.length})</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En tránsito</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => {
            setCreateError('')
            setCreateOpen(true)
          }}
        >
          <Plus className="mr-1 size-4" /> Nuevo manifiesto
        </Button>
      </div>

      {/* Manifest cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay manifiestos con el filtro seleccionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <ManifestCard
              key={m.id}
              manifest={m}
              warehouses={state.warehouses}
              orders={state.commerceOrders}
              transfers={state.transfers}
              returns={state.returnOrders}
              onDispatch={handleDispatch}
              onClose={(id) => {
                const manifest = state.loadManifests.find((x) => x.id === id)
                if (manifest) closeDialog.open({ manifestId: id, code: manifest.code })
              }}
            />
          ))}
        </div>
      )}

      {/* Create manifest dialog */}
      <CreateManifestDialog
        open={createOpen}
        pendingOrders={pendingOrders}
        pendingTransfers={pendingTransfers}
        pendingReturns={pendingReturns}
        error={createError}
        onConfirm={handleCreateManifest}
        onClose={() => setCreateOpen(false)}
      />

      {/* Close manifest confirmation */}
      <Dialog
        open={!!closeDialog.data}
        onOpenChange={(o) => { if (!o) closeDialog.close() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar manifiesto</DialogTitle>
          </DialogHeader>
          {closeDialog.data && (
            <div className="space-y-3 py-2">
              <p className="text-muted-foreground text-sm">
                ¿Confirmas el cierre del manifiesto{' '}
                <strong className="text-foreground font-mono">{closeDialog.data.code}</strong>?
                Esta acción marca el manifiesto como <strong>Completado</strong> y no podrá editarse.
              </p>
              {closeDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {closeDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCloseConfirm}>Cerrar manifiesto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
