import type { Workspace } from '../domain/workspace'
import {
  publicWorkspace,
  type Scope,
  type Space,
  type Snapshot,
  type Notes,
} from '../domain/space.ts'

export interface MigrationPorts {
  load(): Promise<Workspace | null>
  fetchSnapshot(space: Space): Promise<Snapshot>
  readFile(id: string): Promise<ArrayBuffer>
  upload(scope: Scope, id: string, data: ArrayBuffer): Promise<void>
  remove(scope: Scope, ids: string[]): Promise<void>
  newId(): string
  importWorkspace(
    space: Space,
    revision: number,
    workspace: Workspace,
    notes: Notes
  ): Promise<Snapshot>
}

export async function migrateLocal(scope: Scope, ports: MigrationPorts) {
  const legacy = await ports.load()
  if (!legacy)
    throw new Error('Este aparelho não tem acervo local para importar.')
  const original = await ports.fetchSnapshot(scope.space)
  if (original.workspace.plans.length || original.workspace.songs.length)
    throw new Error('A importação do acervo local precisa de um espaço vazio.')
  const ids = new Map<string, string>()
  const uploaded: string[] = []
  try {
    for (const song of legacy.songs) {
      if (!song.pdfId || ids.has(song.pdfId)) continue
      const newId = ports.newId()
      await ports.upload(scope, newId, await ports.readFile(song.pdfId))
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
    return await ports.importWorkspace(
      scope.space,
      original.revision,
      publicWorkspace(migrated),
      Object.fromEntries(
        migrated.songs
          .filter((song) => song.notes)
          .map((song) => [song.id, song.notes])
      )
    )
  } catch (error) {
    await ports.remove(scope, uploaded).catch(() => {})
    throw error
  }
}
