import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardCheck,
  ClipboardList,
  Container,
  Grid3x3,
  Layers,
  ListChecks,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  Settings2,
  ShoppingCart,
  ScanLine,
  Shuffle,
  SlidersHorizontal,
  Tags,
  Truck,
  Undo2,
  Users,
  Warehouse,
} from 'lucide-react'
import type { NavGroup } from '@/types/navigation'

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Entrada',
    icon: PackageCheck,
    items: [
      { label: 'Dashboard', href: '/', icon: BarChart3 },
      { label: 'Recepción', href: '/receiving', icon: PackageCheck },
      { label: 'Patio y muelles', href: '/yard', icon: Warehouse },
      { label: 'Unidades de carga', href: '/lpn', icon: Container },
      { label: 'Inventario', href: '/inventory', icon: Boxes },
      { label: 'Trazabilidad lotes', href: '/inventory/lot-trace', icon: Layers },
      { label: 'Trazabilidad N/S', href: '/serial-trace', icon: ScanLine },
      { label: 'Ubicaciones', href: '/locations', icon: MapPinned },
      { label: 'Slotting', href: '/slotting', icon: Grid3x3 },
      { label: 'Conteo cíclico', href: '/cycle-count', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    items: [
      { label: 'Traslados', href: '/transfers', icon: ArrowRightLeft },
      { label: 'Mov. internos', href: '/internal-moves', icon: Shuffle },
      { label: 'Devoluciones', href: '/returns', icon: Undo2 },
      { label: 'Commerce', href: '/commerce', icon: ShoppingCart },
      { label: 'Picking', href: '/picking', icon: ClipboardList },
      { label: 'Packing', href: '/packing', icon: Package },
      { label: 'Etiquetas', href: '/labels', icon: Tags },
      { label: 'Mano de obra', href: '/labor', icon: Users },
    ],
  },
  {
    title: 'Despacho',
    icon: Truck,
    items: [
      { label: 'Shipping', href: '/shipping', icon: Truck },
      { label: 'Manifiestos', href: '/load-manifests', icon: Route },
    ],
  },
  {
    title: 'Sistema',
    icon: BarChart3,
    items: [
      // { label: 'Reportes', href: '/reports', icon: BarChart3 },
      { label: 'Integraciones', href: '/integrations', icon: Cable },
      { label: 'Config. Inventario', href: '/inventory-settings', icon: SlidersHorizontal },
      { label: 'Config. Conteo cíclico', href: '/cycle-count-settings', icon: ClipboardCheck },
      { label: 'Config. Mano de obra', href: '/labor-settings', icon: Users },
      { label: 'Config. Control de calidad', href: '/qc-settings', icon: ClipboardCheck },
      { label: 'Config. Putaway', href: '/putaway-settings', icon: MapPinned },
      { label: 'Config. Patio', href: '/yard-settings', icon: Warehouse },
      { label: 'Administración', href: '/admin', icon: Settings2 },
    ],
  },
]

export const ALERTS_ICON = AlertTriangle
export const TASKS_ICON = ListChecks
