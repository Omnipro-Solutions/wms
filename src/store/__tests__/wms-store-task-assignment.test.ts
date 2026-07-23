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
