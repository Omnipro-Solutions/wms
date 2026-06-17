import {
  Activity,
  Globe,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react'
import type { IntegrationConnection } from '@/types/wms'

export const TYPE_META: Record<
  IntegrationConnection['type'],
  { label: string; icon: React.ElementType; iconBg: string; iconColor: string; badgeClass: string }
> = {
  sap: {
    label: 'SAP ERP',
    icon: Globe,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  ecommerce: {
    label: 'Ecommerce',
    icon: ShoppingCart,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  marketplace: {
    label: 'Marketplace',
    icon: ShoppingBag,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  carrier: {
    label: 'Transportadora',
    icon: Truck,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  erp: {
    label: 'ERP',
    icon: Globe,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  oms: {
    label: 'OMS',
    icon: Activity,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  pos: {
    label: 'POS',
    icon: Store,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  supplier: {
    label: 'Proveedor',
    icon: Globe,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
  },
}

export const STATUS_CONFIG: Record<
  IntegrationConnection['status'],
  { label: string; pillClass: string; dotClass: string; cardBorder: string; pulsing: boolean }
> = {
  active: {
    label: 'Activa',
    pillClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-500',
    cardBorder: 'border-slate-200 hover:border-emerald-200',
    pulsing: true,
  },
  inactive: {
    label: 'Inactiva',
    pillClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    dotClass: 'bg-slate-400',
    cardBorder: 'border-slate-200',
    pulsing: false,
  },
  error: {
    label: 'Error',
    pillClass: 'bg-red-50 text-red-700 border border-red-200',
    dotClass: 'bg-red-500',
    cardBorder: 'border-red-200 hover:border-red-300',
    pulsing: false,
  },
  pending_configuration: {
    label: 'Sin configurar',
    pillClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotClass: 'bg-amber-400',
    cardBorder: 'border-amber-100 hover:border-amber-200',
    pulsing: false,
  },
}
