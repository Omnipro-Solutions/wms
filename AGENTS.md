<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WMS Project — React & shadcn/ui Standards

## Mandatory patterns

**Arrow functions everywhere:**
```tsx
// Correct
const ReceivingPage = () => { ... }
const useInventoryStore = () => { ... }
const handleSubmit = () => { ... }

// Wrong
function ReceivingPage() { ... }
```

**Clause guards — always before the happy path:**
```tsx
const ProductRow = ({ product, isLoading, error }: Props) => {
  if (isLoading) return <TableSkeleton />
  if (error) return <ErrorBanner message={error.message} />
  if (!product) return null

  return <TableRow>...</TableRow>
}
```

**cn() for class merging:**
```tsx
// Correct
<div className={cn("base-class", isActive && "active", className)}>

// Wrong
<div className={`base-class ${isActive ? "active" : ""} ${className}`}>
```

## WMS-specific rules
- Warehouse domain types live in `src/types/` — reuse them, don't redefine inline
- Store actions in Zustand must be arrow functions inside the `create()` call
- Page components in `src/app/` are the only place where default exports are allowed
- Data tables use shadcn `<Table>` with clause guards for empty/loading/error states before rendering rows
- Forms use react-hook-form + zod schema — never manage form state with raw `useState`
