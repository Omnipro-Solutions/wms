'use client'

import { useMemo, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ClipboardCheck,
  Package,
  PackageCheck,
  Pencil,
  ScanLine,
  ShieldAlert,
  Shuffle,
  Tag,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { EmptyState } from '@/app/receiving/_components/empty-state'
import { TabPanel } from '@/app/receiving/_components/tab-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/receiving/_components/product-avatar'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { scanProgress, rulesSummary } from '@/lib/rules/packing'
import { CreateRuleDialog } from './_components/create-rule-dialog'
import type { PackingOrder, PackingRule } from '@/types/wms'

type TabValue = 'verificacion' | 'reglas' | 'etiquetas'

const TRIGGER_LABELS: Record<string, string> = {
  fragile: 'Frágil',
  liquid: 'Líquido',
  heavy: 'Pesado',
  oversized: 'Sobredimensionado',
  hazmat: 'Peligroso',
  cold_chain: 'Cadena Frío',
  high_value: 'Alto Valor',
}

const TRIGGER_COLORS: Record<string, string> = {
  fragile: 'bg-orange-100 text-orange-700 border-orange-200',
  liquid: 'bg-blue-100 text-blue-700 border-blue-200',
  heavy: 'bg-amber-100 text-amber-700 border-amber-200',
  oversized: 'bg-purple-100 text-purple-700 border-purple-200',
  hazmat: 'bg-red-100 text-red-700 border-red-200',
  cold_chain: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  high_value: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

interface VerifyDialogData {
  order: PackingOrder
}

interface RulesDialogData {
  order: PackingOrder
}

interface BoxDialogData {
  order: PackingOrder
}

const PackingPage = () => {
  const state = useWmsStore()
  const { productName: getProductName } = useStoreHelpers()
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    startPacking,
    completePacking,
    applyPackingRule,
    removePackingRule,
    selectBox,
    generateLabel,
    sendToShipping,
    togglePackingRule,
  } = useWmsStore()

  const activeTab = (searchParams.get('tab') as TabValue) ?? 'verificacion'

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', value)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // ─── Dialog state ─────────────────────────────────────────────────────────

  const [createRuleOpen, setCreateRuleOpen] = useState(false)
  const [editRule, setEditRule] = useState<PackingRule | null>(null)
  const [verifyDialog, setVerifyDialog] = useState<VerifyDialogData | null>(null)
  const [rulesDialog, setRulesDialog] = useState<RulesDialogData | null>(null)
  const [boxDialog, setBoxDialog] = useState<BoxDialogData | null>(null)
  const [verifyError, setVerifyError] = useState('')
  const [scannedQty, setScannedQty] = useState('')
  const [packerName, setPackerName] = useState('')
  const [startDialog, setStartDialog] = useState<PackingOrder | null>(null)
  const [startError, setStartError] = useState('')

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const orders = state.packingOrders
    return {
      pending: orders.filter((o) => o.status === 'pending').length,
      inProgress: orders.filter((o) => o.status === 'in_progress').length,
      verified: orders.filter((o) => o.status === 'verified' || o.status === 'labelled').length,
      mismatch: orders.filter((o) => o.status === 'mismatch').length,
      labelled: orders.filter((o) => o.status === 'labelled').length,
      dispatched: orders.filter((o) => o.status === 'dispatched').length,
    }
  }, [state.packingOrders])

  // ─── Column builders ──────────────────────────────────────────────────────

  const packingColumns = useMemo((): ColumnDef<PackingOrder>[] => [
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pedido" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">
          {row.original.orderNumber ?? row.original.orderId}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.customerName}</span>
      ),
    },
    {
      accessorKey: 'channel',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Canal" />,
      cell: ({ row }) =>
        row.original.channel ? (
          <Badge variant="outline" className="text-xs uppercase">
            {row.original.channel}
          </Badge>
        ) : null,
    },
    {
      id: 'items',
      header: 'Ítems',
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original
        const pct = scanProgress(o.scannedItems, o.expectedItems)
        return (
          <div className="min-w-28 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs tabular-nums">
                <span className="font-semibold">{formatNumber(o.scannedItems)}</span>
                <span className="text-muted-foreground"> / {formatNumber(o.expectedItems)}</span>
              </span>
              <span className="text-xs font-bold text-blue-600">{pct}%</span>
            </div>
            <Progress
              value={pct}
              className={cn(
                'h-1.5',
                o.verificationStatus === 'mismatch'
                  ? '*:data-[slot=progress-indicator]:bg-red-500'
                  : '*:data-[slot=progress-indicator]:bg-blue-500'
              )}
            />
          </div>
        )
      },
    },
    {
      accessorKey: 'suggestedBox',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Caja" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Box className="text-muted-foreground size-3" />
          <span className="text-xs">{row.original.suggestedBox}</span>
        </div>
      ),
    },
    {
      accessorKey: 'weightKg',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Peso (kg)" />,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.weightKg} kg</span>
      ),
    },
    {
      id: 'rules',
      header: 'Reglas',
      enableSorting: false,
      cell: ({ row }) => {
        const ruleIds = row.original.appliedRuleIds
        if (ruleIds.length === 0)
          return <span className="text-muted-foreground text-xs">—</span>
        const rules = state.packingRules.filter((r) => ruleIds.includes(r.id))
        return (
          <div className="flex flex-wrap gap-1">
            {rules.map((r) => (
              <Badge
                key={r.id}
                variant="outline"
                className={cn('text-[10px]', TRIGGER_COLORS[r.trigger])}
              >
                {TRIGGER_LABELS[r.trigger]}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'packerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Empacador" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.packerName ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} className="text-xs" />,
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        return (
          <div className="flex items-center gap-1">
            {o.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => {
                setStartDialog(o)
                setPackerName('')
                setStartError('')
              }}>
                <Package className="mr-1 size-3" /> Iniciar
              </Button>
            )}
            {o.status === 'in_progress' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setRulesDialog({ order: o })}>
                  <ShieldAlert className="mr-1 size-3" /> Reglas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBoxDialog({ order: o })}>
                  <Box className="mr-1 size-3" /> Caja
                </Button>
                <Button size="sm" onClick={() => {
                  setVerifyDialog({ order: o })
                  setScannedQty(String(o.expectedItems))
                  setVerifyError('')
                }}>
                  <ScanLine className="mr-1 size-3" /> Verificar
                </Button>
              </>
            )}
            {o.status === 'mismatch' && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setVerifyDialog({ order: o })
                  setScannedQty(String(o.scannedItems))
                  setVerifyError('')
                }}
              >
                <ScanLine className="mr-1 size-3" /> Re-verificar
              </Button>
            )}
            {o.status === 'verified' && !o.labelGenerated && (
              <Button size="sm" onClick={() => handleGenerateLabel(o.id)}>
                <Tag className="mr-1 size-3" /> Etiquetar
              </Button>
            )}
            {o.status === 'labelled' && (
              <Button size="sm" variant="outline" onClick={() => handleSendToShipping(o.id)}>
                <Truck className="mr-1 size-3" /> Despachar
              </Button>
            )}
            {o.status === 'dispatched' && (
              <Badge variant="secondary" className="text-xs text-emerald-700">
                <CheckCircle2 className="mr-1 size-3" /> Despachado
              </Badge>
            )}
          </div>
        )
      },
    },
  ], [state.packingRules])

  const rulesColumns = useMemo((): ColumnDef<PackingRule>[] => [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'trigger',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Disparador" />,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn('text-xs', TRIGGER_COLORS[row.original.trigger])}
        >
          {TRIGGER_LABELS[row.original.trigger]}
        </Badge>
      ),
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs leading-relaxed">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'requirements',
      header: 'Requisitos',
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex flex-wrap gap-1">
            {r.requiresBubbleWrap && (
              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                Burbuja
              </Badge>
            )}
            {r.requiresDoublePacking && (
              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                Doble empaque
              </Badge>
            )}
            {r.requiresDryIce && (
              <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200">
                Hielo seco
              </Badge>
            )}
            {r.requiresVoidFill && (
              <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">
                Relleno
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'labelNote',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nota etiqueta" />,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-amber-700">{row.original.labelNote}</span>
      ),
    },
    {
      accessorKey: 'active',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Activa" />,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'text-xs',
            row.original.active
              ? 'border-green-300 text-green-700 hover:bg-green-50'
              : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
          )}
          onClick={() => handleToggleRule(row.original.id)}
        >
          {row.original.active ? 'Activa' : 'Inactiva'}
        </Button>
      ),
    },
    {
      id: 'edit',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={() => setEditRule(row.original)}
        >
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ], [])

  const labelColumns = useMemo((): ColumnDef<PackingOrder>[] => [
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pedido" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">
          {row.original.orderNumber ?? row.original.orderId}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    },
    {
      accessorKey: 'labelCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código etiqueta" />,
      cell: ({ row }) =>
        row.original.labelCode ? (
          <span className="font-mono text-xs text-purple-700">{row.original.labelCode}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      accessorKey: 'suggestedBox',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Caja" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Box className="text-muted-foreground size-3" />
          <span className="text-xs">{row.original.suggestedBox}</span>
        </div>
      ),
    },
    {
      accessorKey: 'weightKg',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Peso" />,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.weightKg} kg</span>
      ),
    },
    {
      id: 'rules',
      header: 'Reglas aplicadas',
      enableSorting: false,
      cell: ({ row }) => {
        const rules = state.packingRules.filter((r) =>
          row.original.appliedRuleIds.includes(r.id)
        )
        const summary = rulesSummary(rules)
        if (summary.labelNotes.length === 0)
          return <span className="text-muted-foreground text-xs">Sin reglas</span>
        return (
          <div className="space-y-0.5">
            {summary.labelNotes.map((note) => (
              <p key={note} className="text-[10px] font-medium text-amber-700">
                {note}
              </p>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'packerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Empacador" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{row.original.packerName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} className="text-xs" />,
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        if (o.status === 'verified' && !o.labelGenerated)
          return (
            <Button size="sm" onClick={() => handleGenerateLabel(o.id)}>
              <Tag className="mr-1 size-3" /> Generar
            </Button>
          )
        if (o.status === 'labelled')
          return (
            <Button size="sm" variant="outline" onClick={() => handleSendToShipping(o.id)}>
              <Truck className="mr-1 size-3" /> Despachar
            </Button>
          )
        return null
      },
    },
  ], [state.packingRules])

  // ─── Derived data ─────────────────────────────────────────────────────────

  const labelledOrders = useMemo(
    () => state.packingOrders.filter((o) => o.status === 'labelled' || o.status === 'verified' || o.status === 'dispatched'),
    [state.packingOrders]
  )

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!startDialog) return
    if (!packerName.trim()) {
      setStartError('Ingresa el nombre del empacador.')
      return
    }
    try {
      startPacking(startDialog.id, packerName.trim())
      setStartDialog(null)
      setPackerName('')
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Error al iniciar packing')
    }
  }, [startDialog, packerName, startPacking])

  const handleCompleteVerification = useCallback(() => {
    if (!verifyDialog) return
    const n = parseInt(scannedQty, 10)
    if (isNaN(n) || n < 0) {
      setVerifyError('Ingresa una cantidad válida.')
      return
    }
    try {
      completePacking(verifyDialog.order.id, n)
      setVerifyDialog(null)
      setScannedQty('')
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : 'Error al verificar packing')
    }
  }, [verifyDialog, scannedQty, completePacking])

  const handleToggleRule = useCallback(
    (ruleId: string) => {
      try {
        togglePackingRule(ruleId)
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [togglePackingRule]
  )

  const handleApplyRule = useCallback(
    (ruleId: string) => {
      if (!rulesDialog) return
      try {
        applyPackingRule(rulesDialog.order.id, ruleId)
        // Refresh dialog with updated order
        const updated = state.packingOrders.find((o) => o.id === rulesDialog.order.id)
        if (updated) setRulesDialog({ order: updated })
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [rulesDialog, applyPackingRule, state.packingOrders]
  )

  const handleRemoveRule = useCallback(
    (ruleId: string) => {
      if (!rulesDialog) return
      try {
        removePackingRule(rulesDialog.order.id, ruleId)
        const updated = state.packingOrders.find((o) => o.id === rulesDialog.order.id)
        if (updated) setRulesDialog({ order: updated })
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [rulesDialog, removePackingRule, state.packingOrders]
  )

  const handleSelectBox = useCallback(
    (boxTypeId: string) => {
      if (!boxDialog) return
      try {
        selectBox(boxDialog.order.id, boxTypeId)
        setBoxDialog(null)
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [boxDialog, selectBox]
  )

  const handleGenerateLabel = useCallback(
    (orderId: string) => {
      try {
        generateLabel(orderId)
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [generateLabel]
  )

  const handleSendToShipping = useCallback(
    (orderId: string) => {
      try {
        sendToShipping(orderId)
      } catch (e: unknown) {
        console.error(e)
      }
    },
    [sendToShipping]
  )

  // Keep dialog data in sync with store after mutations
  const currentVerifyOrder = verifyDialog
    ? state.packingOrders.find((o) => o.id === verifyDialog.order.id) ?? verifyDialog.order
    : null

  const currentRulesOrder = rulesDialog
    ? state.packingOrders.find((o) => o.id === rulesDialog.order.id) ?? rulesDialog.order
    : null

  return (
    <>
      <PageHeader
        title="Packing"
        description="Verificación de contenido, reglas de empaque y generación de etiquetas de despacho."
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Package}
          value={kpis.pending}
          label="Pendientes"
          sublabel="Por iniciar empaque"
          tone="neutral"
        />
        <KpiCard
          icon={ScanLine}
          value={kpis.inProgress}
          label="En proceso"
          sublabel="Verificando contenido"
          tone="blue"
        />
        <KpiCard
          icon={AlertTriangle}
          value={kpis.mismatch}
          label="Discrepancias"
          sublabel="Requieren re-verificación"
          tone="red"
          alert={kpis.mismatch > 0}
        />
        <KpiCard
          icon={PackageCheck}
          value={kpis.labelled}
          label="Etiquetados"
          sublabel="Listos para despacho"
          tone="green"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="verificacion" className="gap-2">
            <ClipboardCheck className="size-4" />
            Verificación
            <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">
              {state.packingOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reglas" className="gap-2">
            <ShieldAlert className="size-4" />
            Reglas de empaque
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
              {state.packingRules.filter((r) => r.active).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-2">
            <Tag className="size-4" />
            Etiquetas
            <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700">
              {labelledOrders.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Verificación ─────────────────────────────────────────── */}
        <TabsContent value="verificacion">
          <TabPanel
            icon={ClipboardCheck}
            iconClass="text-blue-500"
            title="Verificación de contenido"
            description="Escanea y confirma el contenido de cada paquete antes de generar la etiqueta."
          >
            {state.packingOrders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin órdenes de packing"
                description="Las órdenes de packing se crean automáticamente cuando el picking está completado."
              />
            ) : (
              <DataTable
                columns={packingColumns}
                data={state.packingOrders}
                searchColumn="customerName"
                searchPlaceholder="Buscar por cliente..."
                emptyMessage="No se encontraron órdenes de packing."
              />
            )}
          </TabPanel>
        </TabsContent>

        {/* ── Tab: Reglas de empaque ────────────────────────────────────── */}
        <TabsContent value="reglas">
          <TabPanel
            icon={ShieldAlert}
            iconClass="text-amber-500"
            title="Reglas de empaque"
            description="Define requisitos especiales de empaque según el tipo de producto. Las reglas activas se sugieren automáticamente al empacar."
          >
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setCreateRuleOpen(true)}>
                <ShieldAlert className="mr-1 size-4" /> Nueva regla
              </Button>
            </div>
            {state.packingRules.length === 0 ? (
              <EmptyState
                icon={ShieldAlert}
                title="Sin reglas de empaque"
                description="Las reglas definen requisitos especiales de empaque por tipo de producto."
              />
            ) : (
              <DataTable
                columns={rulesColumns}
                data={state.packingRules}
                searchColumn="name"
                searchPlaceholder="Buscar regla..."
                emptyMessage="No se encontraron reglas."
              />
            )}
          </TabPanel>
        </TabsContent>

        {/* ── Tab: Etiquetas ────────────────────────────────────────────── */}
        <TabsContent value="etiquetas">
          <TabPanel
            icon={Tag}
            iconClass="text-purple-500"
            title="Etiquetas de despacho"
            description="Genera y gestiona las etiquetas de los paquetes verificados. Las notas de reglas aparecen impresas en la etiqueta."
          >
            {labelledOrders.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="Sin etiquetas generadas"
                description="Las etiquetas se generan cuando la verificación de packing es exitosa."
              />
            ) : (
              <DataTable
                columns={labelColumns}
                data={labelledOrders}
                searchColumn="customerName"
                searchPlaceholder="Buscar por cliente..."
                emptyMessage="No se encontraron etiquetas."
              />
            )}
          </TabPanel>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Iniciar packing ───────────────────────────────────────── */}
      <Dialog open={!!startDialog} onOpenChange={(o) => { if (!o) setStartDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar empaque</DialogTitle>
          </DialogHeader>
          {startDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Pedido:{' '}
                  <span className="text-foreground font-mono font-semibold">
                    {startDialog.orderNumber ?? startDialog.orderId}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Cliente:{' '}
                  <span className="text-foreground font-medium">{startDialog.customerName}</span>
                </p>
                <p className="text-muted-foreground">
                  Ítems esperados:{' '}
                  <span className="text-foreground font-medium">{startDialog.expectedItems}</span>
                </p>
                <p className="text-muted-foreground">
                  Caja sugerida:{' '}
                  <span className="text-foreground font-medium">{startDialog.suggestedBox}</span>
                </p>
              </div>
              {startDialog.items && startDialog.items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Contenido del pedido</p>
                  <div className="space-y-1.5">
                    {startDialog.items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3">
                        <ProductAvatar
                          productId={item.productId}
                          name={item.productName}
                        />
                        <span className="text-muted-foreground text-xs ml-auto tabular-nums">
                          {item.requestedQuantity} uds
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="packer-name">Nombre del empacador</Label>
                <Input
                  id="packer-name"
                  placeholder="Ej. Paula Vega"
                  value={packerName}
                  onChange={(e) => setPackerName(e.target.value)}
                />
              </div>
              {startError && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {startError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleStart}>
              <Package className="mr-1 size-4" /> Iniciar empaque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Verificar packing ─────────────────────────────────────── */}
      <Dialog open={!!verifyDialog} onOpenChange={(o) => { if (!o) setVerifyDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verificar contenido</DialogTitle>
          </DialogHeader>
          {currentVerifyOrder && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Cliente:{' '}
                  <span className="text-foreground font-medium">{currentVerifyOrder.customerName}</span>
                </p>
                <p className="text-muted-foreground">
                  Caja:{' '}
                  <span className="text-foreground font-medium">{currentVerifyOrder.suggestedBox}</span>
                </p>
                <p className="text-muted-foreground">
                  Ítems esperados:{' '}
                  <span className="text-foreground font-medium">{currentVerifyOrder.expectedItems}</span>
                </p>
              </div>

              {/* Items list */}
              {currentVerifyOrder.items && currentVerifyOrder.items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Contenido a verificar</p>
                  <div className="divide-y rounded-lg border">
                    {currentVerifyOrder.items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 px-3 py-2">
                        <ProductAvatar productId={item.productId} name={item.productName} />
                        <span className="text-muted-foreground text-xs ml-auto tabular-nums font-medium">
                          {item.requestedQuantity} uds
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Applied rules warnings */}
              {currentVerifyOrder.appliedRuleIds.length > 0 && (
                <div className="space-y-1">
                  {state.packingRules
                    .filter((r) => currentVerifyOrder.appliedRuleIds.includes(r.id))
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700"
                      >
                        <ShieldAlert className="mt-0.5 size-3 shrink-0" />
                        <span className="font-medium">{r.labelNote}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="scanned-qty">Ítems escaneados</Label>
                <Input
                  id="scanned-qty"
                  type="number"
                  min={0}
                  value={scannedQty}
                  onChange={(e) => { setScannedQty(e.target.value); setVerifyError('') }}
                />
              </div>

              {scannedQty !== '' &&
                parseInt(scannedQty, 10) !== currentVerifyOrder.expectedItems && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <p>
                      Discrepancia: esperado{' '}
                      <strong>{currentVerifyOrder.expectedItems}</strong>, escaneado{' '}
                      <strong>{scannedQty}</strong>. Se registrará como{' '}
                      <strong>mismatch</strong>.
                    </p>
                  </div>
                )}

              {scannedQty !== '' &&
                parseInt(scannedQty, 10) === currentVerifyOrder.expectedItems && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <p>Conteo correcto. Se marcará como <strong>verificado</strong>.</p>
                  </div>
                )}

              {verifyError && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {verifyError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCompleteVerification}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar verificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reglas de empaque ─────────────────────────────────────── */}
      <Dialog open={!!rulesDialog} onOpenChange={(o) => { if (!o) setRulesDialog(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reglas de empaque — {currentRulesOrder?.customerName}</DialogTitle>
          </DialogHeader>
          {currentRulesOrder && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                Aplica las reglas que correspondan a este pedido. Las notas de la regla se
                imprimirán en la etiqueta de despacho.
              </p>
              <div className="divide-y rounded-lg border">
                {state.packingRules.filter((r) => r.active).map((rule) => {
                  const applied = currentRulesOrder.appliedRuleIds.includes(rule.id)
                  return (
                    <div key={rule.id} className="flex items-start gap-3 p-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{rule.name}</span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', TRIGGER_COLORS[rule.trigger])}
                          >
                            {TRIGGER_LABELS[rule.trigger]}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{rule.description}</p>
                        {applied && (
                          <p className="text-xs font-medium text-amber-700">{rule.labelNote}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={applied ? 'default' : 'outline'}
                        className={applied ? 'bg-green-600 hover:bg-green-700' : ''}
                        onClick={() => applied ? handleRemoveRule(rule.id) : handleApplyRule(rule.id)}
                      >
                        {applied ? (
                          <><CheckCircle2 className="mr-1 size-3" /> Aplicada</>
                        ) : (
                          <>+ Aplicar</>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRulesDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nueva / Editar regla de empaque ──────────────────────── */}
      <CreateRuleDialog
        open={createRuleOpen || !!editRule}
        rule={editRule ?? undefined}
        onClose={() => { setCreateRuleOpen(false); setEditRule(null) }}
      />

      {/* ── Dialog: Selección de caja ─────────────────────────────────────── */}
      <Dialog open={!!boxDialog} onOpenChange={(o) => { if (!o) setBoxDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar caja</DialogTitle>
          </DialogHeader>
          {boxDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Peso:{' '}
                  <span className="text-foreground font-medium">{boxDialog.order.weightKg} kg</span>
                </p>
                <p className="text-muted-foreground">
                  Volumen:{' '}
                  <span className="text-foreground font-medium">{boxDialog.order.volumeM3} m³</span>
                </p>
                <p className="text-muted-foreground">
                  Caja actual:{' '}
                  <span className="text-foreground font-medium">{boxDialog.order.suggestedBox}</span>
                </p>
              </div>
              <div className="divide-y rounded-lg border">
                {state.packingBoxTypes.map((box) => {
                  const fits =
                    box.maxWeightKg >= boxDialog.order.weightKg &&
                    box.volumeM3 >= boxDialog.order.volumeM3
                  const selected = boxDialog.order.boxTypeId === box.id
                  return (
                    <button
                      key={box.id}
                      className={cn(
                        'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40',
                        selected && 'bg-blue-50',
                        !fits && 'opacity-40 cursor-not-allowed'
                      )}
                      disabled={!fits}
                      onClick={() => fits && handleSelectBox(box.id)}
                    >
                      <Box
                        className={cn(
                          'size-5 shrink-0',
                          selected ? 'text-blue-600' : 'text-muted-foreground'
                        )}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{box.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {box.dimensionsCm} cm · máx {box.maxWeightKg} kg · {box.volumeM3} m³
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="size-4 text-blue-600" />
                      )}
                      {!fits && (
                        <span className="text-xs text-red-500">No apto</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoxDialog(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PackingPage
