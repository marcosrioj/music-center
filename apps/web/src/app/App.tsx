import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Shell, Logo } from './Shell'
import { Access } from '../features/account/Access'
import { SpacePicker } from '../features/account/SpacePicker'
import {
  client,
  db,
  humanError,
  activateScores,
  fetchSnapshot,
  readNotes,
  rpc,
  webUrl,
  projectUrl,
  type Notes,
  type Scope,
  type Snapshot,
  type Space,
} from '../data/supabase'
import { legacyWorkspace, migrateLocal } from '../data/legacyWorkspace'

const pendingKey = 'mc.invite.' + projectUrl
const recoveryKey = 'mc.recovering.' + projectUrl
const nativeCallback = 'app.musiccenter.mobile://auth/callback'
function collectInvite() {
  const token = /^#\/convite\/([0-9a-f]{64})\/?$/i.exec(location.hash)?.[1]
  if (token) {
    sessionStorage.setItem(pendingKey, token)
    history.replaceState(null, '', location.pathname + location.search)
  }
  return sessionStorage.getItem(pendingKey) || ''
}
function Screen({
  message,
  action,
  label,
}: {
  message: string
  action?: () => void
  label?: string
}) {
  return (
    <main className="boot">
      <Logo />
      <p role="status">{message}</p>
      {action && (
        <button className="action-primary" onClick={action}>
          {label}
        </button>
      )}
    </main>
  )
}
type Opened = { scope: Scope; snapshot: Snapshot; notes: Notes }
function Teams({
  user,
  invite,
  onJoined,
  leave,
}: {
  user: User
  invite: string
  onJoined: () => void
  leave: () => void
}) {
  const [spaces, setSpaces] = useState<Space[] | null>(null)
  const [opened, setOpened] = useState<Opened>()
  const [legacy, setLegacy] = useState(false)
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(true)
  const request = useRef(0)
  useEffect(() => {
    mounted.current = true
    void legacyWorkspace()
      .then((data) => {
        if (mounted.current) setLegacy(!!data)
      })
      .catch(() => {})
    return () => {
      mounted.current = false
      request.current++
      activateScores(undefined)
    }
  }, [])
  const reset = useCallback(() => {
    request.current++
    activateScores(undefined)
    setOpened(undefined)
    setSpaces(null)
    history.replaceState(null, '', location.pathname)
    setAttempt((n) => n + 1)
  }, [])
  const deny = useCallback(() => {
    reset()
    setMessage('Seu acesso a este espaço mudou. Escolha um espaço disponível.')
  }, [reset])
  useEffect(() => {
    let active = true
    rpc<Space[]>('mc_list_spaces')
      .then((list) => {
        if (active) setSpaces(list)
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [attempt])
  useEffect(() => {
    if (invite) reset()
  }, [invite, reset])

  async function openSpace(space: Space, bringLocal = false) {
    const current = ++request.current
    const scope = { space, userId: user.id }
    const snapshot = bringLocal
      ? await migrateLocal(scope)
      : await fetchSnapshot(space)
    const notes = await readNotes(scope)
    if (!mounted.current || request.current !== current) return
    activateScores(scope)
    history.replaceState(null, '', location.pathname + '#/inicio')
    setMessage('')
    setOpened({ scope, snapshot, notes })
  }
  async function create(name: string, bringLocal: boolean) {
    const newSpace = await rpc<Space>('mc_create_space', {
      p_name: name.trim(),
    })
    setSpaces((prev) => [...(prev || []), newSpace])
    try {
      await openSpace(newSpace, bringLocal)
    } catch (error) {
      if (bringLocal)
        throw new Error(
          'Espaço criado. Abra-o e tente importar novamente em Gestão. ' +
            (error instanceof Error ? error.message : '')
        )
      throw error
    }
  }
  async function join(token: string) {
    const next = await rpc<Space>('mc_join_space', { p_token: token })
    setSpaces((old) => [...(old || []).filter((s) => s.id !== next.id), next])
    onJoined()
    await openSpace(next)
  }
  if (opened)
    return (
      <Shell
        key={user.id + opened.scope.space.id}
        initial={opened.snapshot}
        scope={opened.scope}
        personalNotes={opened.notes}
        email={user.email || ''}
        onSwitch={reset}
        onLeave={leave}
        onDenied={deny}
        canMigrate={legacy}
      />
    )
  if (!spaces && !message) return <Screen message="Carregando seus espaços…" />
  if (!spaces && message)
    return (
      <div>
        <Screen
          message={message}
          action={() => {
            setMessage('')
            setAttempt((n) => n + 1)
          }}
          label="Tentar novamente"
        />
        <button className="logout-retry" onClick={leave}>
          Sair da conta
        </button>
      </div>
    )
  return (
    <>
      {message && (
        <div className="notice" role="alert">
          {message}
          <button onClick={() => setMessage('')}>Fechar</button>
        </div>
      )}
      <SpacePicker
        email={user.email || ''}
        spaces={spaces || []}
        onOpen={async (id) => {
          const space = spaces?.find((s) => s.id === id)
          if (space) await openSpace(space)
        }}
        onCreate={create}
        onJoin={join}
        onLeave={leave}
        legacyAvailable={legacy}
        inviteToken={invite}
        onDeleteAccount={async () => {
          const { error } = await db().functions.invoke('delete-account', {
            body: {},
          })
          if (error)
            throw new Error(
              'Não foi possível excluir a conta. Tente novamente com uma sessão válida.'
            )
          leave()
        }}
      />
    </>
  )
}

export function OnlineApp() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!client)
  const [invite, setInvite] = useState(collectInvite)
  const [recoveryUser, setRecoveryUser] = useState(() =>
    sessionStorage.getItem(recoveryKey)
  )
  const recover = !!user && recoveryUser === user.id
  const [checkingLink, setCheckingLink] = useState(false)
  const recoverySession = useCallback((id: string | null) => {
    if (id) sessionStorage.setItem(recoveryKey, id)
    else sessionStorage.removeItem(recoveryKey)
    setRecoveryUser(id)
  }, [])
  const [warning, setWarning] = useState('')
  useEffect(() => {
    if (!client) return
    const auth = client.auth
    const { data } = auth.onAuthStateChange((event, session) => {
      const current =
        session?.user && !session.user.is_anonymous ? session.user : null
      if (event === 'PASSWORD_RECOVERY' && current) recoverySession(current.id)
      else if (
        !current ||
        (sessionStorage.getItem(recoveryKey) &&
          sessionStorage.getItem(recoveryKey) !== current.id)
      ) {
        recoverySession(null)
      }
      if (!current) activateScores(undefined)
      setUser(current)
      setReady(true)
    })
    const onHash = () => setInvite(collectInvite())
    window.addEventListener('hashchange', onHash)
    let stopped = false
    let cleanup: (() => void) | undefined
    const handled = new Set<string>()
    const native = Capacitor.isNativePlatform()
    const process = async (raw: string) => {
      if (stopped || handled.has(raw)) return
      const url = new URL(raw)
      if (
        native &&
        (url.protocol !== 'app.musiccenter.mobile:' ||
          url.host !== 'auth' ||
          url.pathname !== '/callback')
      )
        return
      const code = url.searchParams.get('code')
      const linkError =
        url.searchParams.has('error') ||
        new URLSearchParams(url.hash.slice(1)).has('error')
      if (!code && !linkError) return
      handled.add(raw)
      setCheckingLink(true)
      try {
        if (linkError || !code) throw new Error()
        const { data: exchanged, error } = await auth.exchangeCodeForSession(
          code,
          {
            flowId: url.searchParams.get('sb_flow_id') || undefined,
          }
        )
        if (stopped) return
        if (error || !exchanged.user || exchanged.user.is_anonymous)
          throw new Error()
        if ('redirectType' in exchanged) {
          recoverySession(
            exchanged.redirectType === 'recovery' ? exchanged.user.id : null
          )
        }
        setUser(exchanged.user)
        setWarning('')
      } catch {
        if (!stopped)
          setWarning(
            'O link expirou ou foi aberto em outro aparelho. Solicite outro link neste navegador ou aplicativo.'
          )
      } finally {
        if (!native && !stopped) {
          for (const key of [
            'code',
            'sb_flow_id',
            'error',
            'error_code',
            'error_description',
          ])
            url.searchParams.delete(key)
          if (linkError) url.hash = ''
          history.replaceState(
            history.state,
            '',
            url.pathname + url.search + url.hash
          )
        }
        if (!stopped) setCheckingLink(false)
      }
    }
    if (native) {
      void NativeApp.addListener('appUrlOpen', (x) => void process(x.url)).then(
        (handle) => {
          if (stopped) void handle.remove()
          else
            cleanup = () => {
              void handle.remove()
            }
        }
      )
      void NativeApp.getLaunchUrl().then((r) => {
        if (r) void process(r.url)
      })
    } else {
      void process(window.location.href)
    }
    return () => {
      stopped = true
      cleanup?.()
      data.subscription.unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [recoverySession])
  const callback = Capacitor.isNativePlatform()
    ? nativeCallback
    : webUrl || location.origin
  const leave = () => {
    void db()
      .auth.signOut({ scope: 'local' })
      .then(({ error }) => {
        if (error) {
          setWarning(
            'Não foi possível sair. Confira a conexão e tente novamente.'
          )
          return
        }
        activateScores(undefined)
        recoverySession(null)
        setUser(null)
        history.replaceState(null, '', location.pathname)
      })
  }
  if (!ready || checkingLink)
    return <Screen message="Verificando sua sessão…" />
  const warnings = warning && (
    <div className="notice" role="alert">
      {warning}
      <button onClick={() => setWarning('')}>Fechar</button>
    </div>
  )
  if (user && !recover)
    return (
      <>
        {warnings}
        <Teams
          key={user.id}
          user={user}
          invite={invite}
          onJoined={() => {
            sessionStorage.removeItem(pendingKey)
            setInvite('')
          }}
          leave={leave}
        />
      </>
    )
  return (
    <>
      {warnings}
      {recover && (
        <button type="button" className="logout-retry" onClick={leave}>
          Sair da recuperação
        </button>
      )}
      <Access
        configured={!!client}
        inviteToken={invite}
        onRecovery={recover && !!user}
        onLogin={async (email, password) => {
          const { error } = await db().auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw humanError(error)
        }}
        onRegister={async (email, password) => {
          const { data, error } = await db().auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callback },
          })
          if (error) throw humanError(error)
          if (!data.session)
            return 'Confira seu e-mail para confirmar o cadastro. Depois entre no MusicCenter.'
        }}
        onResetPassword={async (email) => {
          const { error } = await db().auth.resetPasswordForEmail(email, {
            redirectTo: callback,
          })
          if (error) throw humanError(error)
        }}
        onUpdatePassword={async (password) => {
          const { error } = await db().auth.updateUser({ password })
          if (error) throw humanError(error)
          recoverySession(null)
        }}
      />
    </>
  )
}
