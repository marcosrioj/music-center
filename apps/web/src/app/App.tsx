import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, AccountSession } from '../application/session'
import type { WorkspaceServices } from '../application/workspaces'
import type { DeviceNavigation } from '../application/deviceNavigation'
import type { RepertoireServices } from '../features/repertoire/services'
import type { Notes, Scope, Snapshot, Space } from '../domain/space'
import { Shell, Logo } from './Shell'
import { Access } from '../features/account/Access'
import { SpacePicker } from '../features/account/SpacePicker'

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
  session,
  workspaces,
  navigation,
  repertoireFor,
  webUrl,
  invite,
  onJoined,
  leave,
}: {
  user: Account
  session: AccountSession
  workspaces: WorkspaceServices
  navigation: DeviceNavigation
  repertoireFor: (scope: Scope) => RepertoireServices
  webUrl: string
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
    void workspaces
      .legacyWorkspace()
      .then((data) => {
        if (mounted.current) setLegacy(!!data)
      })
      .catch(() => {})
    return () => {
      mounted.current = false
      request.current++
      workspaces.activateScores()
    }
  }, [workspaces])
  const reset = useCallback(() => {
    request.current++
    workspaces.activateScores()
    setOpened(undefined)
    setSpaces(null)
    history.replaceState(null, '', location.pathname)
    setAttempt((n) => n + 1)
  }, [workspaces])
  const deny = useCallback(() => {
    reset()
    setMessage('Seu acesso a este espaço mudou. Escolha um espaço disponível.')
  }, [reset])
  useEffect(() => {
    let active = true
    workspaces
      .list()
      .then((list) => {
        if (active) setSpaces(list)
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [attempt, workspaces])
  useEffect(() => {
    if (invite) reset()
  }, [invite, reset])

  async function openSpace(space: Space, bringLocal = false) {
    const current = ++request.current
    const scope = { space, userId: user.id }
    const snapshot = bringLocal
      ? await workspaces.migrateLocal(scope)
      : await workspaces.fetchSnapshot(space)
    const notes = await workspaces.readNotes(scope)
    if (!mounted.current || request.current !== current) return
    workspaces.activateScores(scope)
    history.replaceState(null, '', location.pathname + '#/inicio')
    setMessage('')
    setOpened({ scope, snapshot, notes })
  }
  async function create(name: string, bringLocal: boolean) {
    const newSpace = await workspaces.create(name.trim())
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
    const next = await workspaces.join(token)
    setSpaces((old) => [...(old || []).filter((s) => s.id !== next.id), next])
    onJoined()
    await openSpace(next)
  }
  if (opened)
    return (
      <Shell
        key={user.id + opened.scope.space.id}
        services={workspaces}
        navigation={navigation}
        repertoireFor={repertoireFor}
        webUrl={webUrl}
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
          await session.deleteAccount()
          leave()
        }}
      />
    </>
  )
}

type OnlineAppProps = {
  session: AccountSession
  workspaces: WorkspaceServices
  navigation: DeviceNavigation
  repertoireFor: (scope: Scope) => RepertoireServices
  webUrl: string
}

export function OnlineApp({
  session,
  workspaces,
  navigation,
  repertoireFor,
  webUrl,
}: OnlineAppProps) {
  const [user, setUser] = useState<Account | null>(null)
  const [ready, setReady] = useState(!session.configured)
  const [invite, setInvite] = useState(session.readInvite)
  const [recoveryUser, setRecoveryUser] = useState<string | null>(null)
  const [checkingLink, setCheckingLink] = useState(false)
  const [warning, setWarning] = useState('')
  const recover = !!user && recoveryUser === user.id
  useEffect(() => {
    const stopInvite = session.watchInvite(setInvite)
    const stopSession = session.observe({
      changed(current, recovery) {
        if (!current) workspaces.activateScores()
        setRecoveryUser(recovery)
        setUser(current)
        setReady(true)
      },
      checking: setCheckingLink,
      linkWarning: setWarning,
    })
    return () => {
      stopSession()
      stopInvite()
    }
  }, [session, workspaces])

  const leave = () => {
    void session
      .signOut()
      .then(() => {
        workspaces.activateScores()
        setRecoveryUser(null)
        setUser(null)
        history.replaceState(null, '', location.pathname)
      })
      .catch(() =>
        setWarning(
          'Não foi possível sair. Confira a conexão e tente novamente.'
        )
      )
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
          session={session}
          workspaces={workspaces}
          navigation={navigation}
          repertoireFor={repertoireFor}
          webUrl={webUrl}
          invite={invite}
          onJoined={() => {
            session.clearInvite()
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
        configured={session.configured}
        inviteToken={invite}
        onRecovery={recover}
        onLogin={session.signIn}
        onRegister={async (email, password) => {
          const { needsConfirmation } = await session.signUp(email, password)
          if (needsConfirmation)
            return 'Confira seu e-mail para confirmar o cadastro. Depois entre no MusicCenter.'
        }}
        onResetPassword={session.resetPassword}
        onUpdatePassword={async (password) => {
          await session.changePassword(password)
          setRecoveryUser(null)
        }}
      />
    </>
  )
}
