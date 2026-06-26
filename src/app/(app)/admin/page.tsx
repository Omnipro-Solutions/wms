'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Box,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Database,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  RotateCcw,
  Ruler,
  Settings,
  ShieldCheck,
  Snowflake,
  Truck,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useWmsStore, resetStore } from '@/store/wms-store'
import { selectInventoryAccuracy } from '@/store/selectors'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { cn } from '@/lib/utils'
import type { CyclicCountMethod, DeliveryWindow, Product, UnitOfMeasure, Warehouse } from '@/types/wms'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Packer',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

const CONTEXT_LABELS: Record<string, string> = {
  return: 'Devolución',
  partial_picking: 'Picking parcial',
  adjustment: 'Ajuste',
  scrap: 'Baja',
  hold: 'Bloqueo',
}

const COUNT_METHOD_LABELS: Record<CyclicCountMethod, string> = {
  by_zone: 'Por zona',
  by_abc: 'Por clase ABC',
  by_rotation: 'Por rotación',
}

const COUNT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
  in_progress: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
  completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
  cancelled: 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/50',
}

const ROTATION_LABELS: Record<string, string> = {
  fifo: 'FIFO — Primero en entrar, primero en salir',
  fefo: 'FEFO — Primero en vencer, primero en salir',
  lifo: 'LIFO — Último en entrar, primero en salir',
}

const ADMIN_TABS: SubNavItem[] = [
  { value: 'operators', label: 'Operadores' },
  { value: 'reasons', label: 'Razones' },
  { value: 'carriers', label: 'Carriers' },
  { value: 'inventory-control', label: 'Control inventario' },
  { value: 'cyclic-counts', label: 'Conteos cíclicos' },
  { value: 'uom', label: 'Unidades de medida' },
  { value: 'products', label: 'Productos' },
  { value: 'settings', label: 'Configuración' },
  { value: 'almacenes', label: 'Almacenes' },
]

