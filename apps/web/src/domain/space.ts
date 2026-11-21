import type { Workspace } from './workspace'

export type Space = { id: string; name: string; role: 'admin' | 'member' }
export type Membership = { id: string; email: string; role: 'admin' | 'member' }
export type Snapshot = { revision: number; workspace: Workspace }
export type Scope = { space: Space; userId: string }
export type Notes = Record<string, string>

export function publicWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    songs: workspace.songs.map((song) => ({ ...song, notes: '' })),
  }
}
export const withNotes = (workspace: Workspace, notes: Notes): Workspace => ({
  ...workspace,
  songs: workspace.songs.map((song) => ({
    ...song,
    notes: Object.hasOwn(notes, song.id) ? notes[song.id] : '',
  })),
})
