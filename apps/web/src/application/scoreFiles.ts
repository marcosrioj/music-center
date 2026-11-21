import type { Song } from '../domain/workspace'

export interface ScoreFiles {
  read(id: string): Promise<ArrayBuffer>
  store(file: File, id: string): Promise<void>
  remove(ids: string[]): Promise<void>
}

type SongEdit = {
  original: Song
  draft: Song
  file?: File
  retainPreviousPdf: boolean
  newId: () => string
  persist: (song: Song) => void | Promise<void>
}

export async function saveSongWithScore(
  scores: Pick<ScoreFiles, 'store' | 'remove'>,
  edit: SongEdit
) {
  const song = { ...edit.draft }
  let uploaded: string | undefined
  if (edit.file) {
    const id = edit.newId()
    try {
      await scores.store(edit.file, id)
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException')
        throw new Error('Importe uma cópia do PDF que abra sem senha.')
      throw new Error(
        'Falha ao importar o PDF. Verifique o arquivo e tente novamente.'
      )
    }
    uploaded = id
    song.pdfId = id
    song.pdfName = edit.file.name
  }
  try {
    await edit.persist(song)
  } catch (error) {
    if (uploaded) await scores.remove([uploaded]).catch(() => {})
    throw error
  }
  const previous = edit.original.pdfId
  if (previous && previous !== song.pdfId && !edit.retainPreviousPdf) {
    void scores.remove([previous]).catch(() => {})
  }
}
