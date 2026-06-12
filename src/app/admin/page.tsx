'use client'

import {
  CheckCircle2,
  Edit2,
  MapPin,
  Package,
  Plus,
  Settings,
  Tag,
  ToggleLeft,
  ToggleRight,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  Carrier,
  Operator,
  Product,
  Reason,
  StorageLocation,
  WmsSettings,
  Warehouse as WarehouseType,
} from '@/types/wms'

// ─── Label maps ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Operator['role'], string> = {
  picker: 'Picker',
  packer: 'Packer',
  receiver: 'Receptor',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

const CONTEXT_LABELS: Record<Reason['context'], string> = {
  return: 'Devolución',
  partial_picking: 'Picking parcial',
  adjustment: 'Ajuste',
  scrap: 'Desecho',
  hold: 'Retención',
}

const WH_TYPE_LABELS: Record<WarehouseType['type'], string> = {
  distribution_center: 'Centro de distribución',
  store: 'Tienda',
}

const LOC_TYPE_LABELS: Record<StorageLocation['type'], string> = {
  pick: 'Pick',
  reserve: 'Reserva',
  quality_control: 'Control calidad',
  staging: 'Staging',
  returns: 'Devoluciones',
}

const TRACK_LABELS: Record<Product['trackBy'], string> = {
  none: 'Ninguno',
  lot: 'Lote',
  serial: 'Serie',
}

// ─── Form interfaces ───────────────────────────────────────────────────────────

interface OperatorForm {
  id?: string
  code: string
  name: string
  role: Operator['role']
  active: boolean
}
interface ReasonForm {
  id?: string
  code: string
  label: string
  context: Reason['context']
  active: boolean
}
interface CarrierForm {
  id?: string
  code: string
  name: string
  active: boolean
}
interface WarehouseForm {
  id?: string
  code: string
  name: string
  city: string
  type: WarehouseType['type']
}
interface LocationForm {
  id?: string
  code: string
  warehouseId: string
  zone: string
  type: StorageLocation['type']
  isPickFace: boolean
  golden: boolean
  accessibilityScore: number
  maxWeightKg: number
  volumeCapacityM3: number
  distanceToDispatchM: number
}
interface ProductForm {
  id?: string
  sku: string
  name: string
  category: string
  barcode: string
  unitWeightKg: number
  unitVolumeM3: number
  trackBy: Product['trackBy']
}

const DEFAULT_OP: OperatorForm = { code: '', name: '', role: 'picker', active: true }
const DEFAULT_RS: ReasonForm = { code: '', label: '', context: 'return', active: true }
const DEFAULT_CA: CarrierForm = { code: '', name: '', active: true }
const DEFAULT_WH: WarehouseForm = { code: '', name: '', city: '', type: 'distribution_center' }
const DEFAULT_LOC: LocationForm = {
  code: '',
  warehouseId: '',
  zone: '',
  type: 'pick',
  isPickFace: false,
  golden: false,
  accessibilityScore: 50,
  maxWeightKg: 30,
  volumeCapacityM3: 2,
  distanceToDispatchM: 20,
}
const DEFAULT_PROD: ProductForm = {
  sku: '',
  name: '',
  category: '',
  barcode: '',
  unitWeightKg: 0,
  unitVolumeM3: 0,
  trackBy: 'none',
}

