import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  FileMusic,
  FileText,
  Music2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { Song } from '../../domain/workspace'
import { removeScores, storeScore } from '../../data/scores'

function uid() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const meters = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8']
const tonalities = [...keys, ...keys.map((note) => note + 'm')]
const newSong = (): Song => ({
  id: uid(),
  title: '',
  artist: '',
  key: 'C',
  bpm: 80,
  meter: '4/4',
  chart: '',
  notes: '',
})
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

type LibraryProps = {
  readOnly?: boolean
  songs: Song[]
  onDelete: (song: Song) => Promise<void>
  onSave: (song: Song) => void | Promise<void>
  onOpen: (song: Song) => void
  onClose?: () => void
}

function SongEditor({
  source,
  isNew,
  retainPreviousPdf,
  onDismiss,
  onSave,
  onDelete,
}: {
  source: Song
  isNew: boolean
  retainPreviousPdf: boolean
  onDelete: (song: Song) => Promise<void>
  onDismiss: () => void
  onSave: (song: Song) => void | Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(source)
  const [tempoText, setTempoText] = useState(String(source.bpm))
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const cancelDeletion = useRef<HTMLButtonElement>(null)
  const returningToEditor = useRef(false)
  useEffect(() => {
    if (confirmDelete) cancelDeletion.current?.focus()
    else if (returningToEditor.current) {
      deleteTrigger.current?.focus()
      returningToEditor.current = false
    }
  }, [confirmDelete])
  const busy = useRef(false)
  useEffect(() => {
    const element = dialog.current!
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    element
      .querySelector<HTMLElement>('input:not([type=file])')
      ?.focus({ preventScroll: true })
    return () => {
      if (typeof element.close === 'function') element.close()
    }
  }, [])
  function field<K extends keyof Song>(key: K, value: Song[K]) {
    setDraft((song) => ({ ...song, [key]: value }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    if (!draft.title.trim()) {
      setError('Informe o título da música.')
      return
    }
    setError('')
    setSaving(true)
    busy.current = true
    let validatingPdf = !!file
    let newScoreId: string | undefined
    try {
      const song = {
        ...draft,
        title: draft.title.trim(),
        artist: draft.artist.trim(),
        bpm: Number(tempoText),
      }
      if (file) {
        const id = uid()
        await storeScore(file, id)
        newScoreId = id
        song.pdfId = id
        song.pdfName = file.name
      }
      validatingPdf = false
      await onSave(song)
      newScoreId = undefined
      if (source.pdfId && source.pdfId !== song.pdfId && !retainPreviousPdf) {
        void removeScores([source.pdfId]).catch(() => {})
      }
      onDismiss()
    } catch (reason) {
      // The song write failed, so this attachment has no durable reference.
      if (newScoreId) await removeScores([newScoreId]).catch(() => {})
      const password =
        reason instanceof Error && reason.name === 'PasswordException'
      setError(
        password
          ? 'Importe uma cópia do PDF que abra sem senha.'
          : validatingPdf
            ? 'Falha ao importar o PDF. Verifique o arquivo e tente novamente.'
            : reason instanceof Error
              ? reason.message
              : 'Não foi possível salvar a música. Tente novamente.'
      )
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  function returnToEditor() {
    returningToEditor.current = true
    setConfirmDelete(false)
    setError('')
  }
  async function deleteConfirmed() {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      await onDelete(source)
      onDismiss()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível excluir esta música.'
      )
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const attachment =
    file?.name ?? draft.pdfName ?? (draft.pdfId ? 'Partitura.pdf' : '')
  return (
    <dialog
      ref={dialog}
      aria-labelledby="rep-editor-title"
      className="rep-dialog"
      onClose={(event) => {
        if (event.currentTarget.open) return
        if (busy.current || confirmDelete) event.currentTarget.showModal()
        if (!busy.current) {
          if (confirmDelete) returnToEditor()
          else onDismiss()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy.current) {
          if (confirmDelete) returnToEditor()
          else onDismiss()
        }
      }}
    >
      {confirmDelete ? (
        <div className="rep-delete-panel">
          <h2 id="rep-editor-title">Excluir música?</h2>
          <p>Excluir “{source.title}” do repertório da equipe?</p>
          {error && (
            <p className="rep-error" role="alert">
              {error}
            </p>
          )}
          <div className="rep-form-end">
            <button
              type="button"
              ref={cancelDeletion}
              className="rep-quiet"
              disabled={saving}
              onClick={returnToEditor}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rep-primary rep-delete-confirm"
              disabled={saving}
              onClick={() => void deleteConfirmed()}
            >
              {saving ? 'Excluindo…' : 'Excluir música'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="rep-dialog-head">
            <h2 id="rep-editor-title">
              {isNew ? 'Nova música' : 'Editar música'}
            </h2>
            <button
              type="button"
              className="rep-icon"
              aria-label="Fechar edição"
              disabled={saving}
              onClick={onDismiss}
            >
              <X />
            </button>
          </div>
          <fieldset disabled={saving}>
            <label>
              Título
              <input
                autoFocus
                maxLength={180}
                required
                value={draft.title}
                onChange={(e) => field('title', e.target.value)}
              />
            </label>
            <label>
              Artista ou compositor
              <input
                maxLength={180}
                value={draft.artist}
                onChange={(e) => field('artist', e.target.value)}
              />
            </label>
            <div className="rep-fields">
              <label>
                Tom
                <select
                  value={draft.key}
                  onChange={(e) => field('key', e.target.value)}
                >
                  {[...new Set([draft.key, ...tonalities])]
                    .filter(Boolean)
                    .map((key) => (
                      <option key={key}>{key}</option>
                    ))}
                </select>
              </label>
              <label>
                BPM
                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={300}
                  step="1"
                  value={tempoText}
                  onChange={(e) => setTempoText(e.target.value)}
                />
              </label>
              <label>
                Compasso
                <select
                  value={draft.meter}
                  onChange={(e) => field('meter', e.target.value)}
                >
                  {[...new Set([...meters, draft.meter])]
                    .filter(Boolean)
                    .map((meter) => (
                      <option key={meter}>{meter}</option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              Letra e cifra
              <textarea
                value={draft.chart}
                rows={5}
                onChange={(e) => field('chart', e.target.value)}
                placeholder={'[Verso]\n[C]Acorde acima da [G]palavra'}
              />
            </label>
            <div className="rep-file-block">
              <span>Partitura em PDF</span>
              <div className="rep-file-row">
                <label className="rep-file">
                  <Upload size={18} />
                  <span>{attachment || 'Escolher arquivo'}</span>
                  <input
                    type="file"
                    aria-label="Selecionar PDF"
                    accept=".pdf,application/pdf"
                    onChange={(event) => {
                      const selected = event.target.files?.[0]
                      if (!selected) return
                      if (selected.size > 50 * 1024 * 1024) {
                        setError('Escolha um PDF de até 50 MB.')
                        event.target.value = ''
                        return
                      }
                      setFile(selected)
                      setError('')
                      event.target.value = ''
                    }}
                  />
                </label>
                {attachment && (
                  <button
                    aria-label="Remover anexo"
                    className="rep-icon"
                    type="button"
                    onClick={() => {
                      setFile(undefined)
                      setDraft((song) => ({
                        ...song,
                        pdfId: undefined,
                        pdfName: undefined,
                      }))
                    }}
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            </div>
          </fieldset>
          {error && (
            <p className="rep-error" role="alert">
              {error}
            </p>
          )}
          <div className="rep-form-end">
            {!isNew && (
              <button
                ref={deleteTrigger}
                className="rep-quiet rep-delete"
                type="button"
                disabled={saving}
                onClick={() => {
                  setError('')
                  setConfirmDelete(true)
                }}
              >
                <Trash2 size={16} />
                Excluir música
              </button>
            )}
            <button
              className="rep-quiet"
              type="button"
              disabled={saving}
              onClick={onDismiss}
            >
              Cancelar
            </button>
            <button className="rep-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar música'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export function Library({
  songs,
  onSave,
  onOpen,
  onClose,
  onDelete,
  readOnly = false,
}: LibraryProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todas')
  const [editing, setEditing] = useState<{ song: Song; isNew: boolean }>()
  const latest = useRef({ songs, readOnly })
  latest.current = { songs, readOnly }
  function assertEditable(original: Song, isNew: boolean) {
    if (latest.current.readOnly)
      throw new Error('Este acesso permite apenas consultar o repertório.')
    if (isNew) return
    const current = latest.current.songs.find((song) => song.id === original.id)
    if (!current)
      throw new Error(
        'A equipe excluiu esta música. Feche o editor para continuar.'
      )
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      throw new Error(
        'A equipe atualizou esta música. Feche o editor e reabra a versão atual.'
      )
    }
  }
  const matching = songs
    .filter(
      (song) =>
        (filter === 'Todas' ||
          (filter === 'Com PDF' ? song.pdfId : song.chart.trim())) &&
        normalize(song.title + ' ' + song.artist).includes(
          normalize(query.trim())
        )
    )
    .sort((a, b) =>
      a.title.localeCompare(b.title, 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      })
    )
  return (
    <section className="rep-library">
      {onClose && (
        <button
          type="button"
          className="rep-icon"
          aria-label="Voltar"
          onClick={onClose}
        >
          <ArrowLeft />
        </button>
      )}
      <div className="rep-title-row">
        <div>
          <h1>Repertório</h1>
          <p>
            {songs.length === 1
              ? '1 música na biblioteca'
              : songs.length + ' músicas na biblioteca'}
          </p>
        </div>
        {!readOnly && (
          <button
            className="rep-primary"
            onClick={() => setEditing({ song: newSong(), isNew: true })}
          >
            <Plus size={18} /> Nova música
          </button>
        )}
      </div>
      <div className="rep-library-panel">
        <div className="rep-list-tools">
          <label className="rep-search">
            <Search size={19} />
            <input
              type="search"
              aria-label="Buscar no repertório"
              placeholder="Buscar por música ou artista"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div
            className="rep-filter"
            role="group"
            aria-label="Filtrar repertório"
          >
            {['Todas', 'Com cifra', 'Com PDF'].map((option) => (
              <button
                key={option}
                aria-pressed={option === filter}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <ul className="rep-song-list">
          {matching.map((song, idx) => (
            <li key={song.id}>
              <button className="rep-song-main" onClick={() => onOpen(song)}>
                <span
                  className={'rep-cover rep-cover-' + (idx % 4)}
                  aria-hidden="true"
                >
                  {song.pdfId ? <FileText /> : <Music2 />}
                </span>
                <span className="rep-song-info">
                  <strong>{song.title}</strong>
                  <small>{song.artist || 'Artista não informado'}</small>
                </span>
                <span className="rep-musical-meta">
                  {song.key} <i /> {song.bpm} BPM
                </span>
                <ChevronRight size={18} className="rep-row-arrow" />
              </button>
              {!readOnly && (
                <button
                  className="rep-icon rep-edit"
                  aria-label={'Editar ' + song.title}
                  onClick={() => setEditing({ song, isNew: false })}
                >
                  <Pencil size={17} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {!matching.length && (
          <div className="rep-empty">
            <FileMusic size={32} />
            <h2>
              {songs.length
                ? 'Nenhuma música encontrada'
                : 'Seu repertório está vazio'}
            </h2>
            {songs.length ? (
              <button
                className="rep-quiet"
                onClick={() => {
                  setQuery('')
                  setFilter('Todas')
                }}
              >
                Limpar filtros
              </button>
            ) : (
              !readOnly && (
                <button
                  className="rep-quiet"
                  onClick={() => setEditing({ song: newSong(), isNew: true })}
                >
                  Adicionar a primeira música
                </button>
              )
            )}
          </div>
        )}
      </div>
      {!readOnly && editing && (
        <SongEditor
          onDelete={(song) => {
            assertEditable(editing.song, editing.isNew)
            return onDelete(song)
          }}
          source={editing.song}
          isNew={editing.isNew}
          retainPreviousPdf={songs.some(
            (s) => s.id !== editing.song.id && s.pdfId === editing.song.pdfId
          )}
          onSave={(song) => {
            assertEditable(editing.song, editing.isNew)
            return onSave(song)
          }}
          onDismiss={() => setEditing(undefined)}
        />
      )}
    </section>
  )
}
