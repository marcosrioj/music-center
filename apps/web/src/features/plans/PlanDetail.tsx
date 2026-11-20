import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  ListMusic,
  MapPin,
  Music2,
  Pencil,
  Share2,
  Plus,
  Trash2,
  Users,
  UserPlus,
  X,
} from 'lucide-react'
import {
  parseDate,
  type Plan,
  type PlanItem,
  type Member,
  type Song,
} from '../../domain/workspace'
import { ItemEditor, MemberEditor, PlanEditor, Sheet } from './Editor'

type Panel =
  | { type: 'plan' }
  | { type: 'deletePlan' }
  | { type: 'item'; item?: PlanItem }
  | { type: 'member'; member?: Member }
  | { type: 'removeItem'; item: PlanItem }
  | { type: 'removeMember'; member: Member }

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const statusText = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  declined: 'Recusado',
}

export function PlanDetail({
  plan,
  songs,
  onSave,
  onBack,
  onRead,
  onShare,
  onDelete,
  readOnly = false,
}: {
  plan: Plan
  readOnly?: boolean
  songs: Song[]
  onSave: (value: Plan) => void
  onBack: () => void
  onRead: (initialIndex: number) => void
  onShare: () => void
  onDelete: (plan: Plan) => Promise<void>
}) {
  const [section, setSection] = useState<'roteiro' | 'equipe'>('roteiro')
  const [form, setForm] = useState<{ panel: Panel; original: Plan } | null>(
    null
  )
  const changedWhileEditing =
    !readOnly &&
    form !== null &&
    form.original !== plan &&
    JSON.stringify(form.original) !== JSON.stringify(plan)
  const panel = readOnly || changedWhileEditing ? null : form?.panel
  const [organizing, setEditing] = useState(false)
  const editing = !readOnly && organizing
  function openPanel(panel: Panel) {
    setForm({ panel, original: plan })
  }
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const deleteBusy = useRef(false)
  const deleteActions = useRef<HTMLDivElement>(null)
  const close = () => setForm(null)
  function closeDeletion() {
    if (!deleteBusy.current) {
      close()
      return
    }
    const element = deleteActions.current?.closest('dialog')
    if (element && !element.open) element.showModal()
  }
  async function deleteConfirmed() {
    if (deleteBusy.current) return
    deleteBusy.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete(plan)
      close()
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir este plano.'
      )
    } finally {
      deleteBusy.current = false
      setDeleting(false)
    }
  }
  const songsById = new Map(songs.map((song) => [song.id, song]))
  const setItems = plan.items.filter(
    (item) => item.songId && songsById.has(item.songId)
  )
  const positions = new Map(setItems.map((item, i) => [item.id, i]))
  const duration = plan.items.reduce((sum, item) => sum + item.minutes, 0)
  const confirmed = plan.team.filter(
    (member) => member.status === 'confirmed'
  ).length
  function saveItem(item: PlanItem) {
    const contains = plan.items.some((current) => current.id === item.id)
    onSave({
      ...plan,
      items: contains
        ? plan.items.map((current) => (current.id === item.id ? item : current))
        : [...plan.items, item],
    })
  }
  function saveMember(member: Member) {
    const contains = plan.team.some((current) => current.id === member.id)
    onSave({
      ...plan,
      team: contains
        ? plan.team.map((current) =>
            current.id === member.id ? member : current
          )
        : [...plan.team, member],
    })
  }
  function move(index: number, by: number) {
    const to = index + by
    if (to < 0 || to >= plan.items.length) return
    const items = [...plan.items]
    ;[items[index], items[to]] = [items[to], items[index]]
    onSave({ ...plan, items })
  }
  return (
    <section className="pl-zone">
      <div className="pl-back-row">
        <button className="pl-text" onClick={onBack}>
          <ArrowLeft size={17} />
          Planos
        </button>
        {!readOnly && (
          <div className="pl-detail-actions">
            <button
              className="pl-text"
              onClick={onShare}
              aria-label="Compartilhar plano"
            >
              <Share2 size={16} />
              <span>Compartilhar plano</span>
            </button>
            <button
              className="pl-text"
              onClick={() => openPanel({ type: 'plan' })}
            >
              <Pencil size={16} />
              Editar plano
            </button>
            <button
              className="pl-text pl-delete"
              aria-label="Excluir plano"
              onClick={() => {
                setDeleteError('')
                openPanel({ type: 'deletePlan' })
              }}
            >
              <Trash2 size={16} />
              <span>Excluir plano</span>
            </button>
          </div>
        )}
      </div>
      <header className="pl-detail-head">
        <div className="pl-detail-info">
          <h1>{plan.title}</h1>
          <div className="pl-head-meta">
            <span>
              <CalendarDays size={16} />
              {dateFormatter.format(parseDate(plan.date))}
            </span>
            <span>
              <Clock3 size={16} />
              {plan.time}
            </span>
            {plan.location && (
              <span>
                <MapPin size={16} />
                {plan.location}
              </span>
            )}
          </div>
        </div>
        <button
          className="pl-btn primary"
          disabled={!setItems.length}
          onClick={() => onRead(0)}
        >
          <BookOpen size={18} />
          Abrir estante
        </button>
      </header>
      <div className="pl-tabs" role="group" aria-label="Seção do plano">
        <button
          aria-pressed={section === 'roteiro'}
          onClick={() => setSection('roteiro')}
        >
          <ListMusic size={19} />
          Roteiro <span>{plan.items.length}</span>
        </button>
        <button
          aria-pressed={section === 'equipe'}
          onClick={() => setSection('equipe')}
        >
          <Users size={19} />
          Equipe <span>{plan.team.length}</span>
        </button>
      </div>
      {section === 'roteiro' ? (
        <section>
          <header className="pl-section-head">
            <h2>Ordem do plano</h2>
            {!readOnly && (
              <div className="pl-head-tools">
                {!!plan.items.length && (
                  <button
                    className="pl-text"
                    aria-pressed={editing}
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? <Check size={16} /> : <Pencil size={16} />}
                    {editing ? 'Concluir' : 'Organizar'}
                  </button>
                )}
                <button
                  className="pl-btn"
                  onClick={() => openPanel({ type: 'item' })}
                >
                  <Plus size={17} />
                  Adicionar item
                </button>
              </div>
            )}
          </header>
          {plan.items.length ? (
            <>
              <ol className="pl-card pl-items">
                {plan.items.map((item, i) => {
                  const song = item.songId
                    ? songsById.get(item.songId)
                    : undefined
                  const label = song?.title ?? item.title
                  const index = positions.get(item.id)
                  return (
                    <li key={item.id} className="pl-item">
                      <div className="pl-item-main">
                        <span className="pl-order">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={'pl-item-icon' + (song ? ' music' : '')}
                        >
                          {song ? <Music2 size={18} /> : <FileText size={18} />}
                        </span>
                        <div className="pl-item-copy">
                          <strong>{label}</strong>
                          <small>
                            {song
                              ? [
                                  song.key ? 'Tom ' + song.key : '',
                                  song.bpm ? song.bpm + ' BPM' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')
                              : 'Momento'}
                          </small>
                        </div>
                        <span className="pl-minutes">{item.minutes} min</span>
                        {index !== undefined && !editing && (
                          <button
                            className="pl-icon"
                            aria-label={'Abrir ' + label + ' na estante'}
                            onClick={() => onRead(index)}
                          >
                            <ChevronRight size={19} />
                          </button>
                        )}
                      </div>
                      {editing && (
                        <div
                          className="pl-row-tools"
                          role="group"
                          aria-label={'Organizar ' + label}
                        >
                          <button
                            className="pl-icon"
                            aria-label={'Subir ' + label}
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                          >
                            <ArrowUp size={17} />
                          </button>
                          <button
                            className="pl-icon"
                            aria-label={'Descer ' + label}
                            disabled={i === plan.items.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            <ArrowDown size={17} />
                          </button>
                          <button
                            className="pl-icon"
                            aria-label={'Editar ' + label}
                            onClick={() => openPanel({ type: 'item', item })}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="pl-icon danger"
                            aria-label={'Remover ' + label}
                            onClick={() =>
                              openPanel({ type: 'removeItem', item })
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
              <div className="pl-summary">
                <Clock3 size={15} />
                {duration} min no roteiro
              </div>
            </>
          ) : (
            <div className="pl-empty pl-card">
              <ListMusic size={28} />
              <h3>Seu roteiro está vazio</h3>
              {!readOnly && (
                <p>
                  Adicione uma música ou um momento para montar a sequência.
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <section>
          <header className="pl-section-head">
            <h2>Escala da equipe</h2>
            {!readOnly && (
              <button
                className="pl-btn"
                onClick={() => openPanel({ type: 'member' })}
              >
                <UserPlus size={18} />
                Adicionar integrante
              </button>
            )}
          </header>
          {plan.team.length ? (
            <>
              <ul className="pl-card pl-items">
                {plan.team.map((member) => (
                  <li className="pl-member" key={member.id}>
                    <span className="pl-avatar" aria-hidden="true">
                      {member.name
                        .trim()
                        .split(/\s+/)
                        .filter(
                          (_, i, parts) => i === 0 || i === parts.length - 1
                        )
                        .map((part) => Array.from(part)[0])
                        .join('')
                        .toLocaleUpperCase('pt-BR')}
                    </span>
                    <div className="pl-member-copy">
                      <strong>{member.name}</strong>
                      <small>{member.role}</small>
                    </div>
                    <div className="pl-member-tools">
                      {readOnly ? (
                        <span
                          className={
                            'pl-status pl-status-view ' + member.status
                          }
                        >
                          <span className="pl-status-dot" aria-hidden="true" />
                          {statusText[member.status]}
                        </span>
                      ) : (
                        <>
                          <label className={'pl-status ' + member.status}>
                            <span
                              className="pl-status-dot"
                              aria-hidden="true"
                            />
                            <select
                              aria-label={'Resposta de ' + member.name}
                              value={member.status}
                              onChange={(e) =>
                                saveMember({
                                  ...member,
                                  status: e.target.value as Member['status'],
                                })
                              }
                            >
                              {(
                                ['pending', 'confirmed', 'declined'] as const
                              ).map((status) => (
                                <option key={status} value={status}>
                                  {statusText[status]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="pl-icon"
                            aria-label={'Editar ' + member.name}
                            onClick={() =>
                              openPanel({ type: 'member', member })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="pl-icon danger"
                            aria-label={'Remover ' + member.name}
                            onClick={() =>
                              openPanel({ type: 'removeMember', member })
                            }
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pl-summary">
                <Check size={16} />
                {confirmed} de {plan.team.length} com presença confirmada
              </div>
            </>
          ) : (
            <div className="pl-empty pl-card">
              <Users size={28} />
              <h3>Equipe em aberto</h3>
              {!readOnly && (
                <p>Adicione os integrantes e suas funções neste plano.</p>
              )}
            </div>
          )}
        </section>
      )}
      {changedWhileEditing && (
        <Sheet title="Plano atualizado" onClose={close}>
          <p className="pl-confirm-name">
            A equipe atualizou este plano durante a edição. Reabra o item para
            editar a versão atual.
          </p>
          <div className="pl-actions">
            <button className="pl-btn primary" onClick={close}>
              Voltar ao plano
            </button>
          </div>
        </Sheet>
      )}
      {panel?.type === 'deletePlan' && (
        <Sheet title="Excluir plano?" onClose={closeDeletion}>
          <p className="pl-confirm-name">
            O roteiro e a escala de “{plan.title}” serão excluídos do espaço da
            equipe.
          </p>
          {deleteError && (
            <p className="pl-delete-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="pl-actions" ref={deleteActions}>
            <button
              className="pl-btn"
              autoFocus
              disabled={deleting}
              onClick={closeDeletion}
            >
              Cancelar
            </button>
            <button
              className="pl-btn destructive"
              disabled={deleting}
              onClick={() => void deleteConfirmed()}
            >
              {deleting ? 'Excluindo…' : 'Excluir plano'}
            </button>
          </div>
        </Sheet>
      )}
      {panel?.type === 'plan' && (
        <PlanEditor plan={plan} onSave={onSave} onClose={close} />
      )}
      {panel?.type === 'item' && (
        <ItemEditor
          item={panel.item}
          songs={songs}
          onSave={saveItem}
          onClose={close}
        />
      )}
      {panel?.type === 'member' && (
        <MemberEditor
          member={panel.member}
          onSave={saveMember}
          onClose={close}
        />
      )}
      {(panel?.type === 'removeItem' || panel?.type === 'removeMember') && (
        <Sheet
          title={
            panel.type === 'removeItem'
              ? 'Remover do roteiro?'
              : 'Remover da escala?'
          }
          onClose={close}
        >
          <p className="pl-confirm-name">
            {panel.type === 'removeItem'
              ? (songsById.get(panel.item.songId ?? '')?.title ??
                panel.item.title)
              : panel.member.name}
          </p>
          <div className="pl-actions">
            <button className="pl-btn" onClick={close}>
              Cancelar
            </button>
            <button
              className="pl-btn destructive"
              onClick={() => {
                if (panel.type === 'removeItem')
                  onSave({
                    ...plan,
                    items: plan.items.filter(
                      (item) => item.id !== panel.item.id
                    ),
                  })
                else
                  onSave({
                    ...plan,
                    team: plan.team.filter(
                      (member) => member.id !== panel.member.id
                    ),
                  })
                close()
              }}
            >
              Remover
            </button>
          </div>
        </Sheet>
      )}
    </section>
  )
}
