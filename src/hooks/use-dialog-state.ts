import { useState } from 'react'

export interface DialogState<T> {
  data: T | null
  error: string
  open: (data: T) => void
  close: () => void
  setError: (msg: string) => void
  clearError: () => void
}

/**
 * Manages a dialog's open/close state together with its inline error message.
 * Closes the dialog and clears the error in a single call, avoiding the
 * repeated `setDialog(null); setError("")` pattern across every page.
 */
export function useDialogState<T>(): DialogState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setErrorState] = useState('')

  const open = (newData: T) => {
    setData(newData)
    setErrorState('')
  }

  const close = () => {
    setData(null)
    setErrorState('')
  }

  const setError = (msg: string) => setErrorState(msg)
  const clearError = () => setErrorState('')

  return { data, error, open, close, setError, clearError }
}
