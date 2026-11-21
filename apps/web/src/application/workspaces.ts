import type { Workspace } from '../domain/workspace'
import type { Space, Scope, Snapshot, Membership, Notes } from '../domain/space'

export interface WorkspaceServices {
  list(): Promise<Space[]>
  create(name: string): Promise<Space>
  join(token: string): Promise<Space>
  invite(space: Space): Promise<string>
  revokeInvites(space: Space): Promise<void>
  members(space: Space): Promise<Membership[]>
  removeMember(space: Space, userId: string): Promise<void>
  revision(space: Space): Promise<number>
  fetchSnapshot(space: Space): Promise<Snapshot>
  saveSnapshot(
    space: Space,
    revision: number,
    workspace: Workspace
  ): Promise<Snapshot>
  readNotes(scope: Scope): Promise<Notes>
  writeNote(
    scope: Scope,
    songId: string,
    text: string,
    previous: string
  ): Promise<void>
  legacyWorkspace(): Promise<Workspace | null>
  migrateLocal(scope: Scope): Promise<Snapshot>
  deleteScores(scope: Scope, ids: string[]): Promise<void>
  activateScores(scope?: Scope): void
  sameScope(scope: Scope): boolean
}
