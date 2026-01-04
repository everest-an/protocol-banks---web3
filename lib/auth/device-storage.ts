/**
 * Device Storage (IndexedDB)
 *
 * Securely stores device share in browser's IndexedDB
 * Bound to device fingerprint for additional security
 */

const DB_NAME = "protocol_bank_auth"
const DB_VERSION = 1
const STORE_NAME = "device_shares"

interface StoredDeviceShare {
  id: string
  walletAddress: string
  encrypted: string
  iv: string
  createdAt: number
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

/**
 * Store device share in IndexedDB
 */
export async function storeDeviceShare(
  walletAddress: string,
  deviceShare: { encrypted: string; iv: string },
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    const data: StoredDeviceShare = {
      id: walletAddress.toLowerCase(),
      walletAddress: walletAddress.toLowerCase(),
      encrypted: deviceShare.encrypted,
      iv: deviceShare.iv,
      createdAt: Date.now(),
    }

    const request = store.put(data)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get device share from IndexedDB
 */
export async function getDeviceShare(walletAddress: string): Promise<{ encrypted: string; iv: string } | null> {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(walletAddress.toLowerCase())

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result as StoredDeviceShare | undefined
        if (result) {
          resolve({ encrypted: result.encrypted, iv: result.iv })
        } else {
          resolve(null)
        }
      }
    })
  } catch {
    return null
  }
}

/**
 * Delete device share from IndexedDB
 */
export async function deleteDeviceShare(walletAddress: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(walletAddress.toLowerCase())

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Check if device share exists
 */
export async function hasDeviceShare(walletAddress: string): Promise<boolean> {
  const share = await getDeviceShare(walletAddress)
  return share !== null
}

/**
 * Clear all device shares (for logout)
 */
export async function clearAllDeviceShares(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
