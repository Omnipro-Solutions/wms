# Auth Login — Spec

**Fecha:** 2026-06-26  
**Scope:** Página de login funcional con autenticación localStorage + protección de rutas via middleware Next.js

---

## Contexto

El WMS ya tiene la estructura de páginas en `/src/app/auth/login/` con un `LoginForm` que valida email/password con zod/react-hook-form pero cuyo `onSubmit` solo dispara un toast. No hay autenticación real, ni protección de rutas, ni sesión persistida.

Los `Operator` del store son los usuarios del sistema. Hay 6 en seed. Actualmente no tienen `email` ni `password`.

---

## Decisiones de diseño

| Pregunta | Decisión |
|----------|----------|
| Identificador de login | Email ficticio (`nombre@wms.co`) |
| Contraseñas | Password único `"wms2024"` hasheado con SHA-256 para todos |
| Redirect post-login | Siempre a `/` (dashboard) |
| Protección de rutas | Middleware Next.js Edge — cookie `wms-auth-session` |

---

## Modelo de datos

### `Operator` (src/types/wms.ts)

Agregar dos campos:

```ts
export interface Operator {
  id: string
  code: string
  name: string
  email: string          // nuevo: ej. carlos.granados@wms.co
  passwordHash: string   // nuevo: SHA-256 hex de "wms2024"
  role: 'picker' | 'packer' | 'receiver' | 'driver' | 'supervisor'
  active: boolean
}
```

### Seed (src/data/seed.ts)

6 operadores con email derivado del nombre y `passwordHash` = SHA-256 de `"wms2024"`:

| id | email | password (plain, solo referencia) |
|----|-------|-----------------------------------|
| op-0 | carlos.granados@wms.co | wms2024 |
| op-1 | andres.gomez@wms.co | wms2024 |
| op-2 | paula.vega@wms.co | wms2024 |
| op-3 | carlos.ramirez@wms.co | wms2024 |
| op-4 | diana.lopez@wms.co | wms2024 |
| op-5 | pedro.martinez@wms.co | wms2024 |

El hash se calcula una vez con Web Crypto API y se hardcodea en seed como string hex.

---

## Capa de auth

### `src/lib/auth.ts`

Utilidades puras sin dependencias de store o React:

```ts
hashPassword(password: string): Promise<string>
// SHA-256 via Web Crypto API → hex string

setAuthCookie(operatorId: string, remember: boolean): void
// Escribe cookie "wms-auth-session=<operatorId>"
// remember=true → Max-Age=30 días; false → session cookie
// SameSite=Lax, no Secure (localhost), no HttpOnly (necesita ser leída en Edge)

clearAuthCookie(): void
// Borra cookie wms-auth-session seteando Max-Age=0
```

### `src/store/auth-store.ts`

Zustand store separado del wms-store. Persiste en localStorage bajo clave `wms-auth`.

```ts
interface AuthState {
  operatorId: string | null

  login: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  getOperator: () => Operator | null  // lee del wms-store por operatorId
}
```

Flujo de `login()`:
1. Buscar operador en `useWmsStore.getState().operators` por `email` (case-insensitive)
2. Si no existe → `{ success: false, error: 'Credenciales incorrectas' }`
3. Si `!operator.active` → `{ success: false, error: 'Usuario inactivo' }`
4. `hashPassword(password)` → comparar con `operator.passwordHash`
5. Si no coincide → `{ success: false, error: 'Credenciales incorrectas' }`
6. `setAuthCookie(operator.id, remember)`
7. `set({ operatorId: operator.id })`
8. `return { success: true }`

**Nota de seguridad (contexto demo):** SHA-256 sin salt no es seguro para producción. Suficiente para un sistema de demo local sin backend. El hash protege contra exposición accidental en localStorage en texto plano.

---

## Middleware de rutas

### `src/middleware.ts`

```ts
// Rutas públicas: /auth/* → siempre pasan
// Todo lo demás: leer cookie "wms-auth-session"
//   - Si existe → continuar
//   - Si no existe → redirect a /auth/login
```

Edge Runtime compatible — solo lee cookies del request, no accede a localStorage.

**Matcher:** excluir `/_next/*`, `/favicon.ico`, assets estáticos.

---

## UI — LoginForm

### `src/app/auth/_components/login-form.tsx`

Cambios sobre el archivo existente:

1. Conectar a `useAuthStore`
2. `onSubmit` llama `authStore.login(email, password, remember)`
3. Error de credenciales → mostrar inline bajo el campo password (no toast)
4. Éxito → `router.push('/')`
5. Labels en español: "Correo electrónico", "Contraseña", "Recordarme por 30 días", botón "Ingresar"

### `src/app/auth/login/page.tsx`

- Quitar `GoogleButton` y el link "Don't have an account? Register" (no aplica para WMS)
- Cambiar heading a "Ingresa a tu cuenta" / "Ingresa tus datos para continuar"
- Mantener layout y estructura existente

---

## Logout

Agregar acción de logout al header/navbar existente. `authStore.logout()` hace:
1. `clearAuthCookie()`
2. `set({ operatorId: null })`
3. `router.push('/auth/login')`

El componente donde se coloca el botón de logout se determina durante implementación según el layout actual del dashboard.

---

## Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/types/wms.ts` | Modificar — agregar `email`, `passwordHash` a `Operator` |
| `src/data/seed.ts` | Modificar — agregar `email` + `passwordHash` a los 6 operadores |
| `src/store/auth-store.ts` | Crear |
| `src/lib/auth.ts` | Crear |
| `src/middleware.ts` | Crear |
| `src/app/auth/_components/login-form.tsx` | Modificar — conectar auth, labels ES |
| `src/app/auth/login/page.tsx` | Modificar — limpiar UI, texto es-CO |

---

## Out of scope

- Registro de nuevos usuarios (no aplica — operadores se crean en `/admin`)
- Recuperación de contraseña
- Roles y permisos por ruta (todas las rutas accesibles para cualquier operador autenticado)
- Backend real / JWT / sesiones servidor
