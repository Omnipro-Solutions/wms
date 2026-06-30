# Role-Based Worker Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/worker` section with full-screen tactile UX for picker, packer, receiver, and driver roles, leaving the existing desktop UI untouched for supervisors.

**Architecture:** New Next.js route group `(worker)` with its own layout (no sidebar). Middleware reads the auth cookie and redirects each role to their worker route. Shared worker UI primitives live in `src/components/worker/`. All business logic comes from the existing Zustand store — no new state.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · Vitest

## Global Constraints

- All UI labels in Spanish (es-CO).
- Primary action buttons minimum height `h-12` (48px).
- Content area: `max-w-lg mx-auto p-4` — centered on tablet.
- No new dependencies.
- Arrow functions for all components and hooks. No `function` declarations.
- Named exports everywhere except Next.js page files (which use `default export`).
- `cn()` from `@/lib/utils` for all conditional classNames.
- Import domain types from `src/types/wms.ts` — never redefine inline.
- `priority: 'high'` maps to "URGENTE" badge (not a literal `'urgent'` value).
- `scanItem(packingOrderId, qty)` — second arg is qty scanned, not barcode string.
- Worker routes are protected: middleware redirects unauthenticated users to `/auth/login`.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/components/worker/worker-header.tsx` | Avatar + name + role badge + "Cambiar operador" button |
| `src/components/worker/worker-card.tsx` | Tactile list card with right arrow, slot for badge |
| `src/components/worker/worker-stepper.tsx` | Step indicator "Paso N de M" |
| `src/components/worker/scan-input.tsx` | Barcode input: autofocus, submit on Enter, success/error feedback |
| `src/components/worker/quantity-stepper.tsx` | `−` / `N` / `+` numeric stepper with min/max |
| `src/app/(worker)/layout.tsx` | Full-screen layout, no sidebar, wraps `OperatorPickerProvider` |
| `src/app/(worker)/page.tsx` | Hub: reads role → redirects to correct worker route |
| `src/app/(worker)/picking/page.tsx` | Picker task list filtered to current operator |
| `src/app/(worker)/picking/task/[taskId]/page.tsx` | 4-step guided picking flow |
| `src/app/(worker)/packing/page.tsx` | Packer order queue |
| `src/app/(worker)/packing/[orderId]/page.tsx` | 5-step guided packing flow |
| `src/app/(worker)/receiving/page.tsx` | Receiver ASN list for today |
| `src/app/(worker)/receiving/[asnId]/page.tsx` | 5-step guided receiving flow |
| `src/app/(worker)/returns/page.tsx` | Returns list for receiver |
| `src/app/(worker)/driver/page.tsx` | Driver: manifests + transfers |
| `src/app/(worker)/driver/manifest/[id]/page.tsx` | Stop-by-stop manifest execution |

### Modified files
| File | Change |
|------|--------|
| `src/types/wms.ts` | Add `assignedDriverId?: string` to `LoadManifest` and `TransferOrder` |
| `src/data/seed.ts` | Add `assignedDriverId` to manifests/transfers; add demo operators with passwords |
| `src/middleware.ts` | Add role-based redirect after auth check |
| `src/components/navigation/sidebar/sidebar-items.ts` | Add `allowedRoles?: OperatorRole[]` to nav item types and existing items |
| `src/components/sidebar/nav-main.tsx` | Filter items by `currentOperator.role` |

---

### Task 1: Type extensions + seed data

**Files:**
- Modify: `src/types/wms.ts` (lines 605–622 `LoadManifest`, lines 230–244 `TransferOrder`)
- Modify: `src/data/seed.ts`
- Test: `src/store/__tests__/worker-types.test.ts` (new)

**Interfaces:**
- Produces: `LoadManifest.assignedDriverId?: string`, `TransferOrder.assignedDriverId?: string`
- Produces: seed operators `op-driver-1`, `op-picker-1`, `op-packer-1`, `op-receiver-1` with `passwordHash`

- [ ] **Step 1: Add `assignedDriverId` to `LoadManifest`**

In `src/types/wms.ts` at line 621 (after `stops: ManifestStop[]`), add:
```ts
  assignedDriverId?: string
```

- [ ] **Step 2: Add `assignedDriverId` to `TransferOrder`**

In `src/types/wms.ts` at line 243 (after `currentLegIndex: number`), add:
```ts
  assignedDriverId?: string
```

- [ ] **Step 3: Write the type test**

Create `src/store/__tests__/worker-types.test.ts`:
```ts
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
```

- [ ] **Step 4: Run type test**

```bash
npx vitest run src/store/__tests__/worker-types.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Update seed data**

In `src/data/seed.ts`, find the `operators` array and add four demo operators. Use the existing `hashPassword` utility or hardcode the bcrypt hash for `"demo1234"` (SHA-256: `"03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"`):

```ts
{
  id: 'op-picker-1',
  code: 'PKR-01',
  name: 'Ana Picker',
  email: 'picker@demo.com',
  passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  role: 'picker' as const,
  active: true,
},
{
  id: 'op-packer-1',
  code: 'PKG-01',
  name: 'Pedro Packer',
  email: 'packer@demo.com',
  passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  role: 'packer' as const,
  active: true,
},
{
  id: 'op-receiver-1',
  code: 'RCV-01',
  name: 'María Recepcionista',
  email: 'receiver@demo.com',
  passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  role: 'receiver' as const,
  active: true,
},
{
  id: 'op-driver-1',
  code: 'DRV-01',
  name: 'Carlos Driver',
  email: 'driver@demo.com',
  passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  role: 'driver' as const,
  active: true,
},
```

Then find the first 2–3 `loadManifests` entries and add `assignedDriverId: 'op-driver-1'`. Find the first 1–2 `transferOrders` entries and add `assignedDriverId: 'op-driver-1'`.

