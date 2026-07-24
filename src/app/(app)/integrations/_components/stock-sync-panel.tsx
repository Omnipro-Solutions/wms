'use client'

import { RefreshCw } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/formatters'
import type { StockSyncTrigger } from '@/types/wms'

const TRIGGER_LABELS: Record<StockSyncTrigger, string> = {
  putaway: 'Putaway',
  qc_approved: 'QC aprobado',
  adjustment: 'Ajuste',
  pick: 'Picking',
  manual: 'Manual',
}

/**
 * Paso 7 del flujo inbound: visibilidad global. Cada movimiento relevante
 * publica el stock hacia ERP/OMS y queda registrado aquí.
 */
export const StockSyncPanel = () => {
  const stockSyncLog = useWmsStore((s) => s.stockSyncLog)
  const integrations = useWmsStore((s) => s.integrations)
  const settings = useWmsStore((s) => s.settings)
  const updateSettings = useWmsStore((s) => s.updateSettings)

  // Los más recientes primero — el log crece por el final.
  const recent = [...stockSyncLog].reverse().slice(0, 15)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Publicación de inventario
          </CardTitle>
          <CardDescription>
            Cada putaway, aprobación de QC o ajuste publica el stock disponible hacia los sistemas
            conectados.
          </CardDescription>
        </div>
        <Switch
          checked={settings.stockSyncEnabled}
          onCheckedChange={(v) => updateSettings({ stockSyncEnabled: v })}
          aria-label="Activar publicación de inventario"
        />
      </CardHeader>
      <CardContent>
        {!settings.stockSyncEnabled && (
          <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
            Publicación desactivada — los cambios de stock no salen del WMS.
          </p>
        )}

        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin publicaciones registradas. Completa un putaway en Recepción para ver el flujo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((entry) => {
                const connection = integrations.find((c) => c.id === entry.connectionId)
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{connection?.name ?? entry.connectionId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TRIGGER_LABELS[entry.trigger]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.sku}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.locationId}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.quantityAvailable}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          entry.status === 'sent'
                            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                            : 'bg-red-500/10 text-red-700 dark:text-red-300'
                        }
                      >
                        {entry.status === 'sent' ? 'Enviado' : 'Falló'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
