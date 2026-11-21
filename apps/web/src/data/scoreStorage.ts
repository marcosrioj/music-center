import { db, humanError } from './supabase'
import type { Scope } from '../domain/space'

const scoreBucket = 'musiccenter-scores'
function scorePath(scope: Scope, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new Error('Identificador de partitura inválido.')
  return scope.space.id + '/' + id
}
export async function uploadScore(scope: Scope, id: string, data: ArrayBuffer) {
  if (scope.space.role !== 'admin')
    throw new Error('Apenas a administração pode enviar partituras.')
  const { error } = await db()
    .storage.from(scoreBucket)
    .upload(
      scorePath(scope, id),
      new Blob([data], { type: 'application/pdf' }),
      { contentType: 'application/pdf', upsert: false }
    )
  if (error) throw humanError(error)
}
export async function downloadScore(scope: Scope, id: string) {
  const { data, error } = await db()
    .storage.from(scoreBucket)
    .download(scorePath(scope, id))
  if (error) throw humanError(error)
  return data.arrayBuffer()
}
export async function deleteScores(scope: Scope, ids: string[]) {
  if (!ids.length) return
  const { error } = await db()
    .storage.from(scoreBucket)
    .remove(ids.map((id) => scorePath(scope, id)))
  if (error) throw humanError(error)
}
