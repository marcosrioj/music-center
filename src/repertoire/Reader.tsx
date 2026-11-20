import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Minus,
  Music2,
  NotebookPen,
  Plus,
  X,
} from 'lucide-react'
import type { Song } from '../model'
import { Metronome } from './Metronome'
import { SongChart, transpose } from './music'
import { PdfPage } from './PdfPage'

type ReaderProps = {
  songs: Song[]
  initialIndex: number
  onClose: () => void
  onSave: (song: Song, previous: string) => void | Promise<void>
  planTitle?: string
}
type Mode = 'chart' | 'pdf'

function Notes({
  song,
  onSave,
  onClose,
}: {
  song: Song
  onSave: (song: Song, previous: string) => void | Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState(song.notes)
  const previous = useRef(song.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    element
      .querySelector<HTMLElement>('textarea')
      ?.focus({ preventScroll: true })
    return () => {
      if (typeof element.close === 'function') element.close()
    }
  }, [])
  return (
    <dialog
      className="rep-dialog rep-notes-dialog"
      ref={dialog}
      aria-labelledby="rep-notes-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onClose()
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) {
          if (saving) event.currentTarget.showModal()
          else onClose()
        }
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (saving) return
          setSaving(true)
          try {
            await onSave({ ...song, notes: text }, previous.current)
            onClose()
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : 'Não foi possível salvar as anotações na sua conta.'
            )
          } finally {
            setSaving(false)
          }
        }}
      >
        <div className="rep-dialog-head">
          <h2 id="rep-notes-title">Minhas anotações</h2>
          <button
            className="rep-icon"
            type="button"
            aria-label="Fechar anotações"
            disabled={saving}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <fieldset disabled={saving}>
          <label>
            {song.title}
            <textarea
              rows={8}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Entradas, pausas e lembretes para o ensaio"
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="rep-error">
            {error}
          </p>
        )}
        <div className="rep-form-end">
          <button
            className="rep-quiet"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="rep-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar anotações'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function Stage({
  song,
  index,
  total,
  planTitle,
  onExit,
  onSong,
  onSave,
}: {
  song: Song
  index: number
  total: number
  planTitle?: string
  onExit: () => void
  onSong: (index: number) => void
  onSave: (song: Song, previous: string) => void | Promise<void>
}) {
  const [selectedMode, setMode] = useState<Mode>(
    song.pdfId && !song.chart.trim() ? 'pdf' : 'chart'
  )
  const mode = selectedMode === 'pdf' && !song.pdfId ? 'chart' : selectedMode
  const [steps, setSteps] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [notes, setNotes] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const preferFlats = /b|♭|^F(?:m)?$/.test(song.key)
  const currentKey = transpose(song.key, steps, preferFlats)
  useEffect(() => {
    setPage(1)
    setPages(0)
  }, [song.pdfId])
  const pageBack = mode === 'pdf' && page > 1
  const pageNext = mode === 'pdf' && page < pages
  const turn = useCallback(
    (direction: number) => {
      if ((direction < 0 && pageBack) || (direction > 0 && pageNext))
        setPage((value) => value + direction)
      else if (index + direction >= 0 && index + direction < total)
        onSong(index + direction)
    },
    [index, onSong, pageBack, pageNext, total]
  )
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        notes ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      )
        return
      if (
        ['ArrowLeft', 'PageUp', 'ArrowRight', 'PageDown'].includes(event.key)
      ) {
        event.preventDefault()
        turn(['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 1)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [notes, onExit, turn])
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [mode, page])
  return (
    <main className="rep-reader">
      <header className="rep-stage-head">
        <button
          className="rep-icon"
          onClick={onExit}
          aria-label="Sair da estante"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="rep-stage-context">
          <BookOpen size={18} />
          <strong>Estante</strong>
          {planTitle && (
            <>
              <i />
              <span>{planTitle}</span>
            </>
          )}
        </div>
        <button
          className="rep-note-toggle"
          onClick={() => setNotes(true)}
          aria-label="Minhas anotações"
        >
          <NotebookPen size={18} />
          <span>Anotações</span>
        </button>
      </header>
      <div className="rep-stage-scroll" ref={scroller}>
        <article className="rep-sheet">
          <div className="rep-sheet-heading">
            <div>
              <h1>{song.title}</h1>
              {song.artist && <p>{song.artist}</p>}
            </div>
            <span className="rep-meter" title="Compasso">
              <Music2 size={17} /> {song.meter}
            </span>
          </div>
          <div className="rep-sheet-tools">
            <div
              className="rep-format"
              role="group"
              aria-label="Formato da música"
            >
              <button
                aria-pressed={mode === 'chart'}
                onClick={() => setMode('chart')}
              >
                <Music2 size={15} /> Letra e cifra
              </button>
              {song.pdfId && (
                <button
                  aria-pressed={mode === 'pdf'}
                  onClick={() => setMode('pdf')}
                >
                  <FileText size={15} /> PDF
                </button>
              )}
            </div>
            {mode === 'chart' && (
              <div
                className="rep-stepper rep-key"
                role="group"
                aria-label="Transpor cifra"
              >
                <button
                  className="rep-small-icon"
                  aria-label="Baixar um semitom"
                  disabled={steps <= -12}
                  onClick={() => setSteps((v) => v - 1)}
                >
                  <Minus size={15} />
                </button>
                <span>
                  Tom <strong>{currentKey}</strong>
                </span>
                <button
                  className="rep-small-icon"
                  aria-label="Subir um semitom"
                  disabled={steps >= 12}
                  onClick={() => setSteps((v) => v + 1)}
                >
                  <Plus size={15} />
                </button>
              </div>
            )}
          </div>
          {mode === 'chart' ? (
            song.chart.trim() ? (
              <SongChart
                value={song.chart}
                steps={steps}
                preferFlats={preferFlats}
              />
            ) : (
              <div className="rep-empty">
                <FileText size={30} />
                <h2>Sem letra ou cifra</h2>
                <p>
                  A equipe ainda não incluiu uma letra ou cifra nesta música.
                </p>
              </div>
            )
          ) : (
            song.pdfId && (
              <div>
                <PdfPage fileId={song.pdfId} page={page} onPages={setPages} />
                {pages > 0 && (
                  <nav
                    className="rep-pdf-nav"
                    aria-label="Páginas da partitura"
                  >
                    <button
                      className="rep-icon"
                      disabled={page <= 1}
                      aria-label="Página anterior"
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft />
                    </button>
                    <span>
                      Página {page} de {pages}
                    </span>
                    <button
                      className="rep-icon"
                      disabled={page >= pages}
                      aria-label="Próxima página"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight />
                    </button>
                  </nav>
                )}
              </div>
            )
          )}
        </article>
      </div>
      <footer className="rep-stage-footer">
        <div className="rep-stage-footer-inner">
          <Metronome initialBpm={song.bpm} meter={song.meter} />
          <div className="rep-song-navigation">
            <button
              className="rep-icon"
              disabled={index === 0}
              aria-label="Música anterior"
              onClick={() => onSong(index - 1)}
            >
              <ChevronLeft />
            </button>
            <span aria-live="polite">
              {index + 1} <small>de</small> {total}
            </span>
            <button
              className="rep-icon"
              disabled={index + 1 === total}
              aria-label="Próxima música"
              onClick={() => onSong(index + 1)}
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </footer>
      {notes && (
        <Notes song={song} onSave={onSave} onClose={() => setNotes(false)} />
      )}
    </main>
  )
}

export function Reader({
  songs,
  initialIndex,
  onClose,
  onSave,
  planTitle,
}: ReaderProps) {
  const [position, setPosition] = useState(initialIndex)
  const index = Math.min(Math.max(0, position), songs.length - 1)
  const song = songs[index]
  if (!song)
    return (
      <main className="rep-reader">
        <div className="rep-empty">
          <BookOpen />
          <h1>Estante vazia</h1>
          <button className="rep-primary" onClick={onClose}>
            Voltar
          </button>
        </div>
      </main>
    )
  return (
    <Stage
      key={index + '-' + song.id}
      song={song}
      index={index}
      total={songs.length}
      planTitle={planTitle}
      onExit={onClose}
      onSong={setPosition}
      onSave={onSave}
    />
  )
}
