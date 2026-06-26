'use client'

import { type Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

function getPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, i) => i + 1)
  if (currentPage <= 2) return [1, 2, 3]
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount]
  return [currentPage - 1, currentPage, currentPage + 1]
}

export const DataTablePagination = <TData,>({
  table,
  pageSizeOptions = [10, 20, 30, 50],
}: DataTablePaginationProps<TData>) => {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length
  const pageCount = Math.max(table.getPageCount(), 1)
  const currentPage = Math.min(table.getState().pagination.pageIndex + 1, pageCount)
  const pageNumbers = getPageNumbers(currentPage, pageCount)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Separator />

      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <span>Filas por página</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20">
                <SelectValue placeholder={`${table.getState().pagination.pageSize}`} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span>
            {selectedCount > 0
              ? `${selectedCount} de ${totalCount} seleccionada(s)`
              : `Página ${currentPage} de ${pageCount}`}
          </span>
        </div>

        <nav className="flex items-center gap-1" aria-label="Paginación">
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-8', !table.getCanPreviousPage() && 'pointer-events-none opacity-50')}
            onClick={() => table.previousPage()}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {pageNumbers[0] > 1 && (
            <span className="text-muted-foreground flex size-8 items-center justify-center">
              <MoreHorizontal className="size-4" />
            </span>
          )}

          {pageNumbers.map((pageNumber) => (
            <Button
              key={`page-${pageNumber}`}
              variant={currentPage === pageNumber ? 'outline' : 'ghost'}
              size="icon"
              className="size-8 text-sm"
              onClick={() => table.setPageIndex(pageNumber - 1)}
              aria-label={`Página ${pageNumber}`}
              aria-current={currentPage === pageNumber ? 'page' : undefined}
            >
              {pageNumber}
            </Button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < pageCount && (
            <span className="text-muted-foreground flex size-8 items-center justify-center">
              <MoreHorizontal className="size-4" />
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn('size-8', !table.getCanNextPage() && 'pointer-events-none opacity-50')}
            onClick={() => table.nextPage()}
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      </div>
    </div>
  )
}
