'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardCheck, PackageCheck, Trash2, Wrench, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  REPAIR_STATUS_LABELS,
  REPAIR_TYPE_LABELS,
  RESULT_LABELS,
  RESULT_STYLES,
  SCRAP_METHOD_LABELS,
} from '@/lib/returns'
import type {
  ReentryBatch,
  RepairTicket,
  ReturnInspection,
  ScrapRecord,
} from '@/types/wms'

const fmt = (iso: string) => format(parseISO(iso), 'dd MMM yyyy', { locale: es })

const EmptyState = ({ icon: Icon, message }: { icon: LucideIcon; message: string }) => (
  <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
    <Icon className="size-8 text-zinc-300" />
    {message}
  </div>
)

interface BaseProps {
  rmaCode: (returnOrderId: string) => string
  onOpenReturn: (returnOrderId: string) => void
}

const RmaCell = ({ code, onClick }: { code: string; onClick: () => void }) => (
  <button onClick={onClick} className="text-left font-medium hover:underline">
    {code}
  </button>
)

// ── Inspecciones ──────────────────────────────────────────────────────────────

export const InspectionsTable = ({
  inspections,
  rmaCode,
  onOpenReturn,
}: BaseProps & { inspections: ReturnInspection[] }) => {
  if (inspections.length === 0)
    return <EmptyState icon={ClipboardCheck} message="Aún no hay inspecciones registradas." />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RMA</TableHead>
          <TableHead>Inspector</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Ítems</TableHead>
          <TableHead>Resultado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {inspections.map((i) => (
          <TableRow key={i.id} className="border-border/60">
            <TableCell>
              <RmaCell code={rmaCode(i.returnOrderId)} onClick={() => onOpenReturn(i.returnOrderId)} />
            </TableCell>
            <TableCell className="text-sm">{i.inspectorName}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{fmt(i.inspectedAt)}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">{i.items.length}</TableCell>
            <TableCell>
              <Badge variant="outline" className={cn('text-xs font-semibold', RESULT_STYLES[i.overallResult])}>
                {RESULT_LABELS[i.overallResult]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ── Reingresos ────────────────────────────────────────────────────────────────

export const ReentriesTable = ({
  reentries,
  rmaCode,
  onOpenReturn,
}: BaseProps & { reentries: ReentryBatch[] }) => {
  if (reentries.length === 0)
    return <EmptyState icon={PackageCheck} message="Aún no se ha ejecutado ningún reingreso." />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RMA</TableHead>
          <TableHead>Operador</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Líneas</TableHead>
          <TableHead className="text-right">Uds.</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reentries.map((b) => {
          const units = b.lines.reduce((s, l) => s + l.quantity, 0)
          return (
            <TableRow key={b.id} className="border-border/60">
              <TableCell>
                <RmaCell code={rmaCode(b.returnOrderId)} onClick={() => onOpenReturn(b.returnOrderId)} />
              </TableCell>
              <TableCell className="text-sm">{b.operatorName}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{fmt(b.createdAt)}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{b.lines.length}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{units}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {b.status === 'executed' ? 'Ejecutado' : 'Pendiente'}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ── Reparaciones ────────────────────────────────────────────────────────────────

export const RepairsTable = ({
  tickets,
  rmaCode,
  onOpenReturn,
}: BaseProps & { tickets: RepairTicket[] }) => {
  if (tickets.length === 0)
    return <EmptyState icon={Wrench} message="No hay tickets de reparación." />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RMA</TableHead>
          <TableHead>Taller</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Retorno esperado</TableHead>
          <TableHead className="text-right">Costo (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.id} className="border-border/60">
            <TableCell>
              <RmaCell code={rmaCode(t.returnOrderId)} onClick={() => onOpenReturn(t.returnOrderId)} />
            </TableCell>
            <TableCell className="text-sm">{t.vendorName}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {REPAIR_TYPE_LABELS[t.repairType]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {REPAIR_STATUS_LABELS[t.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{fmt(t.expectedReturnDate)}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {t.finalCostUsd ?? t.lines.reduce((s, l) => s + l.estimatedCostUsd, 0)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ── Bajas (scrap) ────────────────────────────────────────────────────────────────

export const ScrapTable = ({
  records,
  rmaCode,
  onOpenReturn,
}: BaseProps & { records: ScrapRecord[] }) => {
  if (records.length === 0) return <EmptyState icon={Trash2} message="No hay bajas registradas." />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RMA</TableHead>
          <TableHead>Operador</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Uds.</TableHead>
          <TableHead>Ref.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((s) => {
          const units = s.lines.reduce((sum, l) => sum + l.quantity, 0)
          return (
            <TableRow key={s.id} className="border-border/60">
              <TableCell>
                <RmaCell code={rmaCode(s.returnOrderId)} onClick={() => onOpenReturn(s.returnOrderId)} />
              </TableCell>
              <TableCell className="text-sm">{s.operatorName}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  {SCRAP_METHOD_LABELS[s.disposalMethod]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{fmt(s.createdAt)}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{units}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{s.referenceDoc ?? '—'}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
