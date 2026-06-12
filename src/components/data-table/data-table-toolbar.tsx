'use client'

import { type ReactNode } from 'react'
import { type Table } from '@tanstack/react-table'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from './data-table-view-options'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchColumn?: string
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  showViewOptions?: boolean
}

export const DataTableToolbar = <TData,>({
  table,
  searchColumn,
  searchPlaceholder = 'Buscar...',
  filters,
  actions,
  showViewOptions = true,
}: DataTableToolbarProps<TData>) => {
  const searchValue = searchColumn
    ? ((table.getColumn(searchColumn)?.getFilterValue() as string) ?? '')
    : ''

  const isFiltered = table.getState().columnFilters.length > 0 || !!table.getState().globalFilter

  const handleSearchChange = (value: string) => {
    if (!searchColumn) return
    table.getColumn(searchColumn)?.setFilterValue(value || undefined)
  }

  const handleReset = () => {
    table.resetColumnFilters()
    table.setGlobalFilter(undefined)
  }

  return (
    <div className="flex items-center justify-end gap-2 py-2">
      {/* Left group: search + filters + reset */}
      <div className="flex flex-wrap items-center gap-2">
        {searchColumn && (
          <div className="relative w-xl">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 pr-8 pl-8"
            />
            {searchValue && (
              <button
                onClick={() => handleSearchChange('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {filters}

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground h-8 px-2"
          >
            <X className="mr-1 size-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {showViewOptions && <DataTableViewOptions table={table} />}
      </div>
    </div>
  )
}
