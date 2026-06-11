"use client"

import { type ReactNode } from "react"
import { type Table } from "@tanstack/react-table"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  /** Column id to use for the global search input */
  searchColumn?: string
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Extra filter controls rendered to the right of the search input (e.g. status selects) */
  filters?: ReactNode
  /** Extra action buttons rendered at the far right (e.g. export, create) */
  actions?: ReactNode
  /** Whether to show the column-visibility toggle */
  showViewOptions?: boolean
}

export const DataTableToolbar = <TData,>({
  table,
  searchColumn,
  searchPlaceholder = "Buscar...",
  filters,
  actions,
  showViewOptions = true,
}: DataTableToolbarProps<TData>) => {
  const searchValue =
    searchColumn
      ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
      : ""

  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    !!table.getState().globalFilter

  const handleSearchChange = (value: string) => {
    if (!searchColumn) return
    table.getColumn(searchColumn)?.setFilterValue(value || undefined)
  }

  const handleReset = () => {
    table.resetColumnFilters()
    table.setGlobalFilter(undefined)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {/* Search input */}
      {searchColumn && (
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 pr-8"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Extra filter controls */}
      {filters && (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      )}

      {/* Reset filters button */}
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 px-2 text-muted-foreground"
        >
          <X className="mr-1 size-3.5" />
          Limpiar filtros
        </Button>
      )}

      {/* Right-side actions + view toggle */}
      <div className="ml-auto flex items-center gap-2">
        {actions}
        {showViewOptions && <DataTableViewOptions table={table} />}
      </div>
    </div>
  )
}
