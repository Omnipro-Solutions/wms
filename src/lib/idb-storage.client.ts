'use client'

import type { StateStorage } from 'zustand/middleware'

/**
 * IndexedDB-backed key/value store used as the persistence layer for the WMS
 * Zustand store. Chosen over localStorage for the demo because it survives
 * reloads with far larger capacity (~hundreds of MB vs ~5 MB) and writes
 * asynchronously — so the growing StockMovement audit log never blocks the
 * main thread while serializing.
 *
 * Exposes the same StateStorage contract Zustand's `persist` expects, so it is
 * a drop-in replacement for `createJSONStorage(() => localStorage)`.
 */

const DB_NAME = 'wms-db'
const STORE_NAME = 'keyval'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

const getDb = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no disponible en este entorno'))
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> => {
  const db = await getDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = operation(tx.objectStore(STORE_NAME))
    tx.oncomplete = () => resolve(request.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const value = await runTransaction<string | undefined>('readonly', (store) => store.get(name))
      return value ?? null
    } catch {
      return null
    }
  },
  setItem: async (name, value) => {
    try {
      await runTransaction('readwrite', (store) => store.put(value, name))
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[idbStorage] Failed to write value:', error)
      }
    }
  },
  removeItem: async (name) => {
    try {
      await runTransaction('readwrite', (store) => store.delete(name))
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[idbStorage] Failed to remove value:', error)
      }
    }
  },
}
