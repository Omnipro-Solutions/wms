import { describe, it, expect, beforeEach } from 'vitest'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'

beforeEach(() => {
  useWmsStore.setState({
    pickingTasks: seed.pickingTasks.map((t) => ({ ...t })),
    replenishmentTasks: seed.replenishmentTasks.map((t) => ({ ...t })),
    asnRecords: seed.asnRecords.map((a) => ({ ...a })),
    loadManifests: seed.loadManifests.map((m) => ({ ...m })),
    transfers: seed.transfers.map((t) => ({ ...t })),
    operators: seed.operators.map((o) => ({ ...o })),
    settings: { ...seed.settings },
  })
})

describe('startPicking — operator id wiring', () => {
  it('sets assignedOperatorId when a 3rd argument is passed', () => {
    // pt-eco-3 seed fixture: status 'assigned', operatorName 'Paula Vega', no assignedOperatorId yet
    useWmsStore.getState().startPicking('pt-eco-3', 'Paula Vega', 'op-2')
    const task = useWmsStore.getState().pickingTasks.find((t) => t.id === 'pt-eco-3')
    expect(task?.assignedOperatorId).toBe('op-2')
    expect(task?.status).toBe('in_progress') // assigned -> in_progress transition still happens
  })

  it('preserves the existing assignedOperatorId when the 3rd argument is omitted', () => {
    // pt-b2b-5 seed fixture: status 'pending', assignedOperatorId already 'op-picker-1'
    useWmsStore.getState().startPicking('pt-b2b-5', 'Ana Picker')
    const task = useWmsStore.getState().pickingTasks.find((t) => t.id === 'pt-b2b-5')
    expect(task?.assignedOperatorId).toBe('op-picker-1')
    expect(task?.status).toBe('assigned') // pending -> assigned transition still happens
  })
})

describe('startReplenishment — operator id wiring', () => {
  it('sets assignedOperatorId when a 3rd argument is passed', () => {
    // rp-1 seed fixture: status 'pending', no operator assigned yet
    useWmsStore.getState().startReplenishment('rp-1', 'Andrés Gómez', 'op-1')
    const task = useWmsStore.getState().replenishmentTasks.find((t) => t.id === 'rp-1')
    expect(task?.assignedOperatorId).toBe('op-1')
    expect(task?.status).toBe('assigned')
  })

  it('leaves assignedOperatorId undefined when the 3rd argument is omitted', () => {
    useWmsStore.getState().startReplenishment('rp-1', 'Andrés Gómez')
    const task = useWmsStore.getState().replenishmentTasks.find((t) => t.id === 'rp-1')
    expect(task?.assignedOperatorId).toBeUndefined()
  })
})

describe('assignPutaway — operator id wiring', () => {
  it('sets assignedOperatorId and assignedOperatorName when a 3rd argument is passed', () => {
    useWmsStore.getState().assignPutaway('asn-1', 'María Recepcionista', 'op-receiver-1')
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === 'asn-1')
    expect(asn?.assignedOperatorName).toBe('María Recepcionista')
    expect(asn?.assignedOperatorId).toBe('op-receiver-1')
  })

  it('leaves assignedOperatorId undefined when the 3rd argument is omitted', () => {
    useWmsStore.getState().assignPutaway('asn-1', 'María Recepcionista')
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === 'asn-1')
    expect(asn?.assignedOperatorId).toBeUndefined()
  })
})

describe('assignManifestDriver', () => {
  it('assigns a valid active driver', () => {
    // lm-ruta3 seed fixture: status 'pending', no assignedDriverId yet
    useWmsStore.getState().assignManifestDriver('lm-ruta3', 'op-driver-1')
    const manifest = useWmsStore.getState().loadManifests.find((m) => m.id === 'lm-ruta3')
    expect(manifest?.assignedDriverId).toBe('op-driver-1')
    expect(manifest?.driverName).toBe('Carlos Driver')
  })

  it('throws when the manifest does not exist', () => {
    expect(() => useWmsStore.getState().assignManifestDriver('lm-missing', 'op-driver-1')).toThrow(
      'Manifiesto no encontrado'
    )
  })

  it('throws when the operator does not exist', () => {
    expect(() => useWmsStore.getState().assignManifestDriver('lm-ruta3', 'op-missing')).toThrow(
      'Operario no encontrado'
    )
  })

  it('throws when the operator is not a driver', () => {
    // op-0 seed fixture: role 'supervisor'
    expect(() => useWmsStore.getState().assignManifestDriver('lm-ruta3', 'op-0')).toThrow(
      'El operario no tiene rol de conductor'
    )
  })

  it('throws when the operator is inactive', () => {
    useWmsStore.setState((state) => ({
      operators: state.operators.map((o) => (o.id === 'op-driver-1' ? { ...o, active: false } : o)),
    }))
    expect(() => useWmsStore.getState().assignManifestDriver('lm-ruta3', 'op-driver-1')).toThrow(
      'El operario está inactivo'
    )
  })

  it('throws when shipping is frozen', () => {
    useWmsStore.setState((state) => ({
      settings: { ...state.settings, shippingFreezeActive: true },
    }))
    expect(() => useWmsStore.getState().assignManifestDriver('lm-ruta3', 'op-driver-1')).toThrow(
      'Despacho en modo congelado. No se permiten operaciones.'
    )
  })
})

describe('assignTransferDriver', () => {
  it('assigns a valid active driver', () => {
    // tr-4 seed fixture: status 'partial_received', no assignedDriverId yet
    useWmsStore.getState().assignTransferDriver('tr-4', 'op-driver-1')
    const transfer = useWmsStore.getState().transfers.find((t) => t.id === 'tr-4')
    expect(transfer?.assignedDriverId).toBe('op-driver-1')
  })

  it('throws when the transfer does not exist', () => {
    expect(() => useWmsStore.getState().assignTransferDriver('tr-missing', 'op-driver-1')).toThrow(
      'Traslado no encontrado'
    )
  })

  it('throws when the operator does not exist', () => {
    expect(() => useWmsStore.getState().assignTransferDriver('tr-4', 'op-missing')).toThrow(
      'Operario no encontrado'
    )
  })

  it('throws when the operator is not a driver', () => {
    expect(() => useWmsStore.getState().assignTransferDriver('tr-4', 'op-0')).toThrow(
      'El operario no tiene rol de conductor'
    )
  })

  it('throws when the operator is inactive', () => {
    useWmsStore.setState((state) => ({
      operators: state.operators.map((o) => (o.id === 'op-driver-1' ? { ...o, active: false } : o)),
    }))
    expect(() => useWmsStore.getState().assignTransferDriver('tr-4', 'op-driver-1')).toThrow(
      'El operario está inactivo'
    )
  })
})
