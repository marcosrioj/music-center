import { migrateLocal } from '../application/migrateLocal'
import type { WorkspaceServices } from '../application/workspaces'
import { legacyWorkspace } from '../data/legacyWorkspace'
import { readLegacyScore } from '../data/scores'
import {
  workspaceRepository,
  importWorkspace,
} from '../data/workspaceRepository'
import { deleteScores, uploadScore } from '../data/scoreStorage'
import type { Scope } from '../domain/space'

let activeScope: Scope | undefined

export const workspaces: WorkspaceServices = {
  ...workspaceRepository,
  activateScores(scope) {
    activeScope = scope
  },
  sameScope(scope) {
    return (
      activeScope?.space.id === scope.space.id &&
      activeScope?.userId === scope.userId
    )
  },
  deleteScores,
  legacyWorkspace,
  migrateLocal: (scope) =>
    migrateLocal(scope, {
      load: legacyWorkspace,
      fetchSnapshot: workspaceRepository.fetchSnapshot,
      readFile: readLegacyScore,
      upload: uploadScore,
      remove: deleteScores,
      newId: () => crypto.randomUUID(),
      importWorkspace,
    }),
}
