import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import {
  currentScope,
  downloadScore,
  uploadScore,
  deleteScores,
  sameScope,
  type Scope,
} from '../online/service'

const storeName = 'scores'
let connection: Promise<IDBDatabase> | undefined

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('musiccenter-scores', 1)
      request.onupgradeneeded = () =>
        request.result.createObjectStore(storeName)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          connection = undefined
        }
        resolve(db)
      }
    }).catch((error: unknown) => {
      connection = undefined
      throw error
    })
  }
  return connection
}

export async function readLegacyScore(id: string): Promise<ArrayBuffer> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(id)
    request.onsuccess = () =>
      request.result
        ? resolve(request.result)
        : reject(new Error('PDF ausente'))
    request.onerror = () => reject(request.error)
  })
}

export async function openScore(data: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const loading = pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: true,
    cMapUrl: new URL('/vendor/cmaps/', window.location.href).href,
    cMapPacked: true,
    standardFontDataUrl: new URL(
      '/vendor/standard_fonts/',
      window.location.href
    ).href,
  })
  try {
    return await loading.promise
  } catch (error) {
    await loading.destroy().catch(() => {})
    throw error
  }
}

export async function storeScore(
  file: File,
  id: string,
  scope: Scope = currentScope()
) {
  const data = await file.arrayBuffer()
  // The PDF worker takes ownership of its buffer. Retain the original for IndexedDB.
  const document = await openScore(data.slice(0))
  try {
    if (document.numPages < 1) throw new Error('PDF sem páginas')
  } finally {
    await document.destroy()
  }
  if (!sameScope(scope)) throw new Error('O espaço mudou durante o envio.')
  await uploadScore(scope, id, data)
}

export function readScore(id: string, scope: Scope = currentScope()) {
  return downloadScore(scope, id)
}

export function removeScores(ids: string[], scope: Scope = currentScope()) {
  return deleteScores(scope, ids)
}