const PRODUCT_BLANK = { rotationStrategy: undefined as Product['rotationStrategy'], minStockUnits: '' as number | '', maxStockUnits: '' as number | '' }

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const AdminPage = () => {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'operators'
  const state = useWmsStore()
  const {
    warehouses,
    locations,
    products,
    operators,
    reasons,
    carriers,
    unitsOfMeasure,
    inventoryItems,
    stockMovements,
    commerceOrders,
    pickingTasks,
    adjustmentRequests,
    cyclicCountPlans,
    settings,
    toggleOperator,
    toggleReason,
    toggleCarrier,
    updateSettings,
    approveAdjustment,
    rejectAdjustment,
    createCyclicCount,
    startCyclicCount,
    completeCyclicCount,
    cancelCyclicCount,
    createUom,
    updateUom,
    toggleUom,
    updateProduct,
  } = useWmsStore()

  const accuracy = selectInventoryAccuracy(state)

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [localSettings, setLocalSettings] = useState({ ...settings })

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  // Create cyclic count form
  const [countFormOpen, setCountFormOpen] = useState(false)
  const [countForm, setCountForm] = useState({
    name: '',
    method: 'by_zone' as CyclicCountMethod,
    filterValue: '',
    warehouseId: warehouses[0]?.id ?? '',
    scheduledDate: '',
    assignedOperatorName: '',
  })
  const [countFormError, setCountFormError] = useState('')

  // Almacenes — delivery windows editor
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null)
  const [windowsForm, setWindowsForm] = useState<DeliveryWindow[]>([])

  const handleOpenWarehouse = (wh: Warehouse) => {
    setEditingWarehouseId(wh.id)
    setWindowsForm(wh.deliveryWindows ?? [])
  }

  const handleAddWindow = () => {
    setWindowsForm((prev) => [...prev, { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' }])
  }

  const handleRemoveWindow = (idx: number) => {
    setWindowsForm((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveWindows = () => {
    if (!editingWarehouseId) return
    state.updateWarehouseDeliveryWindows(editingWarehouseId, windowsForm)
    setEditingWarehouseId(null)
  }

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const handleToggleFreeze = () => {
    const next = !settings.inventoryFreezeActive
    updateSettings({ inventoryFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, inventoryFreezeActive: next }))
  }

  const handleOpenReject = (id: string) => {
    setRejectingId(id)
    setRejectNote('')
    setRejectDialogOpen(true)
  }

  const handleConfirmReject = () => {
    if (!rejectNote.trim()) return
    rejectAdjustment(rejectingId, 'Supervisor', rejectNote.trim())
    setRejectDialogOpen(false)
  }

  const handleCreateCount = () => {
    setCountFormError('')
    if (!countForm.name.trim()) { setCountFormError('El nombre es obligatorio'); return }
    if (!countForm.filterValue.trim()) { setCountFormError('El valor de filtro es obligatorio'); return }
    if (!countForm.scheduledDate) { setCountFormError('La fecha es obligatoria'); return }

    const filterLocs = locations.filter((l) => {
      if (countForm.warehouseId && l.warehouseId !== countForm.warehouseId) return false
      if (countForm.method === 'by_zone') return l.zone === countForm.filterValue.toUpperCase()
      return true
    })

    createCyclicCount({
      name: countForm.name.trim(),
      method: countForm.method,
      filterValue: countForm.filterValue.trim(),
      warehouseId: countForm.warehouseId,
      locationIds: filterLocs.map((l) => l.id),
      assignedOperatorName: countForm.assignedOperatorName.trim() || undefined,
      scheduledDate: countForm.scheduledDate,
      totalLocations: filterLocs.length,
    })
    setCountFormOpen(false)
    setCountForm({
      name: '',
      method: 'by_zone',
      filterValue: '',
      warehouseId: warehouses[0]?.id ?? '',
      scheduledDate: '',
      assignedOperatorName: '',
    })
  }

  // UoM form state
  const UOM_BLANK = { code: '', name: '', abbreviation: '' }
  const [uomFormOpen, setUomFormOpen] = useState(false)
  const [uomEditId, setUomEditId] = useState<string | null>(null)
  const [uomForm, setUomForm] = useState(UOM_BLANK)
  const [uomFormError, setUomFormError] = useState('')

  const handleOpenUomCreate = () => {
    setUomEditId(null)
    setUomForm(UOM_BLANK)
    setUomFormError('')
    setUomFormOpen(true)
  }

  const handleOpenUomEdit = (uom: UnitOfMeasure) => {
    setUomEditId(uom.id)
    setUomForm({ code: uom.code, name: uom.name, abbreviation: uom.abbreviation })
    setUomFormError('')
    setUomFormOpen(true)
  }

  const handleSaveUom = () => {
    setUomFormError('')
    if (!uomForm.code.trim()) { setUomFormError('El código es obligatorio'); return }
    if (!uomForm.name.trim()) { setUomFormError('El nombre es obligatorio'); return }
    if (!uomForm.abbreviation.trim()) { setUomFormError('La abreviatura es obligatoria'); return }
    const duplicate = unitsOfMeasure.find(
      (u) => u.code.toUpperCase() === uomForm.code.trim().toUpperCase() && u.id !== uomEditId
    )
    if (duplicate) { setUomFormError('Ya existe una UM con ese código'); return }
    if (uomEditId) {
      updateUom(uomEditId, {
        code: uomForm.code.trim().toUpperCase(),
        name: uomForm.name.trim(),
        abbreviation: uomForm.abbreviation.trim(),
      })
    } else {
      createUom({
        code: uomForm.code.trim().toUpperCase(),
        name: uomForm.name.trim(),
        abbreviation: uomForm.abbreviation.trim(),
        active: true,
      })
    }
    setUomFormOpen(false)
  }

  // Product edit dialog state
  const [productEditOpen, setProductEditOpen] = useState(false)
  const [productEditId, setProductEditId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState(PRODUCT_BLANK)

  const handleOpenProductEdit = (product: Product) => {
    setProductEditId(product.id)
    setProductForm({
      rotationStrategy: product.rotationStrategy,
      minStockUnits: product.minStockUnits ?? '',
      maxStockUnits: product.maxStockUnits ?? '',
    })
    setProductEditOpen(true)
  }

  const handleSaveProduct = () => {
    if (!productEditId) return
    updateProduct(productEditId, {
      rotationStrategy: productForm.rotationStrategy,
      minStockUnits: productForm.minStockUnits === '' ? undefined : Number(productForm.minStockUnits),
      maxStockUnits: productForm.maxStockUnits === '' ? undefined : Number(productForm.maxStockUnits),
    })
    setProductEditOpen(false)
  }

  const totalInventoryUnits = inventoryItems.reduce((s, i) => s + i.onHandQuantity, 0)

  const storeStats = [
    { label: 'Almacenes', value: warehouses.length, icon: Building2 },
    { label: 'Ubicaciones', value: locations.length, icon: MapPin },
    { label: 'Productos', value: products.length, icon: Package },
    { label: 'Ítems de inventario', value: inventoryItems.length, icon: Box },
    { label: 'Unidades en stock', value: totalInventoryUnits, icon: Database },
    { label: 'Movimientos auditados', value: stockMovements.length, icon: ShieldCheck },
    { label: 'Órdenes commerce', value: commerceOrders.length, icon: Truck },
    { label: 'Tareas de picking', value: pickingTasks.length, icon: RefreshCw },
  ]

  const pendingAdj = adjustmentRequests.filter((r) => r.status === 'pending_approval')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administración"
        description="Gestión de configuración, operadores, razones y datos de la sesión."
        actions={
          <Button variant="destructive" size="sm" onClick={() => setResetDialogOpen(true)}>
            <RotateCcw className="mr-2 size-4" />
            Resetear demo
          </Button>
        }
      />

      {/* Freeze banner */}
      {settings.inventoryFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <div className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold">Inventario congelado</p>
            <p className="text-blue-700 dark:text-blue-300">Los ajustes, bloqueos y liberaciones de stock están deshabilitados hasta que se desactive el modo congelado.</p>
          </div>
          <Button size="sm" variant="outline" className="border-blue-300 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50" onClick={handleToggleFreeze}>
            Descongelar
          </Button>
        </div>
      )}

      {/* Pending adjustments alert */}
      {pendingAdj.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{pendingAdj.length} ajuste(s) de inventario</span> esperan aprobación de supervisor.
          </p>
          <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50" onClick={() => {}}>
            Ver en Inventario
          </Button>
        </div>
      )}

      {/* Store health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-blue-500" />
            Estado del almacén local (localStorage)
          </CardTitle>
          <CardDescription>Datos actualmente persistidos en esta sesión del navegador.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {storeStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <Icon className="size-5 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-300">{value}</p>
                  <p className="text-xs text-zinc-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SubNav items={ADMIN_TABS} defaultValue="operators" />

      {/* ── Operators ── */}
      {activeTab === 'operators' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="size-4" /> Operadores ({operators.length})
              </CardTitle>
              <CardDescription>Usuarios operativos registrados en el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operators.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-medium">{op.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABELS[op.role] ?? op.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{op.code}</TableCell>
                      <TableCell>
                        <Badge variant={op.active ? 'default' : 'secondary'}>
                          {op.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleOperator(op.id)}>
                          {op.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      )}

      {/* ── Reasons ── */}
      {activeTab === 'reasons' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4" /> Razones ({reasons.length})
              </CardTitle>
              <CardDescription>Catálogo de razones para ajustes, bloqueos, devoluciones y bajas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reasons.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CONTEXT_LABELS[r.context] ?? r.context}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.active ? 'default' : 'secondary'}>
                          {r.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleReason(r.id)}>
                          {r.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      )}

      {/* ── Carriers ── */}
      {activeTab === 'carriers' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Truck className="size-4" /> Transportistas ({carriers.length})
              </CardTitle>
              <CardDescription>Carriers y niveles de servicio configurados.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transportista</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Zonas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.services.length} servicio{c.services.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.zones.length} zona{c.zones.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.active ? 'default' : 'secondary'}>
                          {c.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleCarrier(c.id)}>
                          {c.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      )}

      {/* ── Inventory Control ── */}
      {activeTab === 'inventory-control' && (
        <div className="space-y-4">

          {/* IRA KPI + Freeze toggle */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className={cn('border-2', accuracy.ira >= 95 ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40' : accuracy.ira >= 80 ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40' : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40')}>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IRA — Exactitud de inventario</p>
                <p className={cn('mt-1 text-4xl font-bold tabular-nums', accuracy.ira >= 95 ? 'text-emerald-700 dark:text-emerald-300' : accuracy.ira >= 80 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300')}>
                  {accuracy.ira}%
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {accuracy.totalDeviation} uds de desviación en {accuracy.adjustmentsApproved} conteos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start gap-4 pt-5">
                <Snowflake className={cn('mt-0.5 size-8 shrink-0', settings.inventoryFreezeActive ? 'text-blue-500' : 'text-zinc-300')} />
                <div className="flex-1">
                  <p className="font-medium text-sm">Modo congelado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bloquea ajustes, bloqueos y liberaciones de stock.</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={settings.inventoryFreezeActive}
                      onCheckedChange={handleToggleFreeze}
                    />
                    <span className="text-sm">{settings.inventoryFreezeActive ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ajustes pendientes</p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">{accuracy.adjustmentsPending}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {accuracy.adjustmentsApproved} aprobados · {accuracy.adjustmentsRejected} rechazados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Adjustment requests table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="size-4" />
                Solicitudes de ajuste de inventario
              </CardTitle>
              <CardDescription>
                Ajustes con delta &gt; umbral de aprobación ({settings.adjustmentApprovalThreshold} uds) que requieren revisión del supervisor.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {adjustmentRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="size-8 text-zinc-300" />
                  <p className="text-sm text-muted-foreground">Sin solicitudes de ajuste registradas.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentRequests.map((req) => {
                      const product = products.find((p) => p.id === req.productId)
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="max-w-40 truncate text-sm font-medium">
                            {product?.name ?? req.productId}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{req.currentQty}</TableCell>
                          <TableCell className="text-right tabular-nums">{req.countedQty}</TableCell>
                          <TableCell className={cn('text-right tabular-nums font-semibold', req.delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {req.delta > 0 ? '+' : ''}{req.delta}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{req.operatorName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', req.status === 'pending_approval' ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : req.status === 'approved' ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-300')}
                            >
                              {req.status === 'pending_approval' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {req.status === 'pending_approval' && (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700" onClick={() => approveAdjustment(req.id, 'Supervisor')}>
                                  <CheckCircle2 className="size-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleOpenReject(req.id)}>
                                  <XCircle className="size-4" />
                                </Button>
                              </div>
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
      )}

      {/* ── Cyclic Counts ── */}
      {activeTab === 'cyclic-counts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCountFormOpen(true)}>
              <CalendarClock className="mr-1.5 size-4" /> Nuevo plan de conteo
            </Button>
          </div>

          {cyclicCountPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarClock className="size-10 text-zinc-300" />
                <p className="text-sm font-medium">Sin planes de conteo cíclico</p>
                <p className="text-xs text-muted-foreground">Crea un plan para programar conteos de inventario por zona, clase ABC o rotación.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4" /> Planes de conteo ({cyclicCountPlans.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Filtro</TableHead>
                      <TableHead className="text-right">Ubicaciones</TableHead>
                      <TableHead>Fecha programada</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cyclicCountPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-mono text-xs font-semibold">{plan.code}</TableCell>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{COUNT_METHOD_LABELS[plan.method]}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{plan.filterValue}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {plan.countedLocations}/{plan.totalLocations}
                        </TableCell>
                        <TableCell className="text-sm">{plan.scheduledDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', COUNT_STATUS_COLORS[plan.status])}>
                            {plan.status === 'pending' ? 'Pendiente' : plan.status === 'in_progress' ? 'En progreso' : plan.status === 'completed' ? 'Completado' : 'Cancelado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {plan.status === 'pending' && (
                              <Button variant="ghost" size="sm" onClick={() => startCyclicCount(plan.id)}>
                                Iniciar
                              </Button>
                            )}
                            {plan.status === 'in_progress' && (
                              <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => completeCyclicCount(plan.id)}>
                                Completar
                              </Button>
                            )}
                            {(plan.status === 'pending' || plan.status === 'in_progress') && (
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => cancelCyclicCount(plan.id)}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Units of Measure ── */}
      {activeTab === 'uom' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Ruler className="size-4" /> Unidades de medida ({unitsOfMeasure.length})
                  </CardTitle>
                  <CardDescription>
                    Definición de UM base y reglas de conversión. Las cantidades en stock siempre se almacenan en la UM base del producto.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenUomCreate}>
                  + Nueva UM
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Abreviatura</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitsOfMeasure.map((uom) => (
                    <TableRow key={uom.id}>
                      <TableCell className="font-mono font-semibold">{uom.code}</TableCell>
                      <TableCell>{uom.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{uom.abbreviation}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            uom.active
                              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-300'
                          )}
                        >
                          {uom.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenUomEdit(uom)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn('h-7 px-2 text-xs', uom.active ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-800')}
                            onClick={() => toggleUom(uom.id)}
                          >
                            {uom.active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* UoM create / edit dialog */}
          <Dialog open={uomFormOpen} onOpenChange={(o) => { if (!o) setUomFormOpen(false) }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ruler className="size-4 text-blue-600" />
                  {uomEditId ? 'Editar unidad de medida' : 'Nueva unidad de medida'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {uomEditId ? 'Editar unidad de medida existente' : 'Crear nueva unidad de medida'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label htmlFor="uom-code">Código <span className="text-destructive">*</span></Label>
                  <Input
                    id="uom-code"
                    placeholder="Ej: CAJ12"
                    value={uomForm.code}
                    onChange={(e) => setUomForm((p) => ({ ...p, code: e.target.value }))}
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uom-name">Nombre <span className="text-destructive">*</span></Label>
                  <Input
                    id="uom-name"
                    placeholder="Ej: Caja x12"
                    value={uomForm.name}
                    onChange={(e) => setUomForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uom-abbr">Abreviatura <span className="text-destructive">*</span></Label>
                  <Input
                    id="uom-abbr"
                    placeholder="Ej: caj×12"
                    value={uomForm.abbreviation}
                    onChange={(e) => setUomForm((p) => ({ ...p, abbreviation: e.target.value }))}
                    className="font-mono"
                  />
                </div>
                {uomFormError && (
                  <p className="flex items-center gap-1 text-sm text-destructive">
                    <AlertTriangle className="size-3" /> {uomFormError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUomFormOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveUom}>
                  {uomEditId ? 'Guardar cambios' : 'Crear UM'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── Products ── */}
      {activeTab === 'products' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="size-4" /> Productos ({products.length})
              </CardTitle>
              <CardDescription>Estrategia de rotación y límites de stock por SKU.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rotación</TableHead>
                    <TableHead className="text-right">Stock mín.</TableHead>
                    <TableHead className="text-right">Stock máx.</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-semibold">{p.sku}</TableCell>
                      <TableCell className="max-w-48 truncate font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.rotationStrategy ? ROTATION_LABELS[p.rotationStrategy] : <span className="text-zinc-400">Auto</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {p.minStockUnits ?? <span className="text-zinc-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {p.maxStockUnits ?? <span className="text-zinc-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleOpenProductEdit(p)}>
                          <Pencil className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Product edit dialog */}
          <Dialog open={productEditOpen} onOpenChange={(o) => { if (!o) setProductEditOpen(false) }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="size-4 text-blue-600" />
                  Editar parámetros de producto
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Editar estrategia de rotación y límites de stock del producto
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label>Estrategia de rotación</Label>
                  <Select
                    value={productForm.rotationStrategy ?? ''}
                    onValueChange={(v) => setProductForm((f) => ({ ...f, rotationStrategy: (v || undefined) as Product['rotationStrategy'] }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auto (sin estrategia explícita)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fefo">FEFO — Primero en vencer, primero en salir</SelectItem>
                      <SelectItem value="fifo">FIFO — Primero en entrar, primero en salir</SelectItem>
                      <SelectItem value="lifo">LIFO — Último en entrar, primero en salir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="min-stock">Stock mínimo (uds)</Label>
                    <Input
                      id="min-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.minStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, minStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-stock">Stock máximo (uds)</Label>
                    <Input
                      id="max-stock"
                      type="number"
                      min={0}
                      placeholder="Auto"
                      value={productForm.maxStockUnits}
                      onChange={(e) => setProductForm((f) => ({ ...f, maxStockUnits: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProductEditOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveProduct}>Guardar cambios</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── Settings ── */}
      {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Settings className="size-4" /> Parámetros del sistema
                  </CardTitle>
                  <CardDescription>Umbrales para clasificación ABC/XYZ, reabastecimiento y control de inventario.</CardDescription>
                </div>
                <Button size="sm" disabled={!settingsChanged} onClick={handleSaveSettings}>
                  Guardar cambios
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">Clasificación ABC</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Umbral clase A" description="% acumulado de pickeos que define la clase A (ej. 0.80 = 80%)." value={localSettings.abcThresholdA} min={0.5} max={0.95} step={0.05} onChange={(v) => handleSettingChange('abcThresholdA', v)} />
                  <SettingField label="Umbral clase B" description="% acumulado que separa B de C (debe ser > umbral A)." value={localSettings.abcThresholdB} min={0.6} max={0.99} step={0.05} onChange={(v) => handleSettingChange('abcThresholdB', v)} />
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">Clasificación XYZ</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="CV límite X/Y" description="Coeficiente de variación máximo para clase X (demanda estable)." value={localSettings.xyzCvX} min={0.1} max={0.8} step={0.1} onChange={(v) => handleSettingChange('xyzCvX', v)} />
                  <SettingField label="CV límite Y/Z" description="Coeficiente de variación máximo para clase Y (demanda media)." value={localSettings.xyzCvY} min={0.5} max={2.0} step={0.1} onChange={(v) => handleSettingChange('xyzCvY', v)} />
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">Reabastecimiento</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Factor prioridad alta" description="Si stock < minStock × factor → prioridad alta. Ej. 0.5 = por debajo del 50% del mínimo." value={localSettings.replenishmentHighFactor} min={0.1} max={0.9} step={0.1} onChange={(v) => handleSettingChange('replenishmentHighFactor', v)} />
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">Control de inventario</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Umbral aprobación ajuste (uds)" description="Delta absoluto en unidades por encima del cual el ajuste requiere aprobación de supervisor." value={localSettings.adjustmentApprovalThreshold} min={1} max={500} step={1} onChange={(v) => handleSettingChange('adjustmentApprovalThreshold', v)} />
                </div>
              </div>
            </CardContent>
          </Card>
      )}

      {activeTab === 'almacenes' && (
        <Card>
          <CardHeader>
            <CardTitle>Almacenes y ventanas de entrega</CardTitle>
            <CardDescription>
              Configura las ventanas horarias de recepción por tienda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ventanas</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-mono text-sm">{wh.code}</TableCell>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell>{wh.city}</TableCell>
                    <TableCell>
                      <Badge variant={wh.type === 'distribution_center' ? 'default' : 'secondary'}>
                        {wh.type === 'distribution_center' ? 'CD' : 'Tienda'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {wh.deliveryWindows?.length ? (
                        <span className="text-sm">{wh.deliveryWindows.length} ventanas</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin ventanas</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleOpenWarehouse(wh)}
                      >
                        <Pencil className="mr-1 size-3" /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delivery windows editor dialog */}
      <Dialog open={!!editingWarehouseId} onOpenChange={(o) => !o && setEditingWarehouseId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Ventanas de entrega — {warehouses.find((w) => w.id === editingWarehouseId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {windowsForm.map((win, idx) => (
              <div key={`${win.dayOfWeek}-${win.openTime}-${idx}`} className="flex items-center gap-2">
                <Select
                  value={String(win.dayOfWeek)}
                  onValueChange={(v) =>
                    setWindowsForm((prev) =>
                      prev.map((w, i) => (i === idx ? { ...w, dayOfWeek: Number(v) as DeliveryWindow['dayOfWeek'] } : w))
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 w-24"
                  type="time"
                  value={win.openTime}
                  onChange={(e) =>
                    setWindowsForm((prev) =>
                      prev.map((w, i) => (i === idx ? { ...w, openTime: e.target.value } : w))
                    )
                  }
                />
                <span className="text-muted-foreground text-sm">–</span>
                <Input
                  className="h-8 w-24"
                  type="time"
                  value={win.closeTime}
                  onChange={(e) =>
                    setWindowsForm((prev) =>
                      prev.map((w, i) => (i === idx ? { ...w, closeTime: e.target.value } : w))
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveWindow(idx)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddWindow}>
              + Agregar ventana
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWarehouseId(null)}>Cancelar</Button>
            <Button onClick={handleSaveWindows}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-red-500" /> Resetear datos de demostración
            </DialogTitle>
            <DialogDescription>
              Esta acción borrará todo el estado guardado en localStorage y recargará el sistema con los datos de demo originales. Todos los cambios realizados en esta sesión se perderán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={resetStore}>Sí, resetear demo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject adjustment dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar ajuste</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo. El operador verá esta nota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="reject-note">Motivo de rechazo *</Label>
            <Input id="reject-note" placeholder="Ej: Diferencia fuera de rango aceptable…" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectNote.trim()} onClick={handleConfirmReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create cyclic count dialog */}
      <Dialog open={countFormOpen} onOpenChange={setCountFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" /> Nuevo plan de conteo cíclico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cc-name">Nombre *</Label>
              <Input id="cc-name" placeholder="Ej: Conteo zona A — junio" value={countForm.name} onChange={(e) => setCountForm({ ...countForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={countForm.method} onValueChange={(v) => setCountForm({ ...countForm, method: v as CyclicCountMethod })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="by_zone">Por zona</SelectItem>
                    <SelectItem value="by_abc">Por clase ABC</SelectItem>
                    <SelectItem value="by_rotation">Por rotación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cc-filter">Valor de filtro *</Label>
                <Input id="cc-filter" placeholder={countForm.method === 'by_zone' ? 'Ej: A, B, QC…' : countForm.method === 'by_abc' ? 'Ej: A, B, C' : 'Ej: alta'} value={countForm.filterValue} onChange={(e) => setCountForm({ ...countForm, filterValue: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Almacén</Label>
                <Select value={countForm.warehouseId} onValueChange={(v) => setCountForm({ ...countForm, warehouseId: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cc-date">Fecha programada *</Label>
                <Input id="cc-date" type="date" value={countForm.scheduledDate} onChange={(e) => setCountForm({ ...countForm, scheduledDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-operator">Operador asignado</Label>
              <Input id="cc-operator" placeholder="Nombre del operador (opcional)" value={countForm.assignedOperatorName} onChange={(e) => setCountForm({ ...countForm, assignedOperatorName: e.target.value })} />
            </div>
            {countFormError && <p className="text-destructive text-sm">{countFormError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCountFormOpen(false); setCountFormError('') }}>Cancelar</Button>
            <Button onClick={handleCreateCount}>Crear plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SettingFieldProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

const SettingField = ({ label, description, value, min, max, step, onChange }: SettingFieldProps) => (
  <div className="flex flex-col gap-1.5 rounded-lg border dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 p-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">{label}</p>
      <span className="rounded bg-white dark:bg-zinc-800 px-2 py-0.5 text-sm font-bold tabular-nums shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
        {value % 1 === 0 ? value : value.toFixed(2)}
      </span>
    </div>
    <p className="text-muted-foreground text-xs">{description}</p>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-zinc-800" />
    <div className="flex justify-between text-xs text-zinc-400">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
)

export default AdminPage
