# Auth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar autenticación completa vía localStorage/cookie con protección de rutas por middleware Next.js, usando los `Operator` del store como usuarios del sistema.

**Architecture:** `src/lib/auth.ts` provee utilidades puras (SHA-256, cookies). `src/store/auth-store.ts` es el Zustand store de sesión. `src/middleware.ts` protege todas las rutas excepto `/auth/*` leyendo la cookie `wms-auth-session`. El `LoginForm` existente se conecta al auth-store y redirige al dashboard.

**Tech Stack:** Next.js 16 App Router · Zustand 5 (persist) · react-hook-form · zod · Web Crypto API (SHA-256) · Vitest + jsdom

## Global Constraints

- Todos los labels de UI en español (es-CO)
- Arrow functions para todos los componentes y hooks
- Sin `any` — `unknown` con type guard si necesario
- `cn()` de `@/lib/utils` para clases condicionales
- Password demo: `"wms2024"` para todos los operadores
- SHA-256 hex via `crypto.subtle` (Web Crypto API nativa — no instalar bcrypt ni crypto-js)
- Cookie name: `wms-auth-session`
- localStorage key del auth-store: `wms-auth`
- No modificar archivos en `src/components/ui/`

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/types/wms.ts` | Modificar | Agregar `email` y `passwordHash` a `Operator` |
| `src/data/seed.ts` | Modificar | Agregar `email` + SHA-256 hash a los 6 operadores |
| `src/lib/auth.ts` | Crear | `hashPassword`, `setAuthCookie`, `clearAuthCookie` |
| `src/store/auth-store.ts` | Crear | Zustand store: `operatorId`, `login`, `logout`, `getOperator` |
| `src/middleware.ts` | Crear | Edge middleware: proteger rutas, redirigir si sin cookie |
| `src/app/auth/_components/login-form.tsx` | Modificar | Conectar a auth-store, labels ES, error inline |
| `src/app/auth/login/page.tsx` | Modificar | Limpiar UI (quitar Google/Register), texto es-CO |
| `src/components/sidebar/header-actions.tsx` | Modificar | Agregar ítem "Cerrar sesión" en dropdown |

---

### Task 1: Extender tipo `Operator` y actualizar seed

**Files:**
- Modify: `src/types/wms.ts` (línea ~725 donde está `interface Operator`)
- Modify: `src/data/seed.ts` (línea ~1904 donde está el array `operators`)

**Interfaces:**
- Produces: `Operator` con `email: string` y `passwordHash: string` — todos los tasks siguientes dependen de esto

- [ ] **Step 1: Agregar campos al tipo Operator en src/types/wms.ts**

Localizar `interface Operator` (~línea 725) y reemplazarla:

```ts
export interface Operator {
  id: string
  code: string
  name: string
  email: string
  passwordHash: string
  role: 'picker' | 'packer' | 'receiver' | 'driver' | 'supervisor'
  active: boolean
}
```

- [ ] **Step 2: Calcular el hash SHA-256 de "wms2024"**

Correr este snippet en Node para obtener el hash (solo se necesita una vez):

```bash
node -e "
const { createHash } = require('crypto');
console.log(createHash('sha256').update('wms2024').digest('hex'));
"
```

Resultado esperado: `aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5`

Este valor se hardcodea en el seed para todos los operadores.

- [ ] **Step 3: Actualizar el array operators en src/data/seed.ts**

Localizar `export const operators: Operator[] = [` (~línea 1904) y reemplazar con:

```ts
const WMS2024_HASH = 'aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5'

export const operators: Operator[] = [
  { id: 'op-0', code: 'OP-000', name: 'Carlos Granados',  email: 'carlos.granados@wms.co',  passwordHash: WMS2024_HASH, role: 'supervisor', active: true },
  { id: 'op-1', code: 'OP-001', name: 'Andrés Gómez',     email: 'andres.gomez@wms.co',     passwordHash: WMS2024_HASH, role: 'picker',     active: true },
  { id: 'op-2', code: 'OP-002', name: 'Paula Vega',       email: 'paula.vega@wms.co',       passwordHash: WMS2024_HASH, role: 'picker',     active: true },
  { id: 'op-3', code: 'OP-003', name: 'Carlos Ramírez',   email: 'carlos.ramirez@wms.co',   passwordHash: WMS2024_HASH, role: 'receiver',   active: true },
  { id: 'op-4', code: 'OP-004', name: 'Diana López',      email: 'diana.lopez@wms.co',      passwordHash: WMS2024_HASH, role: 'supervisor', active: true },
  { id: 'op-5', code: 'OP-005', name: 'Pedro Martínez',   email: 'pedro.martinez@wms.co',   passwordHash: WMS2024_HASH, role: 'driver',     active: true },
]
```

- [ ] **Step 4: Verificar que TypeScript compila sin errores**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores relacionados con `Operator`. Puede haber errores previos no relacionados — ignorarlos si no involucran `Operator`, `email`, o `passwordHash`.

- [ ] **Step 5: Commit**

```bash
git add src/types/wms.ts src/data/seed.ts
git commit -m "feat(auth): add email and passwordHash to Operator type and seed"
```

---

### Task 2: Crear utilidades de auth puras (`src/lib/auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: nada (utilidades puras)
- Produces:
  - `hashPassword(password: string): Promise<string>` — SHA-256 hex
  - `setAuthCookie(operatorId: string, remember: boolean): void` — escribe cookie `wms-auth-session`
  - `clearAuthCookie(): void` — borra cookie `wms-auth-session`

- [ ] **Step 1: Escribir tests para hashPassword**

Crear `src/lib/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword } from './auth'

describe('hashPassword', () => {
  it('returns consistent SHA-256 hex for known input', async () => {
    const hash = await hashPassword('wms2024')
    expect(hash).toBe('ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f')
  })

  it('returns different hashes for different inputs', async () => {
    const a = await hashPassword('abc')
    const b = await hashPassword('xyz')
    expect(a).not.toBe(b)
  })

  it('is case-sensitive', async () => {
    const lower = await hashPassword('wms2024')
    const upper = await hashPassword('WMS2024')
    expect(lower).not.toBe(upper)
  })
})
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/lib/auth.test.ts
```

Esperado: FAIL — "Cannot find module './auth'"

- [ ] **Step 3: Implementar src/lib/auth.ts**

```ts
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const setAuthCookie = (operatorId: string, remember: boolean): void => {
  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined // 30 días en segundos
  const parts = [
    `wms-auth-session=${operatorId}`,
    'path=/',
    'SameSite=Lax',
    ...(maxAge !== undefined ? [`Max-Age=${maxAge}`] : []),
  ]
  document.cookie = parts.join('; ')
}

export const clearAuthCookie = (): void => {
  document.cookie = 'wms-auth-session=; path=/; SameSite=Lax; Max-Age=0'
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/lib/auth.test.ts
```

Esperado: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat(auth): add hashPassword and cookie utilities"
```

---

### Task 3: Crear auth-store (`src/store/auth-store.ts`)

**Files:**
- Create: `src/store/auth-store.ts`
- Create: `src/store/auth-store.test.ts`

**Interfaces:**
- Consumes:
  - `hashPassword(password: string): Promise<string>` de `@/lib/auth`
  - `setAuthCookie(operatorId: string, remember: boolean): void` de `@/lib/auth`
  - `clearAuthCookie(): void` de `@/lib/auth`
  - `useWmsStore.getState().operators` — array de `Operator` con `email` y `passwordHash`
- Produces:
  - `useAuthStore` hook — expone `operatorId`, `login`, `logout`, `getOperator`
  - Tipo `AuthState` exportado

- [ ] **Step 1: Escribir tests para el auth-store**

Crear `src/store/auth-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock wms-store
vi.mock('@/store/wms-store', () => ({
  useWmsStore: {
    getState: () => ({
      operators: [
        {
          id: 'op-0',
          email: 'carlos.granados@wms.co',
          passwordHash: 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f',
          active: true,
          name: 'Carlos Granados',
          role: 'supervisor',
          code: 'OP-000',
        },
        {
          id: 'op-1',
          email: 'inactive@wms.co',
          passwordHash: 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f',
          active: false,
          name: 'Inactive User',
          role: 'picker',
          code: 'OP-001',
        },
      ],
    }),
  },
}))

// Mock auth utils
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async (pwd: string) =>
    pwd === 'wms2024'
      ? 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f'
      : 'wronghash'
  ),
  setAuthCookie: vi.fn(),
  clearAuthCookie: vi.fn(),
}))

