'use client'

import { type ReactNode, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'

interface DataTableProps<TData, TValue> {
  /** Column definitions (TanStack ColumnDef) */
  columns: ColumnDef<TData, TValue>[]
  /** Row data */
  data: TData[]
  /** Loading state — shows skeleton rows */
  isLoading?: boolean
  /** Column id used for the text search input */
  searchColumn?: string
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Extra filter controls (e.g. status <Select>) placed in the toolbar */
  filters?: ReactNode
  /** Action buttons placed at the right of the toolbar (e.g. export, create) */
  actions?: ReactNode
  /** Whether to show the column-visibility toggle */
  showViewOptions?: boolean
  /** Whether to enable row selection checkboxes */
  enableRowSelection?: boolean
  /** Callback fired when selected rows change */
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Default page size */
  defaultPageSize?: number
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Additional className for the outer container */
  className?: string
  /** Empty state message */
  emptyMessage?: string
  /** Custom empty state node (overrides emptyMessage when provided) */
  emptyState?: ReactNode
  /** Callback when a row is clicked (optional) */
  onRowClick?: (row: TData) => void
  /** Optional className per row based on row data */
  rowClassName?: (row: TData) => string
}

const SKELETON_ROWS = 5

export const DataTable = <TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchColumn,
  searchPlaceholder,
  filters,
  actions,
  showViewOptions = true,
  enableRowSelection = false,
  onRowSelectionChange,
  defaultPageSize = 20,
  pageSizeOptions,
  className,
  emptyMessage = 'Sin resultados.',
  emptyState,
  onRowClick,
  rowClassName,
}: DataTableProps<TData, TValue>) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    setRowSelection(updater)
    onRowSelectionChange?.(updater)
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: defaultPageSize },
    },
  })

  const showToolbar = searchColumn || filters || actions || showViewOptions

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {showToolbar && (
        <DataTableToolbar
          table={table}
          searchColumn={searchColumn}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          actions={actions}
          showViewOptions={showViewOptions}
        />
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'group hover:bg-muted/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className={cn(
                    'text-muted-foreground text-center',
                    emptyState ? 'p-0' : 'h-24'
                  )}
                >
                  {emptyState ?? emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  )
}
