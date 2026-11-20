import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import type { Plan, PlanItem, Member, Song } from '../../domain/workspace'

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    const trigger = document.activeElement
    dialog.showModal()
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="pl-sheet"
      aria-modal="true"
      aria-labelledby="pl-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const { left, right, top, bottom } =
            event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < left ||
            event.clientX > right ||
            event.clientY < top ||
            event.clientY > bottom
          )
            onClose()
        }
      }}
    >
      <div className="pl-sheet-head">
        <h2 id="pl-sheet-title">{title}</h2>
        <button
          type="button"
          className="pl-icon"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

function Fields({
  children,
  submit,
  onClose,
  onSubmit,
}: {
  children: ReactNode
  submit: string
  onClose: () => void
  onSubmit: (data: FormData) => void
}) {
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit(new FormData(e.currentTarget))
  }
  return (
    <form className="pl-form" onSubmit={save}>
      {children}
      <div className="pl-actions">
        <button type="button" className="pl-btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="pl-btn primary" type="submit">
          {submit}
        </button>
      </div>
    </form>
  )
}

function field(data: FormData, key: string) {
  return String(data.get(key) ?? '').trim()
}
const nonBlank = '.*\\S.*'

export function PlanEditor({
  plan,
  onSave,
  onClose,
  creating = false,
}: {
  plan: Plan
  onSave: (plan: Plan) => void
  onClose: () => void
  creating?: boolean
}) {
  return (
    <Sheet title={creating ? 'Novo plano' : 'Editar plano'} onClose={onClose}>
      <Fields
        submit={creating ? 'Criar plano' : 'Salvar alterações'}
        onClose={onClose}
        onSubmit={(data) => {
          onSave({
            ...plan,
            title: field(data, 'title'),
            date: field(data, 'date'),
            time: field(data, 'time'),
            location: field(data, 'location'),
          })
          onClose()
        }}
      >
        <label>
          Nome do plano
          <input
            name="title"
            defaultValue={plan.title}
            required
            pattern={nonBlank}
          />
        </label>
        <div className="pl-field-pair">
          <label>
            Data
            <input name="date" type="date" defaultValue={plan.date} required />
          </label>
          <label>
            Horário
            <input name="time" type="time" defaultValue={plan.time} required />
          </label>
        </div>
        <label>
          Local
          <input name="location" defaultValue={plan.location} />
        </label>
      </Fields>
    </Sheet>
  )
}

export function ItemEditor({
  item,
  songs,
  onSave,
  onClose,
}: {
  item?: PlanItem
  songs: Song[]
  onSave: (item: PlanItem) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState(
    item
      ? item.songId
        ? 'Música'
        : 'Momento'
      : songs.length
        ? 'Música'
        : 'Momento'
  )
  return (
    <Sheet
      title={item ? 'Editar item' : 'Adicionar ao roteiro'}
      onClose={onClose}
    >
      <Fields
        submit={item ? 'Salvar alterações' : 'Adicionar item'}
        onClose={onClose}
        onSubmit={(data) => {
          const song =
            kind === 'Música'
              ? songs.find((s) => s.id === field(data, 'songId'))
              : undefined
          if (kind === 'Música' && !song) return
          onSave({
            id: item?.id ?? crypto.randomUUID(),
            ...(song ? { songId: song.id } : {}),
            title: song?.title ?? field(data, 'title'),
            minutes: Number(field(data, 'minutes')),
          })
          onClose()
        }}
      >
        <div role="group" aria-label="Tipo de item" className="pl-filters">
          {['Música', 'Momento'].map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === kind}
              disabled={k === 'Música' && !songs.length}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        {kind === 'Música' ? (
          <label>
            Música do repertório
            <select name="songId" required defaultValue={item?.songId ?? ''}>
              <option value="" disabled>
                Selecione uma música
              </option>
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.artist ? ' · ' + s.artist : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Nome do momento
            <input
              name="title"
              defaultValue={item?.songId ? '' : item?.title}
              placeholder="Ex. Boas-vindas"
              required
              pattern={nonBlank}
            />
          </label>
        )}
        {!songs.length && (
          <p className="pl-hint">
            Cadastre músicas no repertório para incluí-las no roteiro.
          </p>
        )}
        <label>
          Duração em minutos
          <input
            name="minutes"
            type="number"
            inputMode="numeric"
            required
            min="0"
            max="1440"
            step="1"
            defaultValue={item?.minutes ?? 5}
          />
        </label>
      </Fields>
    </Sheet>
  )
}

export function MemberEditor({
  member,
  onSave,
  onClose,
}: {
  member?: Member
  onSave: (member: Member) => void
  onClose: () => void
}) {
  return (
    <Sheet
      title={member ? 'Editar integrante' : 'Adicionar integrante'}
      onClose={onClose}
    >
      <Fields
        submit={member ? 'Salvar alterações' : 'Adicionar à escala'}
        onClose={onClose}
        onSubmit={(data) => {
          onSave({
            id: member?.id ?? crypto.randomUUID(),
            name: field(data, 'name'),
            role: field(data, 'role'),
            status: member?.status ?? 'pending',
          })
          onClose()
        }}
      >
        <label>
          Nome
          <input
            name="name"
            required
            pattern={nonBlank}
            defaultValue={member?.name}
            autoComplete="off"
          />
        </label>
        <label>
          Função
          <input
            name="role"
            required
            pattern={nonBlank}
            defaultValue={member?.role}
            placeholder="Ex. Violão"
          />
        </label>
      </Fields>
    </Sheet>
  )
}
