# Selector Unificado de Operador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared `OperatorSwitcher` dialog, usable from both desktop (`HeaderActions`) and worker (`WorkerHeader`), that lets the demo switch between all 5 operators (including supervisor) via the real login flow, and removes the dead instant-switch code path.

**Architecture:** A single pure function `resolveSwitchDestination` decides the post-login redirect target given the target role and current pathname. `OperatorSwitcher` is a client component wrapping a shadcn `Dialog` that lists the 5 demo operators, calls `logout()` + `login()` from `useAuthStore`, then routes via `resolveSwitchDestination`. `WorkerHeader` and `HeaderActions` each render `<OperatorSwitcher>` with their own trigger button/menu item. The old `OperatorPickerProvider`/`OperatorPicker` (instant switch, no login) is deleted along with its use in `(app)/layout.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zustand 5 (`useAuthStore`), shadcn `Dialog`, Vitest.

## Global Constraints

- All UI labels in Spanish (es-CO) — per project CLAUDE.md.
- Components are arrow functions, named exports (except Next.js pages) — per project CLAUDE.md / AGENTS.md.
- Clause guards before happy-path render — per project CLAUDE.md.
- Use `cn()` from `@/lib/utils` for conditional classes — never template literals.
- Domain types come from `@/types/wms` (`Operator`, `Operator['role']`) — never redefine inline.
- Demo operator credentials (from `docs/demo/DEMO-SCRIPT.md`): supervisor `carlos.granados@wms.co` / `WMS2024`; receiver/picker/packer/driver all use `123456`.
- `resolveWorkerRoute` (`src/lib/worker-routes.ts`) already maps `supervisor` → `/`, and each worker role → its `/worker/...` route. Reuse it — do not duplicate the role→route map.

---

### Task 1: `resolveSwitchDestination` pure function + test

**Files:**
- Create: `src/lib/operator-switch.ts`
- Test: `src/lib/operator-switch.test.ts`

**Interfaces:**
- Consumes: `resolveWorkerRoute` from `src/lib/worker-routes.ts` (`(role: OperatorRole) => string`), `OperatorRole` type from same file.
- Produces: `resolveSwitchDestination(role: OperatorRole, currentPathname: string): string` — used by Task 2's `OperatorSwitcher`.

Logic: if `role` is a worker role (`picker`/`packer`/`receiver`/`driver`), return `resolveWorkerRoute(role)`. If `role` is `supervisor`: when `currentPathname` starts with `/worker`, return `/` (coming from mobile, no desktop page to return to); otherwise return `currentPathname` (stay on current desktop page, just refresh with new operator).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/operator-switch.test.ts
import { describe, it, expect } from 'vitest'
import { resolveSwitchDestination } from './operator-switch'

describe('resolveSwitchDestination', () => {
  it('routes worker roles to their worker route regardless of current path', () => {
    expect(resolveSwitchDestination('picker', '/')).toBe('/worker/picking')
    expect(resolveSwitchDestination('packer', '/worker/receiving')).toBe('/worker/packing')
    expect(resolveSwitchDestination('receiver', '/slotting')).toBe('/worker/receiving')
    expect(resolveSwitchDestination('driver', '/worker/picking')).toBe('/worker/driver')
  })

  it('routes supervisor to / when switching from a worker route', () => {
    expect(resolveSwitchDestination('supervisor', '/worker/picking')).toBe('/')
    expect(resolveSwitchDestination('supervisor', '/worker')).toBe('/')
  })

  it('keeps supervisor on the current path when already on desktop', () => {
    expect(resolveSwitchDestination('supervisor', '/slotting')).toBe('/slotting')
    expect(resolveSwitchDestination('supervisor', '/')).toBe('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/operator-switch.test.ts`
