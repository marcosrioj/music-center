import type { RepertoireServices } from '../features/repertoire/services'
import { newFileId } from '../platform/fileIds'
import { openScore, scoresFor } from '../data/scores'
import type { Scope } from '../domain/space'
import type { Plan, Song } from '../domain/workspace'

export function createRepertoireServices(
  scope: Scope,
  isActive: () => boolean
): RepertoireServices {
  const scores = scoresFor(scope, isActive)
  return {
    scores,
    openPdf: async (id: string) => openScore(await scores.read(id)),
    async importPlan(file: File) {
      const { importPlan } = await import('../application/planTransfer')
      return importPlan(file, scores, newFileId)
    },
    async sharePlan(plan: Plan, songs: Song[]) {
      const [{ sharePlan }, { base64, sendFile }] = await Promise.all([
        import('../application/planTransfer'),
        import('../platform/fileSharing'),
      ])
      return sharePlan(plan, songs, { scores, base64, sendFile })
    },
  }
}
