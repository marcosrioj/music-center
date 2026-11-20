import { useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { chronological, dateKey, parseDate, type Plan } from '../model'
import './plans.css'

export { PlanDetail } from './PlanDetail'
export { PlanEditor } from './Editor'

const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function Plans({
  plans,
  onOpen,
  onNew,
  onImport,
  readOnly = false,
}: {
  plans: Plan[]
  readOnly?: boolean
  onOpen: (plan: Plan) => void
  onNew: () => void
  onImport: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todos')
  const today = dateKey(new Date())
  const search = normalized(query.trim())
  const matches = chronological(
    plans.filter((plan) => {
      if (filter === 'Próximos' && plan.date < today) return false
      if (filter === 'Anteriores' && plan.date >= today) return false
      return normalized(plan.title + ' ' + plan.location).includes(search)
    })
  )
  if (filter === 'Anteriores') matches.reverse()
  const groups = new Map<string, Plan[]>()
  for (const plan of matches) {
    const key = plan.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(plan)
  }
  return (
    <section className="pl-zone">
      <header className="pl-list-head">
        <div>
          <h1>Planos</h1>
          <p>Roteiros e escalas da sua equipe.</p>
        </div>
        {!readOnly && (
          <div className="pl-head-tools">
            <button className="pl-btn" onClick={onImport}>
              <Upload size={17} />
              Importar plano
            </button>
            <button className="pl-btn primary" onClick={onNew}>
              <Plus size={18} /> Novo plano
            </button>
          </div>
        )}
      </header>
      <div className="pl-toolbar">
        <label className="pl-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Buscar planos por título ou local"
            type="search"
            placeholder="Buscar planos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="pl-filters" role="group" aria-label="Período">
          {['Todos', 'Próximos', 'Anteriores'].map((option) => (
            <button
              key={option}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {[...groups].map(([key, entries]) => (
        <section key={key} className="pl-month">
          <h2>{monthYear.format(parseDate(entries[0].date))}</h2>
          <div className="pl-card">
            {entries.map((plan) => {
              const date = parseDate(plan.date)
              const count = plan.items.filter((item) => item.songId).length
              return (
                <button
                  className="pl-plan-row"
                  onClick={() => onOpen(plan)}
                  key={plan.id}
                >
                  <span className="pl-calendar">
                    <small>{month.format(date).replace('.', '')}</small>
                    <b>{date.getDate()}</b>
                  </span>
                  <span className="pl-plan-main">
                    <strong>{plan.title}</strong>
                    <span className="pl-row-meta">
                      <span>
                        <Clock3 size={14} /> {weekday.format(date)}, {plan.time}
                      </span>
                      {plan.location && (
                        <span>
                          <MapPin size={14} />
                          {plan.location}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="pl-song-count">
                    {count} {count === 1 ? 'música' : 'músicas'}
                  </span>
                  <ChevronRight size={19} />
                </button>
              )
            })}
          </div>
        </section>
      ))}
      {!matches.length && (
        <div className="pl-empty pl-card">
          <CalendarDays size={28} />
          <h2>
            {plans.length
              ? 'Nenhum plano encontrado'
              : readOnly
                ? 'Nenhum plano publicado'
                : 'Crie seu primeiro plano'}
          </h2>
          <p>
            {plans.length
              ? 'Tente outro título, local ou período.'
              : readOnly
                ? 'Os planos publicados pela equipe aparecem aqui.'
                : 'Reúna o roteiro, as músicas e a equipe em um só lugar.'}
          </p>
          {plans.length ? (
            <button
              className="pl-btn"
              onClick={() => {
                setFilter('Todos')
                setQuery('')
              }}
            >
              Limpar filtros
            </button>
          ) : (
            !readOnly && (
              <button className="pl-btn" onClick={onNew}>
                Criar plano
              </button>
            )
          )}
        </div>
      )}
    </section>
  )
}
