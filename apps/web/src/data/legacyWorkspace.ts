import { Preferences } from '@capacitor/preferences'
import type { Workspace } from '../domain/workspace'
import { readLegacyScore } from './scores'
import {
  deleteScores,
  fetchSnapshot,
  publicWorkspace,
  rpc,
  uploadScore,
  type Snapshot,
  type Scope,
} from './supabase'

// The original local installation remains intact until the owner chooses to import it.
export async function legacyWorkspace(): Promise<Workspace | null> {
  const { value } = await Preferences.get({ key: 'musiccenter.workspace.v1' })
  if (!value) return null
  const data = JSON.parse(value)
  if (
    data?.version !== 1 ||
    !Array.isArray(data.plans) ||
    !Array.isArray(data.songs)
  ) {
    throw new Error('O formato do acervo local é desconhecido.')
  }
  return data
}

export async function migrateLocal(scope: Scope) {
  const legacy = await legacyWorkspace()
  if (!legacy)
    throw new Error('Este aparelho não tem acervo local para importar.')
  const original = await fetchSnapshot(scope.space)
  if (original.workspace.plans.length || original.workspace.songs.length)
    throw new Error('A importação do acervo local precisa de um espaço vazio.')
  const ids = new Map<string, string>()
  const uploaded: string[] = []
  try {
    for (const song of legacy.songs) {
      if (!song.pdfId || ids.has(song.pdfId)) continue
      const newId = crypto.randomUUID()
      await uploadScore(scope, newId, await readLegacyScore(song.pdfId))
      ids.set(song.pdfId, newId)
      uploaded.push(newId)
    }
    const migrated = {
      ...legacy,
      songs: legacy.songs.map((s) => ({
        ...s,
        ...(s.pdfId ? { pdfId: ids.get(s.pdfId) } : {}),
      })),
    }
    return await rpc<Snapshot>('mc_import_workspace', {
      p_space: scope.space.id,
      p_revision: original.revision,
      p_workspace: publicWorkspace(migrated),
      p_notes: Object.fromEntries(
        migrated.songs.filter((s) => s.notes).map((s) => [s.id, s.notes])
      ),
    })
  } catch (error) {
    await deleteScores(scope, uploaded).catch(() => {})
    throw error
  }
}