Also assign 3–5 `pickingTasks` to `op-picker-1` by setting `operatorName: 'Ana Picker'` — the picker filter uses `assignedOperatorId` but PickingTask only has `operatorName`, so also add `assignedOperatorId: 'op-picker-1'` to those tasks in seed (the field already exists on the type at line 271 of wms.ts).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/wms.ts src/data/seed.ts src/store/__tests__/worker-types.test.ts
git commit -m "feat(worker): extend types and seed data for role-based views"
```

---

### Task 2: Middleware role-based redirect

**Files:**
- Modify: `src/middleware.ts`
- Test: `src/middleware.test.ts` (new)

**Interfaces:**
- Consumes: `wms-auth-session` cookie (existing), `wms-auth` localStorage key with `{ operatorId }` (from auth-store)
- Produces: redirects `/worker` hub and operator roles to their route; blocks desktop routes for non-supervisor roles

**Note:** Middleware runs on the Edge — no access to Zustand. The operator's role must be encoded in the session cookie or a separate cookie. The current `wms-auth-session` cookie only signals "logged in". We need a second cookie `wms-operator-role` written at login time.

- [ ] **Step 1: Write middleware test**

Create `src/middleware.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

// We test the redirect logic in isolation by importing the role-resolve helper
import { resolveWorkerRoute } from '@/lib/worker-routes'