export default function AdminPage() {
  const state = useWmsStore()
  const {
    createOperator,
    updateOperator,
    toggleOperator,
    createReason,
    updateReason,
    toggleReason,
    createCarrier,
    updateCarrier,
    toggleCarrier,
    createWarehouse,
    updateWarehouse,
    createLocation,
    updateLocation,
    createProduct,
    updateProduct,
    updateSettings,
  } = useWmsStore()

  // ── Operators ──────────────────────────────────────────────────────────────
  const opDialog = useDialogState<OperatorForm>()
  const [opForm, setOpForm] = useState<OperatorForm>(DEFAULT_OP)
  const openOpCreate = () => {
    setOpForm(DEFAULT_OP)
    opDialog.open(DEFAULT_OP)
  }
  const openOpEdit = (op: Operator) => {
    const f = { id: op.id, code: op.code, name: op.name, role: op.role, active: op.active }
    setOpForm(f)
    opDialog.open(f)
  }
  const handleSaveOp = () => {
    try {
      if (opForm.id)
        updateOperator(opForm.id, { code: opForm.code, name: opForm.name, role: opForm.role })
      else createOperator({ code: opForm.code, name: opForm.name, role: opForm.role, active: true })
      opDialog.close()
    } catch (e: unknown) {
      opDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Reasons ────────────────────────────────────────────────────────────────
  const rsDialog = useDialogState<ReasonForm>()
  const [rsForm, setRsForm] = useState<ReasonForm>(DEFAULT_RS)
  const openRsCreate = () => {
    setRsForm(DEFAULT_RS)
    rsDialog.open(DEFAULT_RS)
  }
  const openRsEdit = (r: Reason) => {
    const f = { id: r.id, code: r.code, label: r.label, context: r.context, active: r.active }
    setRsForm(f)
    rsDialog.open(f)
  }
  const handleSaveRs = () => {
    try {
      if (rsForm.id)
        updateReason(rsForm.id, { code: rsForm.code, label: rsForm.label, context: rsForm.context })
      else
        createReason({
          code: rsForm.code,
          label: rsForm.label,
          context: rsForm.context,
          active: true,
        })
      rsDialog.close()
    } catch (e: unknown) {
      rsDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Carriers ───────────────────────────────────────────────────────────────
  const caDialog = useDialogState<CarrierForm>()
  const [caForm, setCaForm] = useState<CarrierForm>(DEFAULT_CA)
  const openCaCreate = () => {
    setCaForm(DEFAULT_CA)
    caDialog.open(DEFAULT_CA)
  }
  const openCaEdit = (c: Carrier) => {
    const f = { id: c.id, code: c.code, name: c.name, active: c.active }
    setCaForm(f)
    caDialog.open(f)
  }
  const handleSaveCa = () => {
    try {
      if (caForm.id) updateCarrier(caForm.id, { code: caForm.code, name: caForm.name })
      else createCarrier({ code: caForm.code, name: caForm.name, active: true })
      caDialog.close()
    } catch (e: unknown) {
      caDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Warehouses ─────────────────────────────────────────────────────────────
  const whDialog = useDialogState<WarehouseForm>()
  const [whForm, setWhForm] = useState<WarehouseForm>(DEFAULT_WH)
  const openWhCreate = () => {
    setWhForm(DEFAULT_WH)
    whDialog.open(DEFAULT_WH)
  }
  const openWhEdit = (w: WarehouseType) => {
    const f = { id: w.id, code: w.code, name: w.name, city: w.city, type: w.type }
    setWhForm(f)
    whDialog.open(f)
  }
  const handleSaveWh = () => {
    try {
      if (whForm.id)
        updateWarehouse(whForm.id, {
          code: whForm.code,
          name: whForm.name,
          city: whForm.city,
          type: whForm.type,
        })
      else
        createWarehouse({
          code: whForm.code,
          name: whForm.name,
          city: whForm.city,
          type: whForm.type,
        })
      whDialog.close()
    } catch (e: unknown) {
      whDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Locations ──────────────────────────────────────────────────────────────
  const locDialog = useDialogState<LocationForm>()
  const [locForm, setLocForm] = useState<LocationForm>(DEFAULT_LOC)
  const openLocCreate = () => {
    setLocForm(DEFAULT_LOC)
    locDialog.open(DEFAULT_LOC)
  }
  const openLocEdit = (l: StorageLocation) => {
    const f: LocationForm = {
      id: l.id,
      code: l.code,
      warehouseId: l.warehouseId,
      zone: l.zone,
      type: l.type,
      isPickFace: l.isPickFace,
      golden: l.golden,
      accessibilityScore: l.accessibilityScore,
      maxWeightKg: l.maxWeightKg,
      volumeCapacityM3: l.volumeCapacityM3,
      distanceToDispatchM: l.distanceToDispatchM,
    }
    setLocForm(f)
    locDialog.open(f)
  }
  const handleSaveLoc = () => {
    try {
      const payload: Omit<StorageLocation, 'id'> = {
        code: locForm.code,
        warehouseId: locForm.warehouseId,
        zone: locForm.zone,
        type: locForm.type,
        isPickFace: locForm.isPickFace,
        golden: locForm.golden,
        accessibilityScore: locForm.accessibilityScore,
        maxWeightKg: locForm.maxWeightKg,
        volumeCapacityM3: locForm.volumeCapacityM3,
        distanceToDispatchM: locForm.distanceToDispatchM,
      }
      if (locForm.id) updateLocation(locForm.id, payload)
      else createLocation(payload)
      locDialog.close()
    } catch (e: unknown) {
      locDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Products ───────────────────────────────────────────────────────────────
  const prodDialog = useDialogState<ProductForm>()
  const [prodForm, setProdForm] = useState<ProductForm>(DEFAULT_PROD)
  const openProdCreate = () => {
    setProdForm(DEFAULT_PROD)
    prodDialog.open(DEFAULT_PROD)
  }
  const openProdEdit = (p: Product) => {
    const f: ProductForm = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      barcode: p.barcode,
      unitWeightKg: p.unitWeightKg,
      unitVolumeM3: p.unitVolumeM3,
      trackBy: p.trackBy,
    }
    setProdForm(f)
    prodDialog.open(f)
  }
  const handleSaveProd = () => {
    try {
      const payload: Omit<Product, 'id'> = {
        sku: prodForm.sku,
        name: prodForm.name,
        category: prodForm.category,
        barcode: prodForm.barcode,
        unitWeightKg: prodForm.unitWeightKg,
        unitVolumeM3: prodForm.unitVolumeM3,
        trackBy: prodForm.trackBy,
      }
      if (prodForm.id) updateProduct(prodForm.id, payload)
      else createProduct(payload)
      prodDialog.close()
    } catch (e: unknown) {
      prodDialog.setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState<WmsSettings>({ ...state.settings })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const handleSaveSettings = () => {
    updateSettings(settingsForm)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  return (
    <>
      <PageHeader
        title="Administración"
        description="Gestión de operadores, motivos, transportadoras, bodegas, ubicaciones, productos y configuración del sistema."
      />

      <Tabs defaultValue="operators">
        <TabsList className="mb-4 h-auto flex-wrap gap-1">
          <TabsTrigger value="operators">
            <Users className="mr-1 size-3" /> Operadores
          </TabsTrigger>
          <TabsTrigger value="reasons">
            <Tag className="mr-1 size-3" /> Motivos
          </TabsTrigger>
          <TabsTrigger value="carriers">
            <Truck className="mr-1 size-3" /> Transportadoras
          </TabsTrigger>
          <TabsTrigger value="warehouses">
            <Warehouse className="mr-1 size-3" /> Bodegas
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="mr-1 size-3" /> Ubicaciones
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="mr-1 size-3" /> Productos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1 size-3" /> Configuración
          </TabsTrigger>
        </TabsList>

        {/* ─── Operators ─────────────────────────────────────────────────────── */}
        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4" /> Operadores ({state.operators.length})
                </CardTitle>
                <Button size="sm" onClick={openOpCreate}>
                  <Plus className="mr-1 size-3" /> Nuevo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.operators.map((op) => (
                    <TableRow key={op.id} className={!op.active ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{op.code}</TableCell>
                      <TableCell className="font-medium">{op.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[op.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={op.active ? 'default' : 'secondary'} className="text-xs">
                          {op.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openOpEdit(op)}>
                            <Edit2 className="size-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleOperator(op.id)}>
                            {op.active ? (
                              <ToggleRight className="size-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="text-muted-foreground size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reasons ───────────────────────────────────────────────────────── */}
        <TabsContent value="reasons">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="size-4" /> Motivos ({state.reasons.length})
                </CardTitle>
                <Button size="sm" onClick={openRsCreate}>
                  <Plus className="mr-1 size-3" /> Nuevo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.reasons.map((r) => (
                    <TableRow key={r.id} className={!r.active ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CONTEXT_LABELS[r.context]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.active ? 'default' : 'secondary'} className="text-xs">
                          {r.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openRsEdit(r)}>
                            <Edit2 className="size-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleReason(r.id)}>
                            {r.active ? (
                              <ToggleRight className="size-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="text-muted-foreground size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Carriers ──────────────────────────────────────────────────────── */}
        <TabsContent value="carriers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="size-4" /> Transportadoras ({state.carriers.length})
                </CardTitle>
                <Button size="sm" onClick={openCaCreate}>
                  <Plus className="mr-1 size-3" /> Nueva
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.carriers.map((c) => (
                    <TableRow key={c.id} className={!c.active ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{c.code}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={c.active ? 'default' : 'secondary'} className="text-xs">
                          {c.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openCaEdit(c)}>
                            <Edit2 className="size-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleCarrier(c.id)}>
                            {c.active ? (
                              <ToggleRight className="size-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="text-muted-foreground size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Warehouses ────────────────────────────────────────────────────── */}
        <TabsContent value="warehouses">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Warehouse className="size-4" /> Bodegas ({state.warehouses.length})
                </CardTitle>
                <Button size="sm" onClick={openWhCreate}>
                  <Plus className="mr-1 size-3" /> Nueva
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ubicaciones</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.warehouses.map((w) => {
                    const locCount = state.locations.filter((l) => l.warehouseId === w.id).length
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-sm font-medium">{w.code}</TableCell>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-sm">{w.city}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {WH_TYPE_LABELS[w.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm tabular-nums">
                          {locCount}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openWhEdit(w)}>
                            <Edit2 className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Locations ─────────────────────────────────────────────────────── */}
        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4" /> Ubicaciones ({state.locations.length})
                </CardTitle>
                <Button size="sm" onClick={openLocCreate}>
                  <Plus className="mr-1 size-3" /> Nueva
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Bodega</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pick face</TableHead>
                    <TableHead>Golden</TableHead>
                    <TableHead className="text-right">Accesibilidad</TableHead>
                    <TableHead className="text-right">Max (kg)</TableHead>
                    <TableHead className="text-right">Dist. despacho (m)</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.locations.map((l) => {
                    const wh = state.warehouses.find((w) => w.id === l.warehouseId)
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-sm font-medium">{l.code}</TableCell>
                        <TableCell className="text-sm">{wh?.code ?? l.warehouseId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {l.zone}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {LOC_TYPE_LABELS[l.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {l.isPickFace ? (
                            <CheckCircle2 className="mx-auto size-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {l.golden ? (
                            <CheckCircle2 className="mx-auto size-4 text-amber-500" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.accessibilityScore}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.maxWeightKg}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.distanceToDispatchM}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openLocEdit(l)}>
                            <Edit2 className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Products ──────────────────────────────────────────────────────── */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4" /> Productos ({state.products.length})
                </CardTitle>
                <Button size="sm" onClick={openProdCreate}>
                  <Plus className="mr-1 size-3" /> Nuevo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Código barras</TableHead>
                    <TableHead className="text-right">Peso (kg)</TableHead>
                    <TableHead className="text-right">Volumen (m³)</TableHead>
                    <TableHead>Trazabilidad</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm font-medium">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {p.barcode}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.unitWeightKg}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.unitVolumeM3}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TRACK_LABELS[p.trackBy]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openProdEdit(p)}>
                          <Edit2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Settings ──────────────────────────────────────────────────────── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="size-4" /> Configuración del sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="max-w-lg space-y-6">
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Clasificación ABC
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="abcA">Umbral clase A (acumulado)</Label>
                    <Input
                      id="abcA"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={settingsForm.abcThresholdA}
                      onChange={(e) =>
                        setSettingsForm((f) => ({
                          ...f,
                          abcThresholdA: parseFloat(e.target.value),
                        }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">Ej: 0.8 = top 80% de ventas</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abcB">Umbral clase B (acumulado)</Label>
                    <Input
                      id="abcB"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={settingsForm.abcThresholdB}
                      onChange={(e) =>
                        setSettingsForm((f) => ({
                          ...f,
                          abcThresholdB: parseFloat(e.target.value),
                        }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">Ej: 0.95 = top 95% de ventas</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Clasificación XYZ
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="xyzX">CV máximo clase X</Label>
                    <Input
                      id="xyzX"
                      type="number"
                      step="0.01"
                      min="0"
                      value={settingsForm.xyzCvX}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, xyzCvX: parseFloat(e.target.value) }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">Coef. variación demanda estable</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="xyzY">CV máximo clase Y</Label>
                    <Input
                      id="xyzY"
                      type="number"
                      step="0.01"
                      min="0"
                      value={settingsForm.xyzCvY}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, xyzCvY: parseFloat(e.target.value) }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">Sobre este valor → clase Z</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Reposición
                </p>
                <div className="max-w-xs space-y-1">
                  <Label htmlFor="repHigh">Factor prioridad alta</Label>
                  <Input
                    id="repHigh"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settingsForm.replenishmentHighFactor}
                    onChange={(e) =>
                      setSettingsForm((f) => ({
                        ...f,
                        replenishmentHighFactor: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Stock &lt; factor × mínimo → prioridad alta
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Sistema
                </p>
                <div className="max-w-xs space-y-1">
                  <Label htmlFor="latency">Latencia simulada (ms)</Label>
                  <Input
                    id="latency"
                    type="number"
                    step="10"
                    min="0"
                    value={settingsForm.simulatedLatencyMs}
                    onChange={(e) =>
                      setSettingsForm((f) => ({
                        ...f,
                        simulatedLatencyMs: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveSettings}>
                  <CheckCircle2 className="mr-1 size-4" /> Guardar configuración
                </Button>
                {settingsSaved && (
                  <p className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircle2 className="size-3" /> Guardado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Operator dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!opDialog.data}
        onOpenChange={(o) => {
          if (!o) opDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opForm.id ? 'Editar operador' : 'Nuevo operador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input
                  value={opForm.code}
                  onChange={(e) => setOpForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="OP-006"
                />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <Select
                  value={opForm.role}
                  onValueChange={(v) => setOpForm((f) => ({ ...f, role: v as Operator['role'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre completo</Label>
              <Input
                value={opForm.name}
                onChange={(e) => setOpForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Juan Pérez"
              />
            </div>
            {opDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {opDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={opDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOp} disabled={!opForm.code || !opForm.name}>
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reason dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!rsDialog.data}
        onOpenChange={(o) => {
          if (!o) rsDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rsForm.id ? 'Editar motivo' : 'Nuevo motivo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input
                  value={rsForm.code}
                  onChange={(e) => setRsForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="RET-NUEVO"
                />
              </div>
              <div className="space-y-1">
                <Label>Contexto</Label>
                <Select
                  value={rsForm.context}
                  onValueChange={(v) =>
                    setRsForm((f) => ({ ...f, context: v as Reason['context'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTEXT_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Etiqueta (texto UI)</Label>
              <Input
                value={rsForm.label}
                onChange={(e) => setRsForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Descripción del motivo"
              />
            </div>
            {rsDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {rsDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={rsDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRs} disabled={!rsForm.code || !rsForm.label}>
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Carrier dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!caDialog.data}
        onOpenChange={(o) => {
          if (!o) caDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {caForm.id ? 'Editar transportadora' : 'Nueva transportadora'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input
                  value={caForm.code}
                  onChange={(e) => setCaForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="NUEVA"
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={caForm.name}
                  onChange={(e) => setCaForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre transportadora"
                />
              </div>
            </div>
            {caDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {caDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={caDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCa} disabled={!caForm.code || !caForm.name}>
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Warehouse dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!whDialog.data}
        onOpenChange={(o) => {
          if (!o) whDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{whForm.id ? 'Editar bodega' : 'Nueva bodega'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input
                  value={whForm.code}
                  onChange={(e) => setWhForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="CEDI-CAL"
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={whForm.type}
                  onValueChange={(v) =>
                    setWhForm((f) => ({ ...f, type: v as WarehouseType['type'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WH_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={whForm.name}
                onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Centro de Distribución Cali"
              />
            </div>
            <div className="space-y-1">
              <Label>Ciudad</Label>
              <Input
                value={whForm.city}
                onChange={(e) => setWhForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Cali"
              />
            </div>
            {whDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {whDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={whDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSaveWh} disabled={!whForm.code || !whForm.name || !whForm.city}>
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Location dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={!!locDialog.data}
        onOpenChange={(o) => {
          if (!o) locDialog.close()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{locForm.id ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input
                  value={locForm.code}
                  onChange={(e) => setLocForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="C-01-01"
                />
              </div>
              <div className="space-y-1">
                <Label>Zona</Label>
                <Input
                  value={locForm.zone}
                  onChange={(e) => setLocForm((f) => ({ ...f, zone: e.target.value }))}
                  placeholder="C"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Bodega</Label>
                <Select
                  value={locForm.warehouseId}
                  onValueChange={(v) => setLocForm((f) => ({ ...f, warehouseId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={locForm.type}
                  onValueChange={(v) =>
                    setLocForm((f) => ({ ...f, type: v as StorageLocation['type'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOC_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Accesibilidad (0-100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={locForm.accessibilityScore}
                  onChange={(e) =>
                    setLocForm((f) => ({ ...f, accessibilityScore: parseInt(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Max peso (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={locForm.maxWeightKg}
                  onChange={(e) =>
                    setLocForm((f) => ({ ...f, maxWeightKg: parseFloat(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Dist. despacho (m)</Label>
                <Input
                  type="number"
                  min="0"
                  value={locForm.distanceToDispatchM}
                  onChange={(e) =>
                    setLocForm((f) => ({ ...f, distanceToDispatchM: parseFloat(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={locForm.isPickFace}
                  onChange={(e) => setLocForm((f) => ({ ...f, isPickFace: e.target.checked }))}
                />
                Pick face
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={locForm.golden}
                  onChange={(e) => setLocForm((f) => ({ ...f, golden: e.target.checked }))}
                />
                Zona golden
              </label>
            </div>
            {locDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {locDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={locDialog.close}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLoc}
              disabled={!locForm.code || !locForm.warehouseId || !locForm.zone}
            >
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Product dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!prodDialog.data}
        onOpenChange={(o) => {
          if (!o) prodDialog.close()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{prodForm.id ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input
                  value={prodForm.sku}
                  onChange={(e) => setProdForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="TS-BLK-010"
                />
              </div>
              <div className="space-y-1">
                <Label>Código de barras</Label>
                <Input
                  value={prodForm.barcode}
                  onChange={(e) => setProdForm((f) => ({ ...f, barcode: e.target.value }))}
                  placeholder="7700000000099"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={prodForm.name}
                onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Camiseta Básica Blanca"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  value={prodForm.category}
                  onChange={(e) => setProdForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Camisetas"
                />
              </div>
              <div className="space-y-1">
                <Label>Trazabilidad</Label>
                <Select
                  value={prodForm.trackBy}
                  onValueChange={(v) =>
                    setProdForm((f) => ({ ...f, trackBy: v as Product['trackBy'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRACK_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Peso unitario (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={prodForm.unitWeightKg}
                  onChange={(e) =>
                    setProdForm((f) => ({ ...f, unitWeightKg: parseFloat(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Volumen unitario (m³)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={prodForm.unitVolumeM3}
                  onChange={(e) =>
                    setProdForm((f) => ({ ...f, unitVolumeM3: parseFloat(e.target.value) }))
                  }
                />
              </div>
            </div>
            {prodDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {prodDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={prodDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProd} disabled={!prodForm.sku || !prodForm.name}>
              <CheckCircle2 className="mr-1 size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