import { useAuthStore } from './auth-store'
import { setAuthCookie, clearAuthCookie } from '@/lib/auth'

beforeEach(() => {
  useAuthStore.setState({ operatorId: null })
  vi.clearAllMocks()
})

describe('login', () => {
  it('succeeds with valid credentials', async () => {
    const result = await useAuthStore.getState().login('carlos.granados@wms.co', 'wms2024', false)
    expect(result.success).toBe(true)
    expect(useAuthStore.getState().operatorId).toBe('op-0')
    expect(setAuthCookie).toHaveBeenCalledWith('op-0', false)
  })

  it('fails with unknown email', async () => {
    const result = await useAuthStore.getState().login('unknown@wms.co', 'wms2024', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales incorrectas')
    expect(useAuthStore.getState().operatorId).toBeNull()
  })

  it('fails with wrong password', async () => {
    const result = await useAuthStore.getState().login('carlos.granados@wms.co', 'wrong', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales incorrectas')
  })

  it('fails for inactive operator', async () => {
    const result = await useAuthStore.getState().login('inactive@wms.co', 'wms2024', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Usuario inactivo')
  })

  it('is case-insensitive for email', async () => {
    const result = await useAuthStore.getState().login('CARLOS.GRANADOS@WMS.CO', 'wms2024', false)
    expect(result.success).toBe(true)
  })
})

describe('logout', () => {
  it('clears operatorId and calls clearAuthCookie', () => {
    useAuthStore.setState({ operatorId: 'op-0' })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().operatorId).toBeNull()
    expect(clearAuthCookie).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/auth-store.test.ts
```

Esperado: FAIL — "Cannot find module './auth-store'"

- [ ] **Step 3: Implementar src/store/auth-store.ts**

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { hashPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth'
import { useWmsStore } from '@/store/wms-store'
import type { Operator } from '@/types/wms'

interface AuthState {
  operatorId: string | null
  login: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  getOperator: () => Operator | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      operatorId: null,

      login: async (email, password, remember) => {
        const operators = useWmsStore.getState().operators
        const operator = operators.find((o) => o.email.toLowerCase() === email.toLowerCase())

        if (!operator) return { success: false, error: 'Credenciales incorrectas' }
        if (!operator.active) return { success: false, error: 'Usuario inactivo' }

        const hash = await hashPassword(password)
        if (hash !== operator.passwordHash) return { success: false, error: 'Credenciales incorrectas' }

        setAuthCookie(operator.id, remember)
        set({ operatorId: operator.id })
        return { success: true }
      },

      logout: () => {
        clearAuthCookie()
        set({ operatorId: null })
      },

      getOperator: () => {
        const { operatorId } = get()
        if (!operatorId) return null
        return useWmsStore.getState().operators.find((o) => o.id === operatorId) ?? null
      },
    }),
    {
      name: 'wms-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ operatorId: state.operatorId }),
    }
  )
)
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/auth-store.test.ts
```

Esperado: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/auth-store.ts src/store/auth-store.test.ts
git commit -m "feat(auth): add auth-store with login/logout/getOperator"
```

---

### Task 4: Crear middleware de rutas (`src/middleware.ts`)

**Files:**
- Create: `src/middleware.ts` (en la raíz de `src/`, mismo nivel que `app/`)

**Interfaces:**
- Consumes: cookie `wms-auth-session` del request
- Produces: redirección a `/auth/login` si cookie ausente en rutas protegidas

**Nota:** El middleware corre en Edge Runtime — sin acceso a localStorage, solo cookies.

- [ ] **Step 1: Verificar ubicación correcta del middleware**

En Next.js App Router, `middleware.ts` debe estar en `src/` (si `src/` existe como raíz) o en la raíz del proyecto. Este proyecto tiene `src/app/`, así que el middleware va en `src/middleware.ts`.

```bash
ls /Users/carlosgranados/Documents/develop/wms/src/
```

Confirmar que existe `app/` dentro de `src/`. Si es así, crear `src/middleware.ts`.

- [ ] **Step 2: Crear src/middleware.ts**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const middleware = (request: NextRequest) => {
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const sessionCookie = request.cookies.get('wms-auth-session')

  if (!isAuthRoute && !sessionCookie) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 3: Verificar que el build compila**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep -i "middleware\|error" | head -20
```

Esperado: sin errores en `middleware.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add Next.js Edge middleware for route protection"
```

---

### Task 5: Actualizar LoginForm — conectar a auth-store

**Files:**
- Modify: `src/app/auth/_components/login-form.tsx`

**Interfaces:**
- Consumes:
  - `useAuthStore` de `@/store/auth-store` — `.login(email, password, remember)`
  - `useRouter` de `next/navigation` — `.push('/')`
- Produces: formulario funcional que autentica y redirige

- [ ] **Step 1: Reemplazar src/app/auth/_components/login-form.tsx completo**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

const formSchema = z.object({
  email: z.string().email({ message: "Ingresa un correo electrónico válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>

export const LoginForm = () => {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const handleSubmit = async (data: FormValues) => {
    setAuthError(null);
    const result = await login(data.email, data.password, data.remember ?? false);
    if (!result.success) {
      setAuthError(result.error ?? "Error al iniciar sesión.");
      return;
    }
    router.push("/");
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                placeholder="tu@wms.co"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="login-remember"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
              />
              <FieldContent>
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  Recordarme por 30 días
                </FieldLabel>
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "login-form\|auth-store" | head -10
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/_components/login-form.tsx
git commit -m "feat(auth): connect LoginForm to auth-store, labels in Spanish"
```

---

### Task 6: Actualizar página de login (`src/app/auth/login/page.tsx`)

**Files:**
- Modify: `src/app/auth/login/page.tsx`

**Interfaces:**
- Consumes: `LoginForm` de `../_components/login-form`
- Produces: página de login en español sin opciones de registro ni Google

- [ ] **Step 1: Reemplazar src/app/auth/login/page.tsx**

```tsx
import { APP_CONFIG } from '@/config/app-config'
import { LoginForm } from '../_components/login-form'

export default function LoginPage() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">Ingresa a tu cuenta</h1>
          <p className="text-muted-foreground text-sm">Ingresa tus datos para continuar.</p>
        </div>
        <LoginForm />
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{APP_CONFIG.copyright}</div>
        <div className="text-sm text-muted-foreground">WMS v{APP_CONFIG.version}</div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "login/page" | head -5
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/login/page.tsx
git commit -m "feat(auth): update login page — Spanish text, remove Google/Register"
```

---

### Task 7: Agregar logout en HeaderActions

**Files:**
- Modify: `src/components/sidebar/header-actions.tsx`

**Interfaces:**
- Consumes:
  - `useAuthStore` de `@/store/auth-store` — `.logout()`
  - `useRouter` de `next/navigation`
- Produces: ítem "Cerrar sesión" en el dropdown del usuario

**Contexto:** `HeaderActions` ya tiene un `DropdownMenu` con avatar del operador y "Cambiar operador". Se agrega "Cerrar sesión" al final.

- [ ] **Step 1: Modificar src/components/sidebar/header-actions.tsx**

Agregar imports necesarios y el ítem de logout:

```tsx
'use client'

import { MoonIcon, SunIcon, RefreshCwIcon, ShieldCheckIcon, LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useOperatorPicker } from '@/components/layout/operator-picker-provider'
import { useAuthStore } from '@/store/auth-store'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Empacador',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export const HeaderActions = () => {
  const { theme, setTheme } = useTheme()
  const { operator } = useCurrentOperator()
  const { openPicker } = useOperatorPicker()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()

  const displayName = operator?.name ?? 'Sin operador'
  const displayRole = operator ? (ROLE_LABELS[operator.role] ?? operator.role) : '—'
  const initials = operator ? operator.name.slice(0, 2).toUpperCase() : '?'

  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Cambiar tema"
      >
        {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Avatar className="h-7 w-7 rounded-full">
              <AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {operator?.role === 'supervisor' && (
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <ShieldCheckIcon className="mr-2 size-4" />
                Modo supervisor activo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          )}
          <DropdownMenuItem onClick={openPicker}>
            <RefreshCwIcon className="mr-2 size-4" />
            Cambiar operador
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOutIcon className="mr-2 size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "header-actions" | head -5
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/header-actions.tsx
git commit -m "feat(auth): add logout to HeaderActions dropdown"
```

---

### Task 8: Smoke test manual + correr suite completa

**Files:** ninguno nuevo

- [ ] **Step 1: Correr suite de tests completa**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run
```

Esperado: todos los tests pasan (incluyendo `auth.test.ts` y `auth-store.test.ts`).

- [ ] **Step 2: Iniciar servidor de desarrollo**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm run dev
```

- [ ] **Step 3: Verificar flujo de protección de rutas**

1. Abrir `http://localhost:3000/` sin sesión → debe redirigir a `http://localhost:3000/auth/login`
2. Intentar acceder a `http://localhost:3000/inventory` → debe redirigir a `/auth/login`

- [ ] **Step 4: Verificar flujo de login exitoso**

1. En `/auth/login`, ingresar `carlos.granados@wms.co` / `wms2024` → click "Ingresar"
2. Debe redirigir a `/` (dashboard)
3. Abrir DevTools → Application → Cookies → verificar que existe `wms-auth-session=op-0`
4. Abrir DevTools → Application → localStorage → verificar que `wms-auth` contiene `operatorId: "op-0"`

- [ ] **Step 5: Verificar error de credenciales**

1. En `/auth/login`, ingresar `carlos.granados@wms.co` / `wrongpassword` → click "Ingresar"
2. Debe mostrar "Credenciales incorrectas" bajo el campo de contraseña, sin redirigir

- [ ] **Step 6: Verificar logout**

1. Estando en el dashboard, click en avatar (esquina superior derecha) → "Cerrar sesión"
2. Debe redirigir a `/auth/login`
3. Verificar que cookie `wms-auth-session` fue eliminada (DevTools → Cookies)

- [ ] **Step 7: Verificar "Recordarme 30 días"**

1. Login con checkbox "Recordarme por 30 días" marcado
2. DevTools → Cookies → `wms-auth-session` → columna "Expires" debe mostrar fecha ~30 días futura

- [ ] **Step 8: Commit final**

```bash
git add .
git commit -m "feat(auth): complete login authentication with localStorage and route protection"
```