Expected: FAIL with "Failed to resolve import" or "resolveSwitchDestination is not a function" (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/operator-switch.ts
import { resolveWorkerRoute } from '@/lib/worker-routes'
import type { OperatorRole } from '@/lib/worker-routes'

export const resolveSwitchDestination = (role: OperatorRole, currentPathname: string): string => {
  if (role !== 'supervisor') return resolveWorkerRoute(role)
  return currentPathname.startsWith('/worker') ? '/' : currentPathname
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/operator-switch.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/operator-switch.ts src/lib/operator-switch.test.ts
git commit -m "feat(operator-switch): add resolveSwitchDestination for post-login redirect"
```

---

### Task 2: `OperatorSwitcher` shared component

**Files:**
- Create: `src/components/shared/operator-switcher.tsx`

**Interfaces:**
- Consumes: `resolveSwitchDestination` from `src/lib/operator-switch.ts` (Task 1), `useAuthStore` (`login`, `logout`) from `@/store/auth-store`, `usePathname`/`useRouter` from `next/navigation`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` from `@/components/ui/dialog`, `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`, `Operator` type from `@/types/wms`.
- Produces: `OperatorSwitcher` component with props `{ open: boolean; onOpenChange: (open: boolean) => void }` — consumed by Task 3 (`WorkerHeader`) and Task 4 (`HeaderActions`). Also exports `ROLE_LABELS` and `ROLE_COLORS` (`Record<Operator['role'], string>`) so callers can reuse them for the trigger's current-role badge if needed.

This component owns the dialog UI and the switch logic. It does NOT own the trigger button — callers control `open`/`onOpenChange` from their own button/menu-item `onClick`.

- [ ] **Step 1: Write the component**

```typescript
// src/components/shared/operator-switcher.tsx
'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { resolveSwitchDestination } from '@/lib/operator-switch'
import { cn } from '@/lib/utils'
import type { Operator } from '@/types/wms'

export const ROLE_LABELS: Record<Operator['role'], string> = {
  supervisor: 'Supervisor',
  receiver: 'Recepcionista',
  picker: 'Picker',
  packer: 'Empacador',
  driver: 'Conductor',
}

export const ROLE_COLORS: Record<Operator['role'], string> = {
  supervisor: 'bg-red-100 text-red-800',
  receiver: 'bg-green-100 text-green-800',
  picker: 'bg-blue-100 text-blue-800',
  packer: 'bg-purple-100 text-purple-800',
  driver: 'bg-orange-100 text-orange-800',
}

interface DemoOperator {
  role: Operator['role']
  name: string
  email: string
  password: string
}

const DEMO_OPERATORS: DemoOperator[] = [
  { role: 'supervisor', name: 'Carlos Granados', email: 'carlos.granados@wms.co', password: 'WMS2024' },
  { role: 'receiver', name: 'María Recepcionista', email: 'receiver@demo.com', password: '123456' },
  { role: 'picker', name: 'Ana Picker', email: 'picker@demo.com', password: '123456' },
  { role: 'packer', name: 'Pedro Packer', email: 'packer@demo.com', password: '123456' },
  { role: 'driver', name: 'Carlos Driver', email: 'driver@demo.com', password: '123456' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const OperatorSwitcher = ({ open, onOpenChange }: Props) => {
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const pathname = usePathname()
  const [loadingRole, setLoadingRole] = useState<Operator['role'] | null>(null)

  const handleSwitch = async (demoOperator: DemoOperator) => {
    setLoadingRole(demoOperator.role)
    logout()
    const result = await login(demoOperator.email, demoOperator.password, false)
    setLoadingRole(null)
    if (!result.success) return
    onOpenChange(false)
    router.push(resolveSwitchDestination(demoOperator.role, pathname))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Cambiar operador (demo)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {DEMO_OPERATORS.map((demoOperator) => (
            <Button
              key={demoOperator.role}
              variant="outline"
              className="justify-start gap-3"
              disabled={loadingRole !== null}
              onClick={() => handleSwitch(demoOperator)}
            >
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_COLORS[demoOperator.role])}>
                {ROLE_LABELS[demoOperator.role]}
              </span>
              <span className="text-sm">{demoOperator.name}</span>
              {loadingRole === demoOperator.role && (
                <span className="ml-auto text-xs text-muted-foreground">...</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `operator-switcher.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/operator-switcher.tsx
git commit -m "feat(shared): add OperatorSwitcher dialog for desktop+worker role switching"
```

---

### Task 3: Wire `OperatorSwitcher` into `WorkerHeader`

**Files:**
- Modify: `src/components/worker/worker-header.tsx`

**Interfaces:**
- Consumes: `OperatorSwitcher`, `ROLE_LABELS`, `ROLE_COLORS` from `src/components/shared/operator-switcher.tsx` (Task 2).

Replace the local `DEMO_ROLES` array, `handleSwitchRole`, and inline `Dialog` with `<OperatorSwitcher>`. Keep the 👥 trigger button and the local `ROLE_LABELS`/`ROLE_COLORS` usage for displaying the *current* operator badge (now imported from the shared module instead of redefined).

- [ ] **Step 1: Rewrite the file**

```typescript
// src/components/worker/worker-header.tsx
'use client'

import Image from 'next/image'
import { LogOut, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { OperatorSwitcher, ROLE_LABELS, ROLE_COLORS } from '@/components/shared/operator-switcher'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { APP_CONFIG } from '@/config/app-config'

export const WorkerHeader = () => {
  const { operator } = useCurrentOperator()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

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
          <Button variant="ghost" size="icon" onClick={() => setSwitcherOpen(true)} title="Cambiar rol demo">
            <Users className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      )}

      <OperatorSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </header>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `worker-header.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/worker/worker-header.tsx
git commit -m "refactor(worker): use shared OperatorSwitcher instead of local dialog"
```

---

### Task 4: Wire `OperatorSwitcher` into `HeaderActions` (desktop)

**Files:**
- Modify: `src/components/sidebar/header-actions.tsx`

**Interfaces:**
- Consumes: `OperatorSwitcher` from `src/components/shared/operator-switcher.tsx` (Task 2).

Add a "Cambiar operador" item to the avatar dropdown (same spot it lived before commit `c5ce7b8` removed it), opening the shared switcher.

- [ ] **Step 1: Add the import and state**

In `src/components/sidebar/header-actions.tsx`, update the icon import and add state:

```typescript
import { MoonIcon, SunIcon, RefreshCwIcon, ShieldCheckIcon, LogOutIcon } from 'lucide-react'
```

```typescript
import { OperatorSwitcher } from '@/components/shared/operator-switcher'
```

Inside `HeaderActions`, alongside the existing `useState` for `mounted`:

```typescript
const [switcherOpen, setSwitcherOpen] = useState(false)
```

- [ ] **Step 2: Add the dropdown item**

Insert before the final `DropdownMenuSeparator`/logout item (right after the existing supervisor-badge block, before the closing `DropdownMenuSeparator` that precedes logout):

```tsx
<DropdownMenuItem onClick={() => setSwitcherOpen(true)}>
  <RefreshCwIcon className="mr-2 size-4" />
  Cambiar operador
</DropdownMenuItem>
<DropdownMenuSeparator />
```

- [ ] **Step 3: Render the switcher**

After the closing `</DropdownMenu>` tag, before the closing `</div>` of the root:

```tsx
<OperatorSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `header-actions.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/header-actions.tsx
git commit -m "feat(sidebar): add operator switcher to desktop header dropdown"
```

---

### Task 5: Remove dead instant-switch code

**Files:**
- Delete: `src/components/layout/operator-picker-provider.tsx`
- Delete: `src/components/shared/operator-picker.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- None produced — this task only removes code no longer reachable from any UI (confirmed: `useOperatorPicker` has zero callers after Task 3/4 land, since both headers now use `OperatorSwitcher`).

- [ ] **Step 1: Remove the provider wrapper from the layout**

In `src/app/(app)/layout.tsx`, remove the import and unwrap the JSX:

```typescript
import { OperatorPickerProvider } from '@/components/layout/operator-picker-provider'
```
Delete this line.

Change:
```tsx
    <OperatorPickerProvider>
      <SidebarProvider
        ...
      >
        ...
      </SidebarProvider>
    </OperatorPickerProvider>
```
to:
```tsx
    <SidebarProvider
      ...
    >
      ...
    </SidebarProvider>
```

- [ ] **Step 2: Delete the dead files**

```bash
git rm src/components/layout/operator-picker-provider.tsx src/components/shared/operator-picker.tsx
```

- [ ] **Step 3: Verify no remaining references**

Run: `grep -rn "operator-picker-provider\|useOperatorPicker\|OperatorPicker[^S]" src/`
Expected: no output (only `OperatorSwitcher` matches remain, which the pattern excludes)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "chore: remove dead instant operator-picker code path"
```

---

### Task 6: Update DEMO-SCRIPT.md and full verification pass

**Files:**
- Modify: `docs/demo/DEMO-SCRIPT.md:30`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update the tip in the Preparación section**

Replace line 30:
```markdown
> **Tip:** El botón 👥 en el header de la vista móvil permite cambiar de rol sin cerrar sesión. Úsalo para cambiar entre receiver, picker, packer y driver durante la demo.
```
with:
```markdown
> **Tip:** El botón 👥 en el header móvil y "Cambiar operador" en el menú del avatar (vista desktop) abren el mismo selector — incluye supervisor. Úsalo para cambiar entre cualquier rol sin manejar pestañas separadas del navegador.
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS, including `src/lib/operator-switch.test.ts` from Task 1

- [ ] **Step 3: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification in browser**

Start dev server: `npm run dev`

1. Go to `/auth/login`, log in as supervisor (`carlos.granados@wms.co` / `WMS2024`).
2. Click avatar (top right) → "Cambiar operador" → select Picker → confirm redirect to `/worker/picking` and header shows Picker badge.
3. Click 👥 in worker header → select Empacador → confirm redirect to `/worker/packing`.
4. Click 👥 → select Supervisor → confirm redirect to `/` (since coming from `/worker`).
5. From `/slotting` (desktop), open avatar dropdown → "Cambiar operador" → select a different supervisor-adjacent role, e.g. Conductor → confirm redirect to `/worker/driver`.
6. Confirm no console errors during any switch.

- [ ] **Step 5: Commit**

```bash
git add docs/demo/DEMO-SCRIPT.md
git commit -m "docs(demo): update operator-switch tip to cover supervisor + desktop"
```

---

## Self-Review Notes

- **Spec coverage:** shared component (Task 2), worker wiring (Task 3), desktop wiring (Task 4), dead code removal (Task 5), demo script update (Task 6) — all spec sections covered.
- **Type consistency:** `Operator['role']` used consistently across `operator-switch.ts`, `operator-switcher.tsx`; `resolveSwitchDestination(role, currentPathname)` signature matches between Task 1 definition and Task 2 usage.
- **No placeholders:** every step has literal code/commands.
