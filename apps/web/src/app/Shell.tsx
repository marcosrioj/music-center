import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Cloud,
  Settings2,
  LayoutDashboard,
  LibraryBig,
  LoaderCircle,
  PanelLeft,
  X,
} from 'lucide-react'
import { Home, Stand } from '../features/dashboard/Home'
import { PlanDetail, PlanEditor, Plans } from '../features/plans'
import { Library, Reader } from '../features/repertoire'
import { dateKey, planSongs, type Plan, type Song } from '../domain/workspace'
import { Manager } from '../features/account/Manager'
import type { Scope, Snapshot, Notes } from '../domain/space'
import type { WorkspaceServices } from '../application/workspaces'
import type { DeviceNavigation } from '../application/deviceNavigation'
import type { RepertoireServices } from '../features/repertoire/services'
import { WorkspaceSession } from '../application/workspaceSession'
import { isDenied } from '../application/errors'

const tabs = [
  {
    id: 'inicio',
    label: 'Visão geral',
    short: 'Início',
    icon: LayoutDashboard,
  },
  { id: 'planos', label: 'Planos', short: 'Planos', icon: CalendarDays },
  {
    id: 'repertorio',
    label: 'Repertório',
    short: 'Repertório',
    icon: LibraryBig,
  },
  { id: 'estante', label: 'Estante', short: 'Estante', icon: BookOpen },
  { id: 'gestao', label: 'Gestão do espaço', short: 'Gestão', icon: Settings2 },
]
function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  window.addEventListener('popstate', fn)
  return () => {
    window.removeEventListener('hashchange', fn)
    window.removeEventListener('popstate', fn)
  }
}
const locationPath = () => location.hash.slice(1) || '/inicio'
function navigate(path: string, replace = false) {
  if (path === locationPath()) return
  if (replace) history.replaceState(history.state, '', '#' + path)
  else history.pushState({ musiccenter: true }, '', '#' + path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
function back(fallback: string) {
  if (history.state?.musiccenter) history.back()
  else navigate(fallback, true)
}
export function Logo() {
  return (
    <span className="brand">
      <span className="logomark" aria-hidden="true">
        {[9, 17, 25, 14, 20].map((n) => (
          <i key={n} style={{ height: n }} />
        ))}
      </span>
      <b>MusicCenter</b>
    </span>
  )
}
function SpaceBadge({ name, readOnly }: { name: string; readOnly: boolean }) {
  return (
    <div className="local-badge">
      <span className="local-icon">
        <Cloud size={18} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{readOnly ? 'Membro' : 'Administrador'}</small>
      </span>
      <i aria-hidden="true" />
    </div>
  )
}
type ShellProps = {
  services: WorkspaceServices
  navigation: DeviceNavigation
  repertoireFor: (scope: Scope) => RepertoireServices
  webUrl: string
  initial: Snapshot
  scope: Scope
  personalNotes: Notes
  email: string
  canMigrate: boolean
  onSwitch: () => void
  onLeave: () => void
  onDenied: () => void
}
export function Shell({
  services,
  navigation,
  repertoireFor,
  webUrl,
  initial,
  scope,
  personalNotes,
  email,
  canMigrate,
  onSwitch,
  onLeave,
  onDenied,
}: ShellProps) {
  const readOnly = scope.space.role === 'member'
  const [session] = useState(
    () => new WorkspaceSession(services, scope, initial, personalNotes)
  )
  const repertoire = useMemo(() => repertoireFor(scope), [repertoireFor, scope])
  const data = useSyncExternalStore(session.subscribe, session.current)
  const [connected, setConnected] = useState(true)
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const path = useSyncExternalStore(subscribe, locationPath)
  const [, page, id, position] = path.split('/')
  const tab = tabs.find((t) => t.id === page) ?? tabs[0]
  const plan =
    page === 'planos' || page === 'palco'
      ? data.plans.find((p) => p.id === id)
      : undefined
  const song =
    page === 'musica' ? data.songs.find((s) => s.id === id) : undefined
  const readerSongs =
    page === 'palco' && plan ? planSongs(plan, data.songs) : song ? [song] : []
  const isReader = readerSongs.length > 0
  const routeBack =
    page === 'palco'
      ? '/planos/' + id
      : page === 'musica'
        ? '/repertorio'
        : '/inicio'

  useEffect(() => {
    window.scrollTo(0, 0)
    setNotice('')
    navigation.setReaderAppearance(isReader)
  }, [path, isReader, navigation])
  useEffect(() => {
    return navigation.onBack(() => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
      if (dialog) {
        dialog.close()
        return
      }
      if (page === 'inicio' && !history.state?.musiccenter) {
        navigation.exit()
        return
      }
      back(routeBack)
    })
  }, [page, routeBack, navigation])

  useEffect(() => {
    let alive = true
    let checking = false
    async function refresh() {
      if (!alive || checking || document.hidden || !services.sameScope(scope))
        return
      checking = true
      try {
        await session.refresh()
        if (alive) setConnected(true)
      } catch (error) {
        if (alive && isDenied(error)) onDenied()
        else if (alive) setConnected(false)
      } finally {
        checking = false
      }
    }
    const timer = window.setInterval(refresh, 12000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const disconnect = () => setConnected(false)
    window.addEventListener('offline', disconnect)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', disconnect)
    }
  }, [session, services, scope, onDenied])
  useEffect(() => {
    if (!isReader) return
    let active = true
    const load = async () => {
      try {
        await session.refreshNotes()
      } catch (error) {
        if (active && isDenied(error)) onDenied()
      }
    }
    void load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
    }
  }, [isReader, session, onDenied, path])
  async function trackWrite(write: Promise<void>) {
    try {
      await write
      setConnected(true)
    } catch (error) {
      if (isDenied(error)) onDenied()
      throw error
    }
  }
  function savePlan(p: Plan) {
    return trackWrite(session.savePlan(p))
      .then(() => true)
      .catch((error) => {
        setNotice(
          error instanceof Error ? error.message : 'Falha ao salvar o plano.'
        )
        return false
      })
  }
  function saveSong(s: Song) {
    return trackWrite(session.saveSong(s))
  }
  async function savePersonalNote(song: Song, previous: string) {
    try {
      await session.saveNote(song, previous)
    } catch (error) {
      if (isDenied(error)) onDenied()
      throw error
    }
  }
  async function deletePlan(p: Plan) {
    try {
      await trackWrite(session.deletePlan(p.id))
    } catch {
      throw new Error(
        'Não foi possível excluir o plano. Confira a conexão e atualize os dados.'
      )
    }
    navigate('/planos', true)
  }
  async function deleteSong(s: Song) {
    await trackWrite(session.deleteSong(s.id))
  }
  const openPlan = (p: Plan) => navigate('/planos/' + p.id)
  const openSet = (p: Plan, i: number) => navigate('/palco/' + p.id + '/' + i)
  const openLibrary = () => navigate('/repertorio')
  async function importFile(file?: File) {
    if (!file) return
    setBusy('Importando plano…')
    try {
      const imported = await repertoire.importPlan(file)
      await trackWrite(session.addImportedPlan(imported.plan, imported.songs))
      openPlan(imported.plan)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível importar o plano.'
      )
    } finally {
      setBusy('')
    }
  }
  async function share() {
    if (!plan) return
    setBusy('Preparando arquivo…')
    try {
      await repertoire.sharePlan(plan, data.songs)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível compartilhar este plano.'
      )
    } finally {
      setBusy('')
    }
  }

  const messages = (
    <>
      {notice && (
        <div className="notice" role="alert">
          <CircleAlert size={17} />
          {notice}
          <button aria-label="Dispensar aviso" onClick={() => setNotice('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-screen" role="status">
          <span>
            <LoaderCircle className="spin" size={20} />
            {busy}
          </span>
        </div>
      )}
    </>
  )
  if (isReader)
    return (
      <>
        {messages}
        <Reader
          openPdf={repertoire.openPdf}
          key={path}
          songs={readerSongs}
          initialIndex={Math.max(
            0,
            Math.min(readerSongs.length - 1, Number(position) || 0)
          )}
          onClose={() => back(routeBack)}
          onSave={savePersonalNote}
          planTitle={page === 'palco' ? plan?.title : undefined}
        />
      </>
    )
  const nav = (mobile: boolean) =>
    tabs.map((t) => (
      <button
        key={t.id}
        aria-label={mobile ? t.short : t.label}
        aria-current={tab.id === t.id ? 'page' : undefined}
        className={tab.id === t.id ? 'active' : ''}
        onClick={() => navigate('/' + t.id)}
      >
        <t.icon size={19} strokeWidth={1.8} />
        <span>{mobile ? t.short : t.label}</span>
      </button>
    ))
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <div className="nav-caption">Área de trabalho</div>
        <nav aria-label="Navegação principal">{nav(false)}</nav>
        <SpaceBadge name={scope.space.name} readOnly={readOnly} />
      </aside>
      <div className="shell-column">
        <header className="shellbar">
          <div className="breadcrumbs">
            <PanelLeft size={16} />
            <span>Área de trabalho</span>
            <ChevronRight size={13} />
            <b>{tab.label}</b>
            {page === 'planos' && plan && (
              <>
                <ChevronRight size={13} />
                <b>Plano</b>
              </>
            )}
          </div>
          <div className="mobile-brand">
            <Logo />
          </div>
          <span
            className={'system-online' + (connected ? '' : ' disconnected')}
          >
            <i aria-hidden="true" />
            {connected ? 'Conectado' : 'Sem conexão'}
          </span>
        </header>
        <main className="page-main" id="main-content">
          {messages}
          {page === 'gestao' ? (
            <Manager
              name={scope.space.name}
              role={scope.space.role}
              email={email}
              webUrl={webUrl}
              onInvite={() => services.invite(scope.space)}
              onRevoke={() => services.revokeInvites(scope.space)}
              onMembers={() => services.members(scope.space)}
              onRemoveMember={(id) => services.removeMember(scope.space, id)}
              onLeave={onLeave}
              onSwitch={onSwitch}
              onMigrate={
                canMigrate &&
                !readOnly &&
                !data.plans.length &&
                !data.songs.length
                  ? async () => {
                      const next = await services.migrateLocal(scope)
                      await session.refreshNotes()
                      session.apply(next)
                    }
                  : undefined
              }
            />
          ) : page === 'planos' ? (
            plan ? (
              <PlanDetail
                readOnly={readOnly}
                key={plan.id}
                plan={plan}
                songs={data.songs}
                onSave={savePlan}
                onDelete={deletePlan}
                onBack={() => back('/planos')}
                onRead={(i) => openSet(plan, i)}
                onShare={() => void share()}
              />
            ) : (
              <Plans
                readOnly={readOnly}
                plans={data.plans}
                onOpen={openPlan}
                onNew={() => setCreating(true)}
                onImport={() => fileInput.current?.click()}
              />
            )
          ) : page === 'repertorio' ? (
            <Library
              scores={repertoire.scores}
              readOnly={readOnly}
              songs={data.songs}
              onDelete={deleteSong}
              onSave={saveSong}
              onOpen={(s) => navigate('/musica/' + s.id)}
            />
          ) : page === 'estante' ? (
            <Stand
              plans={data.plans}
              songs={data.songs}
              onRead={openSet}
              onLibrary={openLibrary}
            />
          ) : (
            <Home
              readOnly={readOnly}
              plans={data.plans}
              songs={data.songs}
              onNew={() => setCreating(true)}
              onPlan={openPlan}
              onLibrary={openLibrary}
              onRead={openSet}
            />
          )}
        </main>
      </div>
      <nav aria-label="Navegação móvel" className="bottom-nav">
        {nav(true)}
      </nav>
      {creating && !readOnly && (
        <PlanEditor
          creating
          plan={{
            id: '',
            title: '',
            date: dateKey(new Date()),
            time: '10:00',
            location: '',
            items: [],
            team: [],
          }}
          onSave={(p) => {
            const created = { ...p, id: crypto.randomUUID() }
            void savePlan(created).then((saved) => {
              if (saved) openPlan(created)
            })
          }}
          onClose={() => setCreating(false)}
        />
      )}
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void importFile(file)
        }}
      />
    </div>
  )
}
