import { describe, it, expectTypeOf } from 'vitest'
import type { LoadManifest, TransferOrder } from '@/types/wms'

describe('worker type extensions', () => {
  it('LoadManifest has optional assignedDriverId', () => {
    expectTypeOf<LoadManifest['assignedDriverId']>().toEqualTypeOf<string | undefined>()
  })
  it('TransferOrder has optional assignedDriverId', () => {
    expectTypeOf<TransferOrder['assignedDriverId']>().toEqualTypeOf<string | undefined>()
  })
})
