import { useState } from 'react'
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListMusic,
  MapPin,
  Mic2,
  Music2,
  Plus,
  UsersRound,
} from 'lucide-react'
import {
  chronological,
  dateKey,
  dateText,
  planSongs,
  type Plan,
  type Song,
} from './model'

interface HomeProps {
  readOnly?: boolean
  plans: Plan[]
  songs: Song[]
  onNew: () => void
  onPlan: (p: Plan) => void
  onLibrary: () => void
  onRead: (p: Plan, i: number) => void
}

function Agenda({ plans, onPlan }: Pick<HomeProps, 'plans' | 'onPlan'>) {
  const today = new Date()
  const todayKey = dateKey(today)
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12)
  )
  const [selected, setSelected] = useState('')
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const planned = new Set(plans.map((plan) => plan.date))
  const shift = (delta: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12))
    setSelected('')
  }
  const monthKey = dateKey(month).slice(0, 7)
  const sorted = chronological(plans).filter((plan) =>
    selected
      ? plan.date === selected
      : plan.date.startsWith(monthKey) &&
        (monthKey !== todayKey.slice(0, 7) || plan.date >= todayKey)
  )
  const monthText = month
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(' de ', ' ')
  return (
    <section className="hc-card agenda">
      <div className="cap-heading">
        <span className="section-symbol">
          <CalendarDays size={17} />
        </span>
        <h2>Agenda</h2>
      </div>
      <div className="month-pick">
        <strong>{monthText}</strong>
        <div>
          <button
            type="button"
            className="ic"
            aria-label="Mês anterior"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="ic"
            aria-label="Próximo mês"
            onClick={() => shift(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span className="weekday" aria-hidden="true" key={'h' + i}>
            {d}
          </span>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <span aria-hidden="true" key={'e' + i} />
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const n = i + 1
          const k = monthKey + '-' + String(n).padStart(2, '0')
          return (
            <button
              key={k}
              onClick={() => setSelected(selected === k ? '' : k)}
              className={
                'date-cell' +
                (k === todayKey ? ' today' : '') +
                (selected === k ? ' chosen' : '') +
                (planned.has(k) ? ' scheduled' : '')
              }
              aria-label={
                dateText(k, { day: 'numeric', month: 'long' }) +
                (planned.has(k) ? ', com plano' : '')
              }
              aria-current={k === todayKey ? 'date' : undefined}
              aria-pressed={selected === k}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="agenda-bottom">
        <div className="agenda-caption">
          <h3>
            {selected
              ? dateText(selected, { day: 'numeric', month: 'long' })
              : 'Planos do mês'}
          </h3>
          {selected && (
            <button className="quiet-link" onClick={() => setSelected('')}>
              Ver mês
            </button>
          )}
        </div>
        {sorted.length ? (
          sorted.map((p) => (
            <button className="event-row" key={p.id} onClick={() => onPlan(p)}>
              <span className="event-date">
                <b>{p.date.slice(-2)}</b>
                <small>
                  {dateText(p.date, { month: 'short' }).replace('.', '')}
                </small>
              </span>
              <span className="event-name">
                <strong>{p.title}</strong>
                <small>
                  {p.time}
                  {p.location && ' · ' + p.location}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <p className="empty-small">
            Nenhum plano {selected ? 'neste dia' : 'neste período'}.
          </p>
        )}
      </div>
    </section>
  )
}

export function Home({
  plans,
  songs,
  onNew,
  onPlan,
  onRead,
  onLibrary,
  readOnly = false,
}: HomeProps) {
  const now = new Date()
  const today = dateKey(now)
  const next = chronological(plans).find(
    (p) =>
      p.date > today ||
      (p.date === today && p.time >= now.toTimeString().slice(0, 5))
  )
  const set = next ? planSongs(next, songs) : []
  return (
    <div className="home">
      <div className="home-heading">
        <div>
          <div className="kicker date-line">
            {now.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <h1>Visão geral</h1>
        </div>
        {!readOnly && (
          <button className="action-primary" onClick={onNew}>
            <Plus size={18} />
            Novo plano
          </button>
        )}
      </div>
      <div className="home-grid">
        <div className="home-main">
          <section className="cover">
            <div className="cover-content">
              <div className="kicker hero-label">
                <span className="live-dot" />
                Próximo plano
              </div>
              <h2>{next?.title ?? 'Agenda em aberto'}</h2>
              {next ? (
                <>
                  <div className="cover-meta">
                    <span>
                      <CalendarDays />
                      {dateText(next.date, {
                        day: 'numeric',
                        month: 'short',
                      }).replace(/\.$/, '')}
                    </span>
                    <span>
                      <Clock3 />
                      {next.time}
                    </span>
                    {next.location && (
                      <span>
                        <MapPin />
                        {next.location}
                      </span>
                    )}
                  </div>
                  <button className="cover-cta" onClick={() => onPlan(next)}>
                    Abrir plano
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : (
                <button
                  className="cover-cta"
                  onClick={readOnly ? onLibrary : onNew}
                >
                  {readOnly ? (
                    <>
                      Ver repertório <ArrowRight size={17} />
                    </>
                  ) : (
                    <>
                      Criar plano <Plus size={17} />
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
          {next && (
            <section className="hc-card set-card">
              <div className="set-head">
                <div className="cap-heading">
                  <span className="section-symbol">
                    <ListMusic size={20} />
                  </span>
                  <div>
                    <h2>Repertório do plano</h2>
                    <small>
                      {set.length} {set.length === 1 ? 'música' : 'músicas'}
                    </small>
                  </div>
                </div>
                {set.length > 0 && (
                  <button
                    className="quiet-link"
                    onClick={() => onRead(next, 0)}
                  >
                    Abrir estante
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
              {set.map((s, i) => (
                <button
                  key={next.id + i}
                  className="hc-track"
                  onClick={() => onRead(next, i)}
                >
                  <span
                    className={'album-art art-' + (i % 4)}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                  <span className="track-info">
                    <strong>{s.title}</strong>
                    <small>{s.artist || 'Autoria não informada'}</small>
                  </span>
                  <span className="tempo">{s.bpm} BPM</span>
                  <span className="key-tag">{s.key}</span>
                  <ChevronRight className="row-chevron" size={16} />
                </button>
              ))}
              {!set.length && (
                <button
                  className="empty-action"
                  onClick={readOnly ? onLibrary : () => onPlan(next)}
                >
                  {readOnly ? (
                    <>
                      Ver repertório <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      Adicionar músicas ao plano <Plus size={16} />
                    </>
                  )}
                </button>
              )}
            </section>
          )}
          {next && (
            <section className="hc-card team-summary">
              <div className="cap-heading">
                <span className="section-symbol">
                  <UsersRound size={19} />
                </span>
                <div>
                  <h2>Equipe escalada</h2>
                  <small>
                    {next.team.filter((m) => m.status === 'confirmed').length}{' '}
                    de {next.team.length} confirmados
                  </small>
                </div>
              </div>
              <div className="crew-list">
                {next.team.map((m, i) => (
                  <div className="crew-person" key={m.id}>
                    <span className={'avatar hue-' + (i % 3)}>
                      {m.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((s) => s[0])
                        .join('')}
                    </span>
                    <span>
                      <strong>{m.name}</strong>
                      <small>{m.role}</small>
                    </span>
                  </div>
                ))}
              </div>
              {!next.team.length &&
                (readOnly ? (
                  <p className="empty-small">
                    A equipe ainda não foi escalada.
                  </p>
                ) : (
                  <button className="empty-action" onClick={() => onPlan(next)}>
                    Montar escala <Plus size={16} />
                  </button>
                ))}
            </section>
          )}
        </div>
        <aside className="home-rail">
          <Agenda plans={plans} onPlan={onPlan} />
          <button className="library-jump" onClick={onLibrary}>
            <span className="library-icon">
              <BookOpen size={22} />
            </span>
            <span>
              <strong>Biblioteca musical</strong>
              <small>
                {songs.length}{' '}
                {songs.length === 1
                  ? 'música no repertório'
                  : 'músicas no repertório'}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        </aside>
      </div>
    </div>
  )
}

export function Stand({
  plans,
  songs,
  onRead,
  onLibrary,
}: Pick<HomeProps, 'plans' | 'songs' | 'onRead' | 'onLibrary'>) {
  const sorted = chronological(plans)
  const today = dateKey(new Date())
  const ordered = [
    ...sorted.filter((p) => p.date >= today),
    ...sorted.filter((p) => p.date < today).reverse(),
  ].filter((p) => planSongs(p, songs).length)
  return (
    <div className="stand">
      <div className="kicker">
        <Mic2 size={15} />
        Modo de leitura
      </div>
      <h1>Estante</h1>
      <p className="stand-intro">
        Escolha um plano para tocar as músicas em sequência.
      </p>
      <div className="stand-plans">
        {ordered.map((p) => (
          <button
            key={p.id}
            className="stand-plan"
            onClick={() => onRead(p, 0)}
          >
            <span className="stand-icon">
              <AudioLines />
            </span>
            <span>
              <small>
                {dateText(p.date, { day: 'numeric', month: 'long' })} · {p.time}
              </small>
              <strong>{p.title}</strong>
              <small>
                {planSongs(p, songs).length}{' '}
                {planSongs(p, songs).length === 1 ? 'música' : 'músicas'}
              </small>
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
      {!ordered.length && (
        <p className="empty-small">Os planos com músicas aparecem aqui.</p>
      )}
      <button className="stand-library" onClick={onLibrary}>
        <Music2 size={18} />
        Escolher uma música do repertório
        <ArrowRight size={17} />
      </button>
    </div>
  )
}
