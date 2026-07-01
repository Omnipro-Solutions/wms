import type { OperatorRole } from '@/lib/worker-routes'
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardList,
  Grid3x3,
  Layers,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  Settings2,
  ShoppingCart,
  ScanLine,
  Tags,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

export type NavBadge = 'new' | 'soon'

export interface NavSubItem {
  id: string
  title: string
  url: string
  icon?: LucideIcon
  badge?: NavBadge
  disabled?: boolean
  newTab?: boolean
}

interface NavItemBase {
  id: string
  title: string
  icon?: LucideIcon
  badge?: NavBadge
  disabled?: boolean
  newTab?: boolean
  allowedRoles?: OperatorRole[]
}

export interface NavMainLinkItem extends NavItemBase {
  url: string
  subItems?: never
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[]
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem

export interface NavGroup {
  id: number
  label?: string
  items: NavMainItem[]
}

export const sidebarItems: NavGroup[] = [
  {
    id: 0,
    label: 'Dashboard',
    items: [{ id: 'dashboard', title: 'Operación', url: '/', icon: BarChart3, allowedRoles: ['supervisor'] }],
  },
  {
    id: 1,
    label: 'Entrada',
    items: [
      { id: 'receiving', title: 'Recepción', url: '/receiving', icon: PackageCheck, allowedRoles: ['receiver', 'supervisor'] },
      { id: 'inventory', title: 'Inventario', url: '/inventory', icon: Boxes, allowedRoles: ['receiver', 'supervisor'] },
      { id: 'lot-trace', title: 'Trazabilidad lotes', url: '/inventory/lot-trace', icon: Layers, allowedRoles: ['supervisor'] },
      { id: 'serial-trace', title: 'Trazabilidad N/S', url: '/serial-trace', icon: ScanLine, allowedRoles: ['supervisor'] },
      { id: 'locations', title: 'Ubicaciones', url: '/locations', icon: MapPinned, allowedRoles: ['supervisor'] },
      { id: 'slotting', title: 'Slotting', url: '/slotting', icon: Grid3x3, allowedRoles: ['supervisor'] },
    ],
  },
  {
    id: 2,
    label: 'Operación',
    items: [
      { id: 'transfers', title: 'Traslados', url: '/transfers', icon: ArrowRightLeft, allowedRoles: ['supervisor'] },
      { id: 'returns', title: 'Devoluciones', url: '/returns', icon: Undo2, allowedRoles: ['receiver', 'supervisor'] },
      { id: 'commerce', title: 'Commerce', url: '/commerce', icon: ShoppingCart, allowedRoles: ['supervisor'] },
      { id: 'picking', title: 'Picking', url: '/picking', icon: ClipboardList, allowedRoles: ['supervisor'] },
      { id: 'packing', title: 'Packing', url: '/packing', icon: Package, allowedRoles: ['supervisor'] },
      { id: 'labels', title: 'Etiquetas', url: '/labels', icon: Tags, allowedRoles: ['supervisor'] },
    ],
  },
  {
    id: 3,
    label: 'Despacho',
    items: [
      { id: 'shipping', title: 'Shipping', url: '/shipping', icon: Truck, allowedRoles: ['driver', 'supervisor'] },
      { id: 'load-manifests', title: 'Manifiestos', url: '/load-manifests', icon: Route, allowedRoles: ['driver', 'supervisor'] },
    ],
  },
  {
    id: 4,
    label: 'Sistema',
    items: [
      // { id: 'reports', title: 'Reportes', url: '/reports', icon: BarChart3 },
      { id: 'integrations', title: 'Integraciones', url: '/integrations', icon: Cable, allowedRoles: ['supervisor'] },
      { id: 'admin', title: 'Administración', url: '/admin', icon: Settings2, allowedRoles: ['supervisor'] },
    ],
  },
]
