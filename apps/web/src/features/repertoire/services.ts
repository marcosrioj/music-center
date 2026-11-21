import type { ScoreFiles } from '../../application/scoreFiles'
import type { Plan, Song } from '../../domain/workspace'
import type { OpenPdf } from './PdfPage'

export interface RepertoireServices {
  scores: ScoreFiles
  openPdf: OpenPdf
  importPlan(file: File): Promise<{ plan: Plan; songs: Song[] }>
  sharePlan(plan: Plan, songs: Song[]): Promise<void>
}
