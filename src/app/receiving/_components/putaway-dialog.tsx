'use client'

import { ArrowRight, CheckCircle2, ClipboardCheck, MapPin, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePutawayDialog } from '../_hooks/use-putaway-dialog'
import { ErrorBanner } from './error-banner'

export { usePutawayDialog } from '../_hooks/use-putaway-dialog'
export type { PutawayDialogData } from '../_hooks/use-putaway-dialog'

interface Props {
  state: ReturnType<typeof usePutawayDialog>
}

export const PutawayDialog = ({ state }: Props) => {
  const {
    dialog,
    handleSubmit,
    selectedLocation,
    setSelectedLocation,
    allLocations,
    locationCode,
  } = state

  return (
    <Dialog
      open={!!dialog.data}
      onOpenChange={(o) => {
        if (!o) dialog.close()
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b bg-linear-to-r from-emerald-50 to-teal-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100">
              <MapPin className="size-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base leading-snug font-semibold">
                Asignar ubicación en almacén
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                El sistema sugiere la posición óptima según la frecuencia de rotación del producto.
              </DialogDescription>
            </div>
          </div>

          {dialog.data && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                N° Aviso:{' '}
                <span className="text-foreground font-mono font-semibold">
                  {dialog.data.asnCode}
                </span>
              </span>
              <span className="text-muted-foreground">
                Producto:{' '}
                <span className="text-foreground font-medium">{dialog.data.productName}</span>
              </span>
              <span className="text-muted-foreground">
                Rotación:{' '}
                <span className="text-foreground font-medium">Clase {dialog.data.abcClass}</span>
              </span>
            </div>
          )}
        </div>

        {dialog.data && (
          <div className="space-y-5 px-6 py-5">
            {dialog.data.isCrossDocking && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <Zap className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Salida rápida (Cross-Docking):</strong> este lote tiene una orden de
                  salida pendiente. Al confirmar irá directamente al área de despacho.
                </span>
              </div>
            )}

            {dialog.data.suggestedLocationId ? (
              <div className="space-y-3">
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
                        Posición recomendada
                      </p>
                      <p className="mt-1 text-4xl font-bold tracking-tight text-emerald-800">
                        {locationCode(dialog.data.suggestedLocationId)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-600">
                        Optimiza tiempos de picking — producto clase {dialog.data.abcClass}
                      </p>
                    </div>
                    <CheckCircle2 className="mt-1 size-8 shrink-0 text-emerald-400" />
                  </div>
                  <Button
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      if (dialog.data?.suggestedLocationId)
                        setSelectedLocation(dialog.data.suggestedLocationId)
                    }}
                  >
                    Confirmar posición recomendada
                    <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <div className="bg-border h-px flex-1" />
                  o selecciona otra posición
                  <div className="bg-border h-px flex-1" />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ClipboardCheck className="mt-0.5 size-4 shrink-0" />
                <span>Sin posición recomendada. Selecciona la ubicación manualmente.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pa-loc" className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="text-muted-foreground size-3.5" />
                Posición de destino <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger
                  id="pa-loc"
                  className={cn(!selectedLocation && dialog.error && 'border-destructive')}
                >
                  <SelectValue placeholder="Selecciona una posición en el almacén…" />
                </SelectTrigger>
                <SelectContent>
                  {allLocations.map((l) => {
                    const isSuggested = l.id === dialog.data?.suggestedLocationId
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="flex items-center gap-2">
                          {isSuggested && <span className="font-bold text-emerald-500">★</span>}
                          <span className="font-mono">{l.code}</span>
                          <span className="text-muted-foreground">— Zona {l.zone}</span>
                          {l.golden && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 px-1 py-0 text-[10px] text-amber-600"
                            >
                              Golden
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {dialog.error && <ErrorBanner message={dialog.error} />}
          </div>
        )}

        <div className="bg-muted/20 flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={dialog.close}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLocation}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <MapPin className="mr-1.5 size-4" />
            {dialog.data?.isCrossDocking ? 'Enviar a área de despacho' : 'Confirmar ubicación'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
