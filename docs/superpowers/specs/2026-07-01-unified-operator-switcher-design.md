# Selector unificado de operador (demo multi-rol)

## Problema

La demo requiere cambiar rápidamente entre operadores (supervisor, receiver, picker, packer, driver) para mostrar cada vista al cliente, en una sola sesión de navegador.

Hoy existen dos mecanismos inconsistentes:

- **Desktop** (`(app)` layout): `OperatorPickerProvider` + `useOperatorPicker().openPicker()` — cambia `currentOperatorId` directo en `wms-store`, sin login real. Ya no está conectado a ninguna UI (dead code desde los commits `c5ce7b8` y `663554c`).
- **Worker** (`(worker)` layout): `WorkerHeader` hace `logout()` + `login()` async real, pero solo lista 4 roles worker (sin supervisor) y siempre redirige a `/worker`.

`src/middleware.ts` redirige duro por la cookie `wms-operator-role`: roles worker nunca ven `/`, roles no-worker nunca ven `/worker`. Esto es por lo que el mecanismo instantáneo (sin login real) se quitó — dejaba `currentOperatorId` (wms-store) desincronizado de `authOperatorId`/cookie (auth-store), y el middleware rebotaba al usuario. Cualquier solución nueva debe pasar por el flujo de login real.

## Diseño

**Componente compartido: `OperatorSwitcher`**

Nuevo archivo `src/components/shared/operator-switcher.tsx`. Dialog con los 5 operadores demo (incluye supervisor). Reemplaza la lista `DEMO_ROLES` que hoy vive dentro de `worker-header.tsx`.

```ts
const DEMO_OPERATORS = [
  { role: 'supervisor', label: 'Supervisor',    name: 'Carlos Granados',     email: 'carlos.granados@wms.co', password: 'WMS2024' },
  { role: 'receiver',   label: 'Recepcionista', name: 'María Recepcionista', email: 'receiver@demo.com',      password: '123456' },
  { role: 'picker',     label: 'Picker',        name: 'Ana Picker',          email: 'picker@demo.com',        password: '123456' },
  { role: 'packer',     label: 'Empacador',     name: 'Pedro Packer',        email: 'packer@demo.com',        password: '123456' },
  { role: 'driver',     label: 'Conductor',     name: 'Carlos Driver',       email: 'driver@demo.com',        password: '123456' },
]
```

`handleSwitch(email, password, role)`:
1. `logout()` (auth-store)
2. `await login(email, password, false)`
3. Si `success`:
   - role es worker (`picker`/`packer`/`receiver`/`driver`) → `router.push(resolveWorkerRoute(role))`
   - role es `supervisor` → si `pathname` ya empieza con `/worker`, `router.push('/')`; si no, `router.push(pathname)` (refresca la vista actual con el nuevo operador)
4. Cierra el dialog

El componente recibe `trigger` como prop (o se controla con `open`/`onOpenChange`) para poder montarse tanto desde `HeaderActions` (desktop) como desde `WorkerHeader` (móvil) sin duplicar el dialog.

**Cambios en archivos existentes:**

- `src/components/worker/worker-header.tsx`: quita `DEMO_ROLES`, `handleSwitchRole`, el `Dialog` inline — usa `<OperatorSwitcher>`. Mantiene el botón 👥 como trigger.
- `src/components/sidebar/header-actions.tsx`: agrega item "Cambiar operador" (ícono `RefreshCwIcon`) en el `DropdownMenu` del avatar, mismo lugar donde vivía antes de `c5ce7b8`. Abre `<OperatorSwitcher>`.

**Eliminado (dead code, ya no aplica con el flujo de login real):**

- `src/components/layout/operator-picker-provider.tsx`
- `src/components/shared/operator-picker.tsx`
- Su uso en `src/app/(app)/layout.tsx` (`<OperatorPickerProvider>` wrapper)

**Fuera de alcance:** cambiar `middleware.ts`, mostrar dos vistas simultáneas (desktop+móvil) en una sola pantalla — se descartó por requerir tocar el middleware (mayor riesgo) a cambio de un beneficio marginal sobre "cambiar rápido con un click".

## Testing

- Verificación manual: desde `/` (supervisor) → abrir dropdown avatar → "Cambiar operador" → seleccionar Picker → confirma redirect a ruta picker worker.
- Desde `/worker/picking` → botón 👥 → seleccionar Supervisor → confirma redirect a `/`.
- Cambiar entre dos roles worker (picker → packer) → confirma redirect correcto sin pasar por desktop.
- No hay lógica pura nueva en `lib/rules/` — no aplica test unitario ahí.

## Actualización de DEMO-SCRIPT.md

Actualizar el tip de la sección "Preparación" para reflejar que el switcher ahora incluye supervisor y vive tanto en desktop (dropdown avatar) como en móvil (botón 👥), permitiendo cambiar de rol sin manejar pestañas separadas del navegador.
