import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { App as NativeApp } from '@capacitor/app'
import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
  type PluginListenerHandle,
} from '@capacitor/core'
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
import { removeScores } from '../data/scores'
import {
  dateKey,
  planSongs,
  type Plan,
  type Song,
  type Workspace,
} from '../domain/workspace'
import { migrateLocal } from '../data/legacyWorkspace'
import { Manager } from '../features/account/Manager'
import {
  fetchSnapshot,
  isConflict,
  isDenied,
  readNotes,
  rpc,
  sameScope,
  saveSnapshot,
  webUrl,
  withNotes,
  writeNote,
  type Membership,
  type Notes,
  type Scope,
  type Snapshot,
} from '../data/supabase'

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
  const [data, setData] = useState(() =>
    withNotes(initial.workspace, personalNotes)
  )
  const cached = useRef(data)
  const revision = useRef(initial.revision)
  const notes = useRef(personalNotes)
  const writes = useRef<Promise<void>>(Promise.resolve())
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
    if (Capacitor.isNativePlatform()) {
      void SystemBars.setStyle({
        style: isReader ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {})
    }
  }, [path, isReader])
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let removed = false
    let subscription: PluginListenerHandle | undefined
    void NativeApp.addListener('backButton', () => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
      if (dialog) {
        dialog.close()
        return
      }
      if (page === 'inicio' && !history.state?.musiccenter) {
        void NativeApp.exitApp()
        return
      }
      back(routeBack)
    }).then((handle) => {
      if (removed) void handle.remove()
      else subscription = handle
    })
    return () => {
      removed = true
      void subscription?.remove()
    }
  }, [page, routeBack])

  function apply(snapshot: Snapshot) {
    if (!sameScope(scope) || snapshot.revision < revision.current) return
    revision.current = snapshot.revision
    cached.current = withNotes(snapshot.workspace, notes.current)
    setData(cached.current)
  }
  useEffect(() => {
    let alive = true
    let checking = false
    async function refresh() {
      if (!alive || checking || document.hidden || !sameScope(scope)) return
      checking = true
      try {
        const remote = await rpc<number>('mc_revision', {
          p_space: scope.space.id,
        })
        if (alive && remote > revision.current)
          apply(await fetchSnapshot(scope.space))
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
  }, [scope, onDenied])
  useEffect(() => {
    if (!isReader) return
    let active = true
    const load = async () => {
      const before = notes.current
      try {
        const remote = await readNotes(scope)
        if (
          active &&
          sameScope(scope) &&
          before === notes.current &&
          JSON.stringify(remote) !== JSON.stringify(before)
        ) {
          notes.current = remote
          cached.current = withNotes(cached.current, remote)
          setData(cached.current)
        }
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
  }, [isReader, scope, onDenied, path])
  function commit(update: (current: Workspace) => Workspace) {
    const fromRevision = revision.current
    const task = writes.current.then(async () => {
      if (readOnly || !sameScope(scope))
        throw new Error('Apenas a administração deste espaço pode editar.')
      if (fromRevision !== revision.current)
        throw new Error(
          'Os dados mudaram. Revise o conteúdo antes de salvar novamente.'
        )
      try {
        const result = await saveSnapshot(
          scope.space,
          fromRevision,
          update(cached.current)
        )
        apply(result)
        setConnected(true)
      } catch (error) {
        if (isConflict(error)) apply(await fetchSnapshot(scope.space))
        if (isDenied(error)) onDenied()
        throw error
      }
    })
    writes.current = task.catch(() => {})
    return task
  }
  function savePlan(p: Plan) {
    return commit((current) => ({
      ...current,
      plans: current.plans.some((x) => x.id === p.id)
        ? current.plans.map((x) => (x.id === p.id ? p : x))
        : [...current.plans, p],
    }))
      .then(() => true)
      .catch((error) => {
        setNotice(
          error instanceof Error ? error.message : 'Falha ao salvar o plano.'
        )
        return false
      })
  }
  function saveSong(s: Song) {
    return commit((current) => ({
      ...current,
      songs: current.songs.some((x) => x.id === s.id)
        ? current.songs.map((x) => (x.id === s.id ? s : x))
        : [...current.songs, s],
    }))
  }
  async function savePersonalNote(song: Song, previous: string) {
    if (!sameScope(scope)) throw new Error('A sessão mudou.')
    try {
      await writeNote(scope, song.id, song.notes, previous)
    } catch (error) {
      if (isConflict(error) && sameScope(scope)) {
        notes.current = await readNotes(scope)
        cached.current = withNotes(cached.current, notes.current)
        setData(cached.current)
        throw new Error(
          'Sua anotação mudou em outra sessão. Copie seu rascunho e reabra a anotação para revisar a versão atual.'
        )
      }
      if (isDenied(error)) onDenied()
      throw error
    }
    const next = { ...notes.current, [song.id]: song.notes }
    if (!sameScope(scope)) return
    notes.current = next
    cached.current = withNotes(cached.current, next)
    setData(cached.current)
  }
  async function deletePlan(p: Plan) {
    try {
      await commit((current) => ({
        ...current,
        plans: current.plans.filter((x) => x.id !== p.id),
      }))
    } catch {
      throw new Error(
        'Não foi possível excluir o plano. Confira a conexão e atualize os dados.'
      )
    }
    navigate('/planos', true)
  }
  async function deleteSong(s: Song) {
    let removed: Song | undefined
    await commit((current) => {
      const plan = current.plans.find((p) =>
        p.items.some((item) => item.songId === s.id)
      )
      if (plan)
        throw new Error(
          'Remova a música do roteiro “' + plan.title + '” antes de excluí-la.'
        )
      removed = current.songs.find((x) => x.id === s.id)
      return { ...current, songs: current.songs.filter((x) => x.id !== s.id) }
    })
    if (
      removed?.pdfId &&
      !cached.current.songs.some((x) => x.pdfId === removed?.pdfId)
    ) {
      await removeScores([removed.pdfId]).catch(() => {})
    }
  }
  const openPlan = (p: Plan) => navigate('/planos/' + p.id)
  const openSet = (p: Plan, i: number) => navigate('/palco/' + p.id + '/' + i)
  const openLibrary = () => navigate('/repertorio')
  async function importFile(file?: File) {
    if (!file) return
    setBusy('Importando plano…')
    try {
      const { importPlan } = await import('../features/plans/transfer')
      const imported = await importPlan(file)
      try {
        await commit((current) => ({
          ...current,
          plans: [...current.plans, imported.plan],
          songs: [...current.songs, ...imported.songs],
        }))
      } catch (error) {
        await removeScores(
          imported.songs.flatMap((s) => (s.pdfId ? [s.pdfId] : []))
        ).catch(() => {})
        throw error
      }
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
      const { sharePlan } = await import('../features/plans/transfer')
      await sharePlan(plan, data.songs)
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
              onInvite={() =>
                rpc<string>('mc_invite', { p_space: scope.space.id })
              }
              onRevoke={() =>
                rpc<void>('mc_revoke_invites', { p_space: scope.space.id })
              }
              onMembers={() =>
                rpc<Membership[]>('mc_members', { p_space: scope.space.id })
              }
              onRemoveMember={(id) =>
                rpc<void>('mc_remove_member', {
                  p_space: scope.space.id,
                  p_user: id,
                })
              }
              onLeave={onLeave}
              onSwitch={onSwitch}
              onMigrate={
                canMigrate &&
                !readOnly &&
                !data.plans.length &&
                !data.songs.length
                  ? async () => {
                      const next = await migrateLocal(scope)
                      notes.current = await readNotes(scope)
                      apply(next)
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
