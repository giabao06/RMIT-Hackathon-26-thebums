import type { StaffKey } from './keys'

/** The private key is a non-extractable CryptoKey, so IndexedDB holds it without ever exposing its bytes. */
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('safethreshold', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('keys')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction('keys', mode).objectStore('keys'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const loadKey = (userId: string) => run('readonly', (s) => s.get(userId) as IDBRequest<StaffKey | undefined>)
export const saveKey = (userId: string, key: StaffKey) => run('readwrite', (s) => s.put(key, userId))
