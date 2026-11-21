import { rpc } from './supabase'
import type { Space, Scope, Membership, Notes, Snapshot } from '../domain/space'
import type { Workspace } from '../domain/workspace'

export const workspaceRepository = {
  list: () => rpc<Space[]>('mc_list_spaces'),
  create: (name: string) =>
    rpc<Space>('mc_create_space', { p_name: name.trim() }),
  join: (token: string) => rpc<Space>('mc_join_space', { p_token: token }),
  revision: (space: Space) => rpc<number>('mc_revision', { p_space: space.id }),
  invite: (space: Space) => rpc<string>('mc_invite', { p_space: space.id }),
  revokeInvites: (space: Space) =>
    rpc<void>('mc_revoke_invites', { p_space: space.id }),
  members: (space: Space) =>
    rpc<Membership[]>('mc_members', { p_space: space.id }),
  removeMember: (space: Space, userId: string) =>
    rpc<void>('mc_remove_member', { p_space: space.id, p_user: userId }),
  fetchSnapshot: (space: Space) =>
    rpc<Snapshot>('mc_workspace', { p_space: space.id }),
  saveSnapshot: (space: Space, revision: number, workspace: Workspace) =>
    rpc<Snapshot>('mc_save_workspace', {
      p_space: space.id,
      p_revision: revision,
      p_workspace: workspace,
    }),

  readNotes: (scope: Scope) =>
    rpc<Notes>('mc_notes', { p_space: scope.space.id }),
  writeNote: (scope: Scope, id: string, note: string, previous: string) =>
    rpc<void>('mc_save_note', {
      p_space: scope.space.id,
      p_song: id,
      p_note: note,
      p_previous: previous,
    }),
}

export const importWorkspace = (
  space: Space,
  revision: number,
  workspace: Workspace,
  notes: Notes
) =>
  rpc<Snapshot>('mc_import_workspace', {
    p_space: space.id,
    p_revision: revision,
    p_workspace: workspace,
    p_notes: notes,
  })
