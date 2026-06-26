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
    items: [{ id: 'dashboard', title: 'Operación', url: '/', icon: BarChart3 }],
  },
  {
    id: 1,
    label: 'Entrada',
    items: [
      { id: 'receiving', title: 'Recepción', url: '/receiving', icon: PackageCheck },
      { id: 'inventory', title: 'Inventario', url: '/inventory', icon: Boxes },
      { id: 'lot-trace', title: 'Trazabilidad lotes', url: '/inventory/lot-trace', icon: Layers },
      { id: 'serial-trace', title: 'Trazabilidad N/S', url: '/serial-trace', icon: ScanLine },
      { id: 'locations', title: 'Ubicaciones', url: '/locations', icon: MapPinned },
      { id: 'slotting', title: 'Slotting', url: '/slotting', icon: Grid3x3 },
    ],
  },
  {
    id: 2,
    label: 'Operación',
    items: [
      { id: 'transfers', title: 'Traslados', url: '/transfers', icon: ArrowRightLeft },
      { id: 'returns', title: 'Devoluciones', url: '/returns', icon: Undo2 },
      { id: 'commerce', title: 'Commerce', url: '/commerce', icon: ShoppingCart },
      { id: 'picking', title: 'Picking', url: '/picking', icon: ClipboardList },
      { id: 'packing', title: 'Packing', url: '/packing', icon: Package },
      { id: 'labels', title: 'Etiquetas', url: '/labels', icon: Tags },
    ],
  },
  {
    id: 3,
    label: 'Despacho',
    items: [
      { id: 'shipping', title: 'Shipping', url: '/shipping', icon: Truck },
      { id: 'load-manifests', title: 'Manifiestos', url: '/load-manifests', icon: Route },
    ],
  },
  {
    id: 4,
    label: 'Sistema',
    items: [
      { id: 'reports', title: 'Reportes', url: '/reports', icon: BarChart3 },
      { id: 'integrations', title: 'Integraciones', url: '/integrations', icon: Cable },
      { id: 'admin', title: 'Administración', url: '/admin', icon: Settings2 },
    ],
  },
]
