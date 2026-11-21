import { Preferences } from '@capacitor/preferences'
import type { Workspace } from '../domain/workspace'
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