describe('resolveWorkerRoute', () => {
  it('picker → /worker/picking', () => {
    expect(resolveWorkerRoute('picker')).toBe('/worker/picking')
  })
  it('packer → /worker/packing', () => {
    expect(resolveWorkerRoute('packer')).toBe('/worker/packing')
  })
  it('receiver → /worker/receiving', () => {
    expect(resolveWorkerRoute('receiver')).toBe('/worker/receiving')
  })
  it('driver → /worker/driver', () => {
    expect(resolveWorkerRoute('driver')).toBe('/worker/driver')
  })
  it('supervisor → /', () => {
    expect(resolveWorkerRoute('supervisor')).toBe('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/middleware.test.ts
```
Expected: FAIL — `resolveWorkerRoute` not found.

- [ ] **Step 3: Create `src/lib/worker-routes.ts`**

```ts
import type { Operator } from '@/types/wms'

export type OperatorRole = Operator['role']

const ROLE_ROUTES: Record<OperatorRole, string> = {
  picker:     '/worker/picking',
  packer:     '/worker/packing',
  receiver:   '/worker/receiving',
  driver:     '/worker/driver',
  supervisor: '/',
}

export const resolveWorkerRoute = (role: OperatorRole): string => ROLE_ROUTES[role]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/middleware.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 5: Update `auth-store.ts` to write role cookie at login**

In `src/store/auth-store.ts`, inside `login`, after `setAuthCookie(operator.id, remember)`:
```ts
// Write role cookie so middleware can redirect without DB access
document.cookie = `wms-operator-role=${operator.role}; path=/; SameSite=Lax`
```

And in `logout`:
```ts
document.cookie = 'wms-operator-role=; path=/; max-age=0'
```

- [ ] **Step 6: Update `src/middleware.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveWorkerRoute } from '@/lib/worker-routes'
import type { OperatorRole } from '@/lib/worker-routes'

const WORKER_ROLES: OperatorRole[] = ['picker', 'packer', 'receiver', 'driver']

export const middleware = (request: NextRequest) => {
  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/auth')
  const sessionCookie = request.cookies.get('wms-auth-session')
  const roleCookie = request.cookies.get('wms-operator-role')
  const role = roleCookie?.value as OperatorRole | undefined

  // Unauthenticated → login
  if (!isAuthRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Auth routes: pass through
  if (isAuthRoute) return NextResponse.next()

  // Worker roles trying to access desktop (app) routes → redirect to their worker route
  if (role && WORKER_ROLES.includes(role) && !pathname.startsWith('/worker')) {
    return NextResponse.redirect(new URL(resolveWorkerRoute(role), request.url))
  }

  // /worker hub → redirect to role route
  if (pathname === '/worker' && role) {
    return NextResponse.redirect(new URL(resolveWorkerRoute(role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/worker-routes.ts src/middleware.ts src/store/auth-store.ts src/middleware.test.ts
git commit -m "feat(worker): role-based redirect in middleware"
```

---

### Task 3: Shared worker UI components

**Files:**
- Create: `src/components/worker/worker-header.tsx`
- Create: `src/components/worker/worker-card.tsx`
- Create: `src/components/worker/worker-stepper.tsx`
- Create: `src/components/worker/scan-input.tsx`
- Create: `src/components/worker/quantity-stepper.tsx`
- Test: `src/components/worker/__tests__/worker-components.test.tsx` (new)

**Interfaces:**
- Produces:
  - `WorkerHeader` — no props (reads from `useCurrentOperator`)
  - `WorkerCard({ title, subtitle, badge?, urgent?, onClick })` → `JSX.Element`
  - `WorkerStepper({ current, total })` → `JSX.Element`
  - `ScanInput({ label, expectedValue, onMatch, onError? })` → `JSX.Element`
  - `QuantityStepper({ value, onChange, min?, max? })` → `JSX.Element`

- [ ] **Step 1: Write component tests**

Create `src/components/worker/__tests__/worker-components.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuantityStepper } from '../quantity-stepper'
import { WorkerStepper } from '../worker-stepper'
import { WorkerCard } from '../worker-card'

describe('QuantityStepper', () => {
  it('renders value and calls onChange on + click', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={3} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('does not go below min', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={1} onChange={onChange} min={1} />)
    fireEvent.click(screen.getByRole('button', { name: '−' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('WorkerStepper', () => {
  it('shows current and total', () => {
    render(<WorkerStepper current={2} total={4} />)
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument()
  })
})

describe('WorkerCard', () => {
  it('calls onClick when tapped', () => {
    const onClick = vi.fn()
    render(<WorkerCard title="Zona A" subtitle="A-01-03" onClick={onClick} />)
    fireEvent.click(screen.getByText('Zona A'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows urgent badge when urgent=true', () => {
    render(<WorkerCard title="Task" subtitle="sub" urgent onClick={vi.fn()} />)
    expect(screen.getByText('URGENTE')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/worker/__tests__/worker-components.test.tsx
```
Expected: FAIL — components not found.

- [ ] **Step 3: Create `src/components/worker/quantity-stepper.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  className?: string
}

export const QuantityStepper = ({ value, onChange, min = 0, max, className }: Props) => (
  <div className={cn('flex items-center gap-4', className)}>
    <Button
      variant="outline"
      size="icon"
      aria-label="−"
      className="h-12 w-12 text-xl"
      disabled={value <= (min ?? 0)}
      onClick={() => onChange(value - 1)}
    >
      −
    </Button>
    <span className="w-16 text-center text-3xl font-bold tabular-nums">{value}</span>
    <Button
      variant="outline"
      size="icon"
      aria-label="+"
      className="h-12 w-12 text-xl"
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
    >
      +
    </Button>
  </div>
)
```

- [ ] **Step 4: Create `src/components/worker/worker-stepper.tsx`**

```tsx
interface Props {
  current: number
  total: number
}

export const WorkerStepper = ({ current, total }: Props) => (
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-muted-foreground">
      Paso {current} de {total}
    </span>
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-6 rounded-full ${i < current ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </div>
  </div>
)
```

- [ ] **Step 5: Create `src/components/worker/worker-card.tsx`**

```tsx
'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle: string
  badge?: string
  urgent?: boolean
  onClick: () => void
  className?: string
}

export const WorkerCard = ({ title, subtitle, badge, urgent, onClick, className }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors active:bg-muted',
      urgent && 'border-red-300 bg-red-50',
      className
    )}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-semibold truncate">{title}</p>
        {urgent && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            URGENTE
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      {badge && (
        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {badge}
        </span>
      )}
    </div>
    <ChevronRight className="shrink-0 text-muted-foreground" />
  </button>
)
```

- [ ] **Step 6: Create `src/components/worker/scan-input.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ScanLine, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  expectedValue: string
  onMatch: () => void
  onError?: (scanned: string) => void
}

export const ScanInput = ({ label, expectedValue, onMatch, onError }: Props) => {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (value.trim() === expectedValue) {
      setStatus('ok')
      setTimeout(onMatch, 400)
    } else {
      setStatus('error')
      onError?.(value.trim())
      setValue('')
      setTimeout(() => setStatus('idle'), 1200)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Escanear o escribir..."
          className={cn(
            'pl-9 h-12 text-base',
            status === 'ok' && 'border-emerald-500 bg-emerald-50',
            status === 'error' && 'border-red-500 bg-red-50'
          )}
        />
        {status === 'ok' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 size-5" />}
        {status === 'error' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 size-5" />}
      </div>
      <Button className="h-12 text-base" onClick={handleSubmit} disabled={!value.trim()}>
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" onClick={onMatch} className="text-muted-foreground">
        Confirmar manualmente
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/components/worker/worker-header.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useOperatorPicker } from '@/components/layout/operator-picker-provider'
import { cn } from '@/lib/utils'
import { APP_CONFIG } from '@/config/app-config'

const ROLE_LABELS: Record<string, string> = {
  picker:     'Picker',
  packer:     'Empacador',
  receiver:   'Recepcionista',
  driver:     'Conductor',
  supervisor: 'Supervisor',
}

const ROLE_COLORS: Record<string, string> = {
  picker:     'bg-blue-100 text-blue-800',
  packer:     'bg-purple-100 text-purple-800',
  receiver:   'bg-green-100 text-green-800',
  driver:     'bg-orange-100 text-orange-800',
  supervisor: 'bg-red-100 text-red-800',
}

export const WorkerHeader = () => {
  const { operator } = useCurrentOperator()
  const { openPicker } = useOperatorPicker()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Image src="/logo.svg" alt="Logo" width={28} height={28} className="shrink-0" />
        <span className="font-semibold text-sm">{APP_CONFIG.name}</span>
      </div>
      {operator && (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{operator.name}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_COLORS[operator.role])}>
              {ROLE_LABELS[operator.role]}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={openPicker} title="Cambiar operador">
            <LogOut className="size-4" />
          </Button>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 8: Run component tests**

```bash
npx vitest run src/components/worker/__tests__/worker-components.test.tsx
```
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/worker/
git commit -m "feat(worker): add shared worker UI components"
```

---

### Task 4: Worker layout + hub page

**Files:**
- Create: `src/app/(worker)/layout.tsx`
- Create: `src/app/(worker)/page.tsx`

**Interfaces:**
- Consumes: `WorkerHeader`, `OperatorPickerProvider`, `useCurrentOperator`
- Consumes: `resolveWorkerRoute` from `@/lib/worker-routes`

- [ ] **Step 1: Create `src/app/(worker)/layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { OperatorPickerProvider } from '@/components/layout/operator-picker-provider'
import { WorkerHeader } from '@/components/worker/worker-header'

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <OperatorPickerProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <WorkerHeader />
        <main className="flex-1 p-4">
          <div className="mx-auto max-w-lg">
            {children}
          </div>
        </main>
      </div>
    </OperatorPickerProvider>
  )
}
```

- [ ] **Step 2: Create `src/app/(worker)/page.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { resolveWorkerRoute } from '@/lib/worker-routes'

export default function WorkerHubPage() {
  const { operator } = useCurrentOperator()
  const router = useRouter()

  useEffect(() => {
    if (operator) router.replace(resolveWorkerRoute(operator.role))
  }, [operator, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted-foreground text-sm">Cargando...</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(worker\)/
git commit -m "feat(worker): add worker layout and hub page"
```

---

### Task 5: Picker views

**Files:**
- Create: `src/app/(worker)/picking/page.tsx`
- Create: `src/app/(worker)/picking/task/[taskId]/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore` state: `pickingTasks`, `products`, `locations`, `commerceOrders`
- Consumes: store actions: `startPicking(taskId, operatorName)`, `completePick(taskId, qty)`, `approvePart(taskId)`
- Consumes: `WorkerCard`, `WorkerStepper`, `ScanInput`, `QuantityStepper`
- Consumes: `useCurrentOperator` for `operator.id` and `operator.name`

- [ ] **Step 1: Create picker task list `src/app/(worker)/picking/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

export default function WorkerPickingPage() {
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const pickingTasks = useWmsStore((s) => s.pickingTasks)
  const { getProduct, getLocation } = useStoreHelpers()

  const myTasks = pickingTasks
    .filter(
      (t) =>
        t.assignedOperatorId === operator?.id &&
        ['pending', 'assigned', 'in_progress'].includes(t.status)
    )
    .sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 }
      return pri[a.priority] - pri[b.priority]
    })

  if (!myTasks.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ClipboardList className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin tareas pendientes</p>
        <p className="text-sm text-muted-foreground">No tienes tareas asignadas por el momento.</p>
      </div>
    )
  }

  const next = myTasks[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mis tareas</h1>
        <span className="text-sm text-muted-foreground">{myTasks.length} pendientes</span>
      </div>

      <Button
        className="h-12 text-base"
        onClick={() => router.push(`/worker/picking/task/${next.id}`)}
      >
        ▶ INICIAR SIGUIENTE TAREA
      </Button>

      <div className="flex flex-col gap-2">
        {myTasks.map((task) => {
          const product = getProduct(task.productId)
          const location = getLocation(task.locationId)
          return (
            <WorkerCard
              key={task.id}
              title={product?.name ?? task.productId}
              subtitle={`${location?.zone ?? '—'} · ${location?.code ?? '—'} · ×${task.requestedQuantity}`}
              badge={task.code}
              urgent={task.priority === 'high'}
              onClick={() => router.push(`/worker/picking/task/${task.id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create guided picking flow `src/app/(worker)/picking/task/[taskId]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { ScanInput } from '@/components/worker/scan-input'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Step = 'location' | 'product' | 'quantity' | 'done'

export default function WorkerPickingTaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { pickingTasks, products, locations, startPicking, completePick, approvePart } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)

  const [step, setStep] = useState<Step>('location')
  const [qty, setQty] = useState(task?.requestedQuantity ?? 0)
  const [showPartialDialog, setShowPartialDialog] = useState(false)

  if (!task || !location || !product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Tarea no encontrada.</p>
      </div>
    )
  }

  const stepIndex = { location: 1, product: 2, quantity: 3, done: 4 }

  const handleLocationMatch = () => {
    if (task.status === 'assigned' || task.status === 'pending') {
      startPicking(task.id, operator?.name ?? 'Operador')
    }
    setStep('product')
  }

  const handleProductMatch = () => setStep('quantity')

  const handleConfirmQty = () => {
    if (qty < task.requestedQuantity) {
      setShowPartialDialog(true)
    } else {
      completePick(task.id, qty)
      setStep('done')
    }
  }

  const handleConfirmPartial = () => {
    completePick(task.id, qty)
    approvePart(task.id)
    setShowPartialDialog(false)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">¡Pick completado!</p>
          <p className="text-sm text-muted-foreground mt-1">{task.code}</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" className="h-12" onClick={() => router.push('/worker/picking')}>
            ← Ver mis tareas
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={3} />

      {step === 'location' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Zona</p>
            <p className="text-4xl font-black">{location.zone}</p>
            <p className="text-2xl font-bold text-muted-foreground">{location.code}</p>
          </div>
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
        </div>
      )}

      {step === 'product' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold text-lg">{product.name}</p>
            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          </div>
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
        </div>
      )}

      {step === 'quantity' && (
        <div className="flex flex-col gap-6 items-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Solicitado</p>
            <p className="text-5xl font-black">{task.requestedQuantity}</p>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>
          <QuantityStepper value={qty} onChange={setQty} min={0} max={task.requestedQuantity} />
          <Button className="h-12 w-full text-base" onClick={handleConfirmQty}>
            CONFIRMAR
          </Button>
        </div>
      )}

      <AlertDialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cantidad parcial?</AlertDialogTitle>
            <AlertDialogDescription>
              Registraste {qty} de {task.requestedQuantity} unidades. Se marcará como pick parcial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPartial}>Confirmar parcial</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(worker\)/picking/
git commit -m "feat(worker): add picker task list and guided picking flow"
```

---

### Task 6: Packer views

**Files:**
- Create: `src/app/(worker)/packing/page.tsx`
- Create: `src/app/(worker)/packing/[orderId]/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore` state: `packingOrders`, `packingBoxTypes`, `packingRules`
- Consumes: store actions: `startPacking(orderId, packerName)`, `scanItem(orderId, qty)`, `applyPackingRule(orderId, ruleId)`, `selectBox(orderId, boxTypeId)`, `generateLabel(orderId)`, `sendToShipping(orderId)`
- Consumes: `suggestBox` from `@/lib/rules/packing`, `applicableRules` from `@/lib/rules/packing`
- Consumes: `WorkerCard`, `WorkerStepper`, `QuantityStepper`

- [ ] **Step 1: Create packer queue `src/app/(worker)/packing/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

export default function WorkerPackingPage() {
  const router = useRouter()
  const packingOrders = useWmsStore((s) => s.packingOrders)
  const packingRules = useWmsStore((s) => s.packingRules)

  const queue = packingOrders
    .filter((o) => o.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (!queue.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Package className="size-12 text-muted-foreground" />
        <p className="font-semibold">Cola vacía</p>
        <p className="text-sm text-muted-foreground">No hay órdenes para empacar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cola de empaque</h1>
        <span className="text-sm text-muted-foreground">{queue.length} órdenes</span>
      </div>

      <Button className="h-12 text-base" onClick={() => router.push(`/worker/packing/${queue[0].id}`)}>
        ▶ INICIAR SIGUIENTE
      </Button>

      <div className="flex flex-col gap-2">
        {queue.map((order) => {
          const ruleIds = order.appliedRuleIds ?? []
          const ruleLabels = packingRules
            .filter((r) => ruleIds.includes(r.id))
            .map((r) => r.name)
            .join(', ')

          return (
            <WorkerCard
              key={order.id}
              title={order.orderNumber ?? order.id}
              subtitle={`${order.expectedItems} ítems · ${order.customerName}`}
              badge={ruleLabels || undefined}
              onClick={() => router.push(`/worker/packing/${order.id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create guided packing flow `src/app/(worker)/packing/[orderId]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { Button } from '@/components/ui/button'
import { suggestBox } from '@/lib/rules/packing'

type Step = 'rules' | 'items' | 'box' | 'label' | 'done'

export default function WorkerPackingOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { packingOrders, packingBoxTypes, packingRules, startPacking, scanItem, applyPackingRule, selectBox, generateLabel, sendToShipping } =
    useWmsStore()

  const order = packingOrders.find((o) => o.id === orderId)

  const activeRules = packingRules.filter((r) => order?.appliedRuleIds?.includes(r.id) ?? false)
  const hasRules = activeRules.length > 0

  const [step, setStep] = useState<Step>(hasRules ? 'rules' : 'items')
  const [scannedCount, setScannedCount] = useState(0)
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [showBoxList, setShowBoxList] = useState(false)

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada.</p>
      </div>
    )
  }

  const stepIndex: Record<Step, number> = { rules: 1, items: hasRules ? 2 : 1, box: hasRules ? 3 : 2, label: hasRules ? 4 : 3, done: hasRules ? 5 : 4 }
  const totalSteps = hasRules ? 4 : 3

  const suggested = suggestBox(order.weightKg, order.volumeM3, packingBoxTypes)

  const handleStartItems = () => {
    startPacking(order.id, operator?.name ?? 'Empacador')
    setStep('items')
  }

  const handleScanItem = () => {
    scanItem(order.id, scannedCount + 1)
    const next = scannedCount + 1
    setScannedCount(next)
    if (next >= order.expectedItems) setStep('box')
  }

  const handleSelectBox = (boxTypeId: string) => {
    selectBox(order.id, boxTypeId)
    setSelectedBoxId(boxTypeId)
    setStep('label')
  }

  const handleGenerateLabel = () => {
    generateLabel(order.id)
    setStep('done')
  }

  const handleDone = () => {
    sendToShipping(order.id)
    router.push('/worker/packing')
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">¡Empaque completado!</p>
          <p className="text-sm text-muted-foreground mt-1">{order.orderNumber ?? order.id}</p>
        </div>
        <Button className="h-12 w-full" onClick={handleDone}>← Ver cola</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={totalSteps} />

      {step === 'rules' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">⚠ Reglas de manejo</h2>
          <div className="flex flex-col gap-2">
            {activeRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="font-semibold">{rule.name}</p>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              </div>
            ))}
          </div>
          <Button className="h-12 text-base" onClick={handleStartItems}>
            ENTENDIDO, CONTINUAR
          </Button>
        </div>
      )}

      {step === 'items' && (
        <div className="flex flex-col gap-4 items-center">
          <WorkerStepper current={scannedCount + 1} total={order.expectedItems} />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Ítem {scannedCount + 1} de {order.expectedItems}</p>
            <p className="text-xl font-bold mt-1">{order.items?.[scannedCount]?.productName ?? 'Producto'}</p>
          </div>
          <Button className="h-12 w-full text-base" onClick={handleScanItem}>
            ✓ ESCANEAR ÍTEM
          </Button>
        </div>
      )}

      {step === 'box' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Seleccionar caja</h2>
          {suggested && !showBoxList && (
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sugerida</p>
              <p className="font-bold text-lg">📦 {suggested.name}</p>
              <p className="text-sm text-muted-foreground">
                {suggested.dimensionsCm} · máx {suggested.maxWeightKg}kg
              </p>
              <Button className="h-12 w-full mt-3 text-base" onClick={() => handleSelectBox(suggested.id)}>
                ✅ USAR ESTA CAJA
              </Button>
            </div>
          )}
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowBoxList(true)}>
            Elegir otra caja
          </Button>
          {showBoxList && (
            <div className="flex flex-col gap-2">
              {packingBoxTypes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => handleSelectBox(box.id)}
                  className="rounded-xl border p-4 text-left active:bg-muted"
                >
                  <p className="font-semibold">{box.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {box.dimensionsCm} · máx {box.maxWeightKg}kg
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'label' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Generar etiqueta</h2>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Orden</p>
            <p className="font-bold">{order.orderNumber ?? order.id}</p>
            <p className="text-sm text-muted-foreground mt-2">Cliente</p>
            <p className="font-semibold">{order.customerName}</p>
          </div>
          <Button className="h-12 text-base" onClick={handleGenerateLabel}>
            🖨 GENERAR ETIQUETA
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(worker\)/packing/
git commit -m "feat(worker): add packer queue and guided packing flow"
```

---

### Task 7: Receiver views

**Files:**
- Create: `src/app/(worker)/receiving/page.tsx`
- Create: `src/app/(worker)/receiving/[asnId]/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore` state: `asns`, `products`
- Consumes: store actions: `receiveAsn(asnId, qty, operatorName, damagedQty)`, `approveQc(asnId, operatorName)`, `rejectQc(asnId, operatorName)`, `putawayItem(asnId, locationId, operatorName)`
- Consumes: `WorkerCard`, `WorkerStepper`, `QuantityStepper`

- [ ] **Step 1: Create receiver ASN list `src/app/(worker)/receiving/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWmsStore } from '@/store/wms-store'
import { WorkerCard } from '@/components/worker/worker-card'
import { Button } from '@/components/ui/button'
import { Truck } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function WorkerReceivingPage() {
  const router = useRouter()
  const asns = useWmsStore((s) => s.asns)
  const today = format(new Date(), 'yyyy-MM-dd')

  const todayAsns = asns
    .filter(
      (a) =>
        ['pending', 'in_progress'].includes(a.status) &&
        a.appointmentDate.startsWith(today)
    )
    .sort((a) => (a.status === 'in_progress' ? -1 : 1))

  if (!todayAsns.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Truck className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin recepciones hoy</p>
        <p className="text-sm text-muted-foreground">No hay ASNs programados para hoy.</p>
        <Button variant="outline" asChild className="mt-2">
          <Link href="/receiving">🖥 Vista completa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Recepciones de hoy</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/receiving">🖥 Vista completa</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {todayAsns.map((asn) => (
          <WorkerCard
            key={asn.id}
            title={asn.code}
            subtitle={`${asn.supplierName} · ${asn.expectedQuantity} uds`}
            badge={asn.status === 'in_progress' ? 'EN PROGRESO' : 'PENDIENTE'}
            onClick={() => router.push(`/worker/receiving/${asn.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create guided receiving flow `src/app/(worker)/receiving/[asnId]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { QuantityStepper } from '@/components/worker/quantity-stepper'
import { Button } from '@/components/ui/button'

type Step = 'summary' | 'receive' | 'qc' | 'putaway' | 'done'

export default function WorkerReceivingAsnPage() {
  const { asnId } = useParams<{ asnId: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { asns, products, locations, receiveAsn, approveQc, rejectQc, putawayItem } = useWmsStore()

  const asn = asns.find((a) => a.id === asnId)
  const product = products.find((p) => p.id === asn?.productId)
  const suggestedLocation = locations.find((l) => l.id === asn?.suggestedPutawayLocationId)

  const [step, setStep] = useState<Step>('summary')
  const [recQty, setRecQty] = useState(asn?.expectedQuantity ?? 0)
  const [dmgQty, setDmgQty] = useState(0)

  if (!asn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">ASN no encontrado.</p>
      </div>
    )
  }

  const opName = operator?.name ?? 'Operador'
  const stepIndex: Record<Step, number> = {
    summary: 1, receive: 2, qc: 3, putaway: 4, done: 5,
  }
  const totalSteps = asn.requiresQualityControl ? 4 : 3

  const handleReceive = () => {
    receiveAsn(asn.id, recQty, opName, dmgQty)
    if (asn.requiresQualityControl) {
      setStep('qc')
    } else {
      setStep('putaway')
    }
  }

  const handleApproveQc = () => { approveQc(asn.id, opName); setStep('putaway') }
  const handleRejectQc = () => { rejectQc(asn.id, opName); setStep('done') }

  const handlePutaway = () => {
    if (suggestedLocation) {
      putawayItem(asn.id, suggestedLocation.id, opName)
    }
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">ASN recibido</p>
          <p className="text-sm text-muted-foreground mt-1">{asn.code}</p>
          <p className="text-sm text-muted-foreground">
            {recQty} recibidas · {dmgQty} dañadas
          </p>
        </div>
        <Button className="h-12 w-full" onClick={() => router.push('/worker/receiving')}>
          ← Volver a recepciones
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerStepper current={stepIndex[step]} total={totalSteps} />

      {step === 'summary' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold text-lg">{asn.code}</p>
            <p className="text-sm text-muted-foreground">{asn.supplierName}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">{asn.receivedQuantity}</span>
              <span className="text-muted-foreground"> / {asn.expectedQuantity} uds recibidas</span>
            </p>
          </div>
          <Button className="h-12 text-base" onClick={() => setStep('receive')}>
            {asn.status === 'in_progress' ? '▶ CONTINUAR RECIBIENDO' : '▶ INICIAR RECEPCIÓN'}
          </Button>
        </div>
      )}

      {step === 'receive' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold">{product?.name ?? 'Producto'}</p>
            <p className="text-sm text-muted-foreground">SKU: {product?.sku}</p>
            <p className="text-sm text-muted-foreground">Esperado: {asn.expectedQuantity} uds</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Cantidad recibida</p>
            <QuantityStepper value={recQty} onChange={setRecQty} min={0} max={asn.expectedQuantity + 10} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">¿Dañadas?</p>
            <QuantityStepper value={dmgQty} onChange={setDmgQty} min={0} max={recQty} />
          </div>
          <Button className="h-12 text-base" onClick={handleReceive}>
            RECIBIR ÍTEM
          </Button>
        </div>
      )}

      {step === 'qc' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Control de calidad</h2>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Recibidas: {recQty} · Dañadas: {dmgQty}</p>
          </div>
          <Button className="h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveQc}>
            ✅ APROBAR QC
          </Button>
          <Button variant="destructive" className="h-12 text-base" onClick={handleRejectQc}>
            ❌ RECHAZAR QC
          </Button>
        </div>
      )}

      {step === 'putaway' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Ubicar mercancía</h2>
          {suggestedLocation ? (
            <div className="rounded-xl bg-muted p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Llevar a</p>
              <p className="text-4xl font-black">{suggestedLocation.zone}</p>
              <p className="text-2xl font-bold text-muted-foreground">{suggestedLocation.code}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ubicación sugerida — ubicar manualmente.</p>
          )}
          <Button className="h-12 text-base" onClick={handlePutaway}>
            ✅ CONFIRMAR UBICACIÓN
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(worker\)/receiving/
git commit -m "feat(worker): add receiver ASN list and guided receiving flow"
```

---

### Task 8: Driver views

**Files:**
- Create: `src/app/(worker)/driver/page.tsx`
- Create: `src/app/(worker)/driver/manifest/[id]/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore` state: `loadManifests`, `transfers`
- Consumes: store actions: `closeManifest(manifestId)`, `advanceTransfer(transferId, operatorName)`
- Consumes: `WorkerCard`
- Note: `ManifestStop` has no `deliveredAt` or `status` field in the current type — we track delivery locally with state, then call `closeManifest` when all stops done.

- [ ] **Step 1: Create driver panel `src/app/(worker)/driver/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { Truck, ArrowRightLeft } from 'lucide-react'

export default function WorkerDriverPage() {
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const loadManifests = useWmsStore((s) => s.loadManifests)
  const transfers = useWmsStore((s) => s.transfers)

  const myManifests = loadManifests
    .filter((m) => m.assignedDriverId === operator?.id)
    .sort((a) => (a.status === 'dispatched' ? -1 : 1))

  const myTransfers = transfers
    .filter((t) => t.assignedDriverId === operator?.id && t.status === 'in_transit')

  const hasNothing = !myManifests.length && !myTransfers.length

  if (hasNothing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Truck className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin asignaciones hoy</p>
        <p className="text-sm text-muted-foreground">No tienes manifiestos ni transferencias asignadas.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {myManifests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-bold">
            <Truck className="size-4" /> Manifiestos
          </h2>
          {myManifests.map((m) => (
            <WorkerCard
              key={m.id}
              title={m.code}
              subtitle={`${m.stops.length} paradas · ${m.carrierName}`}
              badge={m.status}
              onClick={() => router.push(`/worker/driver/manifest/${m.id}`)}
            />
          ))}
        </section>
      )}

      {myTransfers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-bold">
            <ArrowRightLeft className="size-4" /> Transferencias
          </h2>
          {myTransfers.map((t) => (
            <WorkerCard
              key={t.id}
              title={t.code}
              subtitle={`${t.originId} → ${t.destinationId}`}
              badge="En tránsito"
              onClick={() => {}} // inline action below
            />
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create manifest execution `src/app/(worker)/driver/manifest/[id]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ChevronDown } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const NOVEDAD_TYPES = [
  'Bulto faltante',
  'Rechazado por cliente',
  'Dirección incorrecta',
  'Otro',
]

export default function WorkerManifestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { operator } = useCurrentOperator()
  const { loadManifests, warehouses, closeManifest } = useWmsStore()

  const manifest = loadManifests.find((m) => m.id === id)

  const [delivered, setDelivered] = useState<Set<string>>(new Set())
  const [novedadStop, setNovedadStop] = useState<string | null>(null)
  const [novedadType, setNovedadType] = useState('')
  const [novedadNote, setNovedadNote] = useState('')

  if (!manifest) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Manifiesto no encontrado.</p>
      </div>
    )
  }

  const sortedStops = [...manifest.stops].sort((a, b) => a.sequence - b.sequence)
  const currentStop = sortedStops.find((s) => !delivered.has(s.id))
  const allDone = sortedStops.every((s) => delivered.has(s.id))

  const handleDeliver = (stopId: string) => {
    const next = new Set(delivered)
    next.add(stopId)
    setDelivered(next)
    if (sortedStops.every((s) => next.has(s.id))) {
      closeManifest(manifest.id)
    }
  }

  const handleNovedad = () => {
    // Record novedad locally and mark as delivered
    handleDeliver(novedadStop!)
    setNovedadStop(null)
    setNovedadType('')
    setNovedadNote('')
  }

  if (allDone) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <div>
          <p className="text-2xl font-bold">Ruta completada</p>
          <p className="text-sm text-muted-foreground mt-1">{manifest.code}</p>
        </div>
        <Button className="h-12 w-full" onClick={() => router.push('/worker/driver')}>
          ← Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{manifest.code}</h1>
        <span className="text-sm text-muted-foreground">
          {delivered.size}/{sortedStops.length} paradas
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sortedStops.map((stop) => {
          const isDone = delivered.has(stop.id)
          const isCurrent = stop.id === currentStop?.id
          const destination = warehouses.find((w) => w.id === stop.destinationId)

          return (
            <div
              key={stop.id}
              className={cn(
                'rounded-xl border p-4',
                isDone && 'border-emerald-200 bg-emerald-50 opacity-60',
                isCurrent && 'border-primary bg-primary/5',
                !isDone && !isCurrent && 'opacity-40'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {isDone ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <p className="font-semibold">
                  Parada {stop.sequence} — {destination?.name ?? stop.destinationId}
                </p>
              </div>

              {isCurrent && (
                <div className="flex gap-2 mt-3">
                  <Button
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleDeliver(stop.id)}
                  >
                    ✅ CONFIRMAR ENTREGA
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border-amber-400 text-amber-700"
                    onClick={() => setNovedadStop(stop.id)}
                  >
                    ⚠ NOVEDAD
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!novedadStop} onOpenChange={(open) => { if (!open) setNovedadStop(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar novedad</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {NOVEDAD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNovedadType(type)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors',
                  novedadType === type && 'border-primary bg-primary/5 font-medium'
                )}
              >
                {type}
              </button>
            ))}
            <Textarea
              placeholder="Notas adicionales..."
              value={novedadNote}
              onChange={(e) => setNovedadNote(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <Button className="h-12" disabled={!novedadType} onClick={handleNovedad}>
              REGISTRAR NOVEDAD
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(worker\)/driver/
git commit -m "feat(worker): add driver manifest and transfer views"
```

---

### Task 9: Returns view (receiver)

**Files:**
- Create: `src/app/(worker)/returns/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore` state: `returns`, `products`
- Consumes: store action: `advanceReturn(returnId, operatorName)`

- [ ] **Step 1: Create returns page `src/app/(worker)/returns/page.tsx`**

```tsx
'use client'

import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { WorkerCard } from '@/components/worker/worker-card'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

export default function WorkerReturnsPage() {
  const { operator } = useCurrentOperator()
  const returns = useWmsStore((s) => s.returns)
  const advanceReturn = useWmsStore((s) => s.advanceReturn)
  const { getProduct } = useStoreHelpers()

  const pending = returns.filter((r) =>
    ['received_at_store', 'received_at_dc'].includes(r.status)
  )

  if (!pending.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <RotateCcw className="size-12 text-muted-foreground" />
        <p className="font-semibold">Sin devoluciones pendientes</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Devoluciones pendientes</h1>
      <div className="flex flex-col gap-2">
        {pending.map((ret) => {
          const firstProductId = ret.items[0]?.productId
          const product = firstProductId ? getProduct(firstProductId) : null
          return (
            <div key={ret.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <div>
                <p className="font-semibold">{ret.rmaCode}</p>
                <p className="text-sm text-muted-foreground">{ret.customerName}</p>
                {product && <p className="text-sm">{product.name}</p>}
              </div>
              <Button
                variant="outline"
                className="h-12"
                onClick={() => advanceReturn(ret.id, operator?.name ?? 'Operador')}
              >
                Avanzar estado
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(worker\)/returns/
git commit -m "feat(worker): add returns view for receiver role"
```

---

### Task 10: Sidebar role filtering

**Files:**
- Modify: `src/components/navigation/sidebar/sidebar-items.ts`
- Modify: `src/components/sidebar/nav-main.tsx`

**Interfaces:**
- Consumes: `useCurrentOperator` → `operator.role`
- Produces: `NavMainItem.allowedRoles?: OperatorRole[]` — items without the field are visible to all

- [ ] **Step 1: Add `allowedRoles` to sidebar item types in `sidebar-items.ts`**

Find `interface NavItemBase` and add:
```ts
allowedRoles?: OperatorRole[]
```

Also add the import at the top:
```ts
import type { OperatorRole } from '@/lib/worker-routes'
```

Then add `allowedRoles` to the relevant items. For example, find the `Dashboard` nav item (url `'/'`) and add:
```ts
allowedRoles: ['supervisor'],
```
Find `Receiving` (url `/receiving`): `allowedRoles: ['receiver', 'supervisor']`  
Find `Inventory` (url `/inventory`): `allowedRoles: ['receiver', 'supervisor']`  
Find `Picking` (url `/picking`): `allowedRoles: ['supervisor']`  
Find `Packing` (url `/packing`): `allowedRoles: ['supervisor']`  
Find `Shipping` (url `/shipping`): `allowedRoles: ['driver', 'supervisor']`  
Find `Load Manifests` (url `/load-manifests`): `allowedRoles: ['driver', 'supervisor']`  
Find `Returns` (url `/returns`): `allowedRoles: ['receiver', 'supervisor']`  
Find `Admin` (url `/admin`): `allowedRoles: ['supervisor']`

- [ ] **Step 2: Filter items in `NavMain`**

In `src/components/sidebar/nav-main.tsx`, add the import:
```ts
import { useCurrentOperator } from '@/hooks/use-current-operator'
```

Inside `NavMain`, before the return:
```ts
const { operator } = useCurrentOperator()
const role = operator?.role
```

Change the `items.map` in the render to filter by role:
```tsx
{items.map((group) => {
  const visibleItems = group.items.filter(
    (item) => !item.allowedRoles || !role || item.allowedRoles.includes(role)
  )
  if (!visibleItems.length) return null
  return (
    <SidebarGroup key={group.id}>
      {group.label && (
        <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
          {group.label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isItemActive={isItemActive}
              isSubItemActive={isSubItemActive}
              isSubmenuOpen={isSubmenuOpen}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
})}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/sidebar/sidebar-items.ts src/components/sidebar/nav-main.tsx
git commit -m "feat(worker): filter sidebar nav items by operator role"
```

---

### Task 11: End-to-end verification

**Files:** none new

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 2: Start dev server and verify flows**

```bash
npm run dev
```

Verify:
1. Login as `picker@demo.com` / `1234` → redirected to `/worker/picking`
2. Picker sees only their assigned tasks, no sidebar visible
3. Tap a task → 4-step flow works (location → product → quantity → done)
4. Login as `receiver@demo.com` → `/worker/receiving` with today's ASNs
5. "Vista completa" button on receiving → `/receiving` desktop works
6. Login as `driver@demo.com` → `/worker/driver` shows manifests with `assignedDriverId`
7. Login as `supervisor@demo.com` → `/` dashboard with full sidebar
8. Supervisor sidebar shows all nav items; receiver sidebar shows only Receiving/Inventory/Returns

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(worker): complete role-based worker views implementation"
```
