import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  FolderOpen,
  KeyRound,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import './access.css'

type Role = 'admin' | 'member'
type Space = { id: string; name: string; role: Role }

type AccessProps = {
  configured: boolean
  inviteToken: string
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<string | void>
  onResetPassword: (email: string) => Promise<void>
  onRecovery: boolean
  onUpdatePassword: (password: string) => Promise<void>
}

function Brand() {
  return (
    <div className="brand onboarding-brand">
      <span className="logomark" aria-hidden="true">
        {[9, 17, 25, 14, 20].map((height) => (
          <i key={height} style={{ height }} />
        ))}
      </span>
      <b>MusicCenter</b>
    </div>
  )
}

function errorMessage(reason: unknown) {
  const raw = reason instanceof Error ? reason.message : ''
  if (/invalid login credentials/i.test(raw))
    return 'Confira o e-mail e a senha e tente novamente.'
  if (/email not confirmed/i.test(raw))
    return 'Abra o link de confirmação enviado ao seu e-mail para entrar.'
  if (/already registered/i.test(raw))
    return 'Este e-mail já possui uma conta. Entre com sua senha.'
  if (/failed to fetch|network error|load failed/i.test(raw))
    return 'Não foi possível conectar. Confira sua conexão e tente novamente.'
  if (/rate limit|too many requests/i.test(raw))
    return 'Houve várias tentativas seguidas. Aguarde um pouco antes de tentar novamente.'
  return raw || 'Não foi possível concluir a ação. Tente novamente.'
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const clear = () => {
    setError('')
    setMessage('')
  }
  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    clear()
    try {
      await action()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { busy, message, setMessage, error, clear, run }
}

function Feedback({ error, message }: { error: string; message: string }) {
  if (error)
    return (
      <p className="mc-feedback mc-error" role="alert">
        <CircleAlert size={17} />
        {error}
      </p>
    )
  if (message)
    return (
      <p className="mc-feedback" role="status">
        <Check size={17} />
        {message}
      </p>
    )
  return null
}

function parseToken(input: string): string {
  const clean = input.trim()
  const hash = clean.indexOf('#')
  let token = clean
  if (hash >= 0) {
    const match = /^#\/convite\/([\w-]+)\/?$/.exec(clean.slice(hash))
    if (!match)
      throw new Error('Use o link de convite enviado pelo gestor do espaço.')
    token = match[1]
  }
  if (!/^[\w-]{8,512}$/.test(token))
    throw new Error('Confira o código ou cole o link de convite completo.')
  return token
}

function inviteUrl(webUrl: string, token: string) {
  if (!webUrl.trim()) return ''
  try {
    const url = new URL(webUrl)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return ''
    url.search = ''
    url.hash = '/convite/' + encodeURIComponent(token)
    return url.href
  } catch {
    return ''
  }
}

type Mode = 'login' | 'register' | 'reset' | 'recover'

export function Access(props: AccessProps) {
  const {
    configured,
    inviteToken,
    onRecovery,
    onLogin,
    onRegister,
    onResetPassword,
    onUpdatePassword,
  } = props
  const [choice, setChoice] = useState<Mode>('login')
  const mode = onRecovery ? 'recover' : choice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const status = useAction()
  function choose(next: Mode) {
    status.clear()
    setPassword('')
    setChoice(next)
  }
  const labels: Record<Mode, string> = {
    login: 'Entrar',
    register: 'Criar conta',
    reset: 'Enviar link de recuperação',
    recover: 'Salvar nova senha',
  }
  const headings: Record<Mode, string> = {
    login: 'Acessar MusicCenter',
    register: 'Criar conta',
    reset: 'Recuperar senha',
    recover: 'Escolher nova senha',
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    await status.run(async () => {
      switch (mode) {
        case 'login':
          await onLogin(email.trim(), password)
          break
        case 'register': {
          const result = await onRegister(email.trim(), password)
          if (result) {
            choose('login')
            status.setMessage(result)
          }
          break
        }
        case 'reset':
          await onResetPassword(email.trim())
          choose('login')
          status.setMessage(
            'Se o e-mail estiver cadastrado, você receberá um link para escolher outra senha.'
          )
          break
        case 'recover':
          await onUpdatePassword(password)
          setPassword('')
          setChoice('login')
          status.setMessage('Senha atualizada.')
          break
      }
    })
  }
  return (
    <main className="mc-entry">
      <div className="mc-entry-box">
        <aside className="mc-cover">
          <Brand />
          <div className="mc-cover-copy">
            <h2>Planejamento musical em equipe</h2>
            <p>
              Prepare planos, escalas e repertório no navegador. A equipe
              acompanha as músicas pelo celular ou tablet.
            </p>
          </div>
        </aside>
        <section className="mc-entry-panel" aria-labelledby="mc-access-heading">
          {!configured ? (
            <>
              <span className="mc-section-icon">
                <ShieldCheck size={23} />
              </span>
              <h1 id="mc-access-heading">Conexão com o espaço</h1>
              <p role="status">
                O serviço online ainda precisa ser configurado. Peça ao
                responsável pelo MusicCenter para conectar esta instalação ao
                Supabase.
              </p>
            </>
          ) : (
            <>
              <h1 id="mc-access-heading">{headings[mode]}</h1>
              {inviteToken && (mode === 'login' || mode === 'register') && (
                <p className="mc-invite-context">
                  <Link2 size={17} />
                  Entre ou cadastre-se para aceitar o convite.
                </p>
              )}
              {mode === 'login' && !inviteToken && (
                <p>Entre com sua conta para abrir os espaços da equipe.</p>
              )}
              {mode === 'register' && !inviteToken && (
                <p>
                  Crie sua conta para participar de uma equipe ou gerenciar seu
                  próprio espaço.
                </p>
              )}
              {mode === 'reset' && (
                <p>Enviaremos um link para o e-mail vinculado à sua conta.</p>
              )}
              <form onSubmit={submit} className="mc-form">
                <fieldset disabled={status.busy}>
                  {mode !== 'recover' && (
                    <label>
                      E-mail
                      <input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="voce@exemplo.com"
                        value={email}
                        maxLength={320}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </label>
                  )}
                  {(mode === 'login' ||
                    mode === 'recover' ||
                    mode === 'register') && (
                    <label>
                      {mode === 'recover' ? 'Nova senha' : 'Senha'}
                      <input
                        key={mode}
                        type="password"
                        autoComplete={
                          mode === 'login' ? 'current-password' : 'new-password'
                        }
                        minLength={mode === 'login' ? 1 : 8}
                        placeholder={
                          mode === 'login'
                            ? undefined
                            : 'Pelo menos 8 caracteres'
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </label>
                  )}
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="mc-text mc-forgot"
                      onClick={() => choose('reset')}
                    >
                      Esqueci minha senha
                    </button>
                  )}
                  <Feedback error={status.error} message={status.message} />
                  <button type="submit" className="mc-primary">
                    {labels[mode]}
                    {status.busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </button>
                </fieldset>
              </form>
              {mode === 'login' && (
                <button
                  type="button"
                  className="mc-text mc-alternate"
                  disabled={status.busy}
                  onClick={() => choose('register')}
                >
                  <Plus size={16} />
                  Criar conta
                </button>
              )}
              {(mode === 'register' || mode === 'reset') && (
                <button
                  type="button"
                  className="mc-text mc-alternate"
                  disabled={status.busy}
                  onClick={() => choose('login')}
                >
                  <ArrowLeft size={16} />
                  Voltar para entrar
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

type SpacePickerProps = {
  spaces: Space[]
  onOpen: (id: string) => Promise<void>
  onCreate: (name: string, bringLocal: boolean) => Promise<void>
  onLeave: () => void
  legacyAvailable: boolean
  email: string
  inviteToken: string
  onJoin: (token: string) => Promise<void>
  onDeleteAccount?: () => Promise<void>
}

export function SpacePicker({
  spaces,
  onOpen,
  onCreate,
  onLeave,
  legacyAvailable,
  email,
  inviteToken,
  onJoin,
  onDeleteAccount,
}: SpacePickerProps) {
  const [newSpace, setNewSpace] = useState(false)
  const [joining, setJoining] = useState(!!inviteToken)
  const [invite, setInvite] = useState(inviteToken)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  useEffect(() => {
    if (inviteToken) {
      setInvite(inviteToken)
      setJoining(true)
      setNewSpace(false)
    }
  }, [inviteToken])
  const [name, setName] = useState('')
  const [bringLocal, setBringLocal] = useState(false)
  const status = useAction()
  const creating = newSpace && !joining
  async function create(event: FormEvent) {
    event.preventDefault()
    await status.run(async () => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Informe o nome do espaço.')
      await onCreate(trimmed, legacyAvailable && bringLocal)
    })
  }
  return (
    <main className="mc-picker">
      <header>
        <Brand />
        <button className="mc-text" onClick={onLeave} disabled={status.busy}>
          <LogOut size={16} />
          Sair
        </button>
      </header>
      <section className="mc-picker-inner">
        <div className="mc-picker-heading">
          <div>
            <h1>Meus espaços</h1>
            <p>
              <Mail size={16} />
              {email}
            </p>
          </div>
        </div>
        {spaces.length === 0 && !joining && !creating && (
          <p className="mc-picker-intro">
            Crie um espaço para organizar sua equipe ou participe de um espaço
            por convite.
          </p>
        )}
        {!creating && !joining && (
          <div className="mc-actions mc-picker-actions">
            <button
              className="mc-primary"
              disabled={status.busy}
              onClick={() => {
                setNewSpace(true)
                status.clear()
              }}
            >
              <Plus size={17} />
              Novo espaço
            </button>
            <button
              className="mc-plain"
              disabled={status.busy}
              onClick={() => {
                setJoining(true)
                status.clear()
              }}
            >
              <Link2 size={16} />
              Aceitar convite
            </button>
          </div>
        )}
        {joining && (
          <form
            className="mc-form mc-panel"
            onSubmit={(event) => {
              event.preventDefault()
              void status.run(async () => {
                await onJoin(parseToken(invite))
                setJoining(false)
                setInvite('')
              })
            }}
          >
            <fieldset disabled={status.busy}>
              <h2>Participar de um espaço</h2>
              <label>
                Link ou código de convite
                <input
                  required
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="Cole o convite aqui"
                />
              </label>
              <div className="mc-actions">
                <button className="mc-primary" type="submit">
                  <Link2 size={16} />
                  Aceitar convite
                </button>
                <button
                  className="mc-plain"
                  type="button"
                  onClick={() => {
                    setJoining(false)
                    status.clear()
                  }}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {creating && (
          <form className="mc-form mc-panel" onSubmit={create}>
            <fieldset disabled={status.busy}>
              <h2>
                {spaces.length
                  ? 'Novo espaço'
                  : 'Crie o primeiro espaço da equipe'}
              </h2>
              <label>
                Nome do espaço
                <input
                  value={name}
                  maxLength={120}
                  required
                  placeholder="Ex. Equipe de louvor"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {legacyAvailable && (
                <label className="mc-check">
                  <input
                    type="checkbox"
                    checked={bringLocal}
                    onChange={(e) => setBringLocal(e.target.checked)}
                  />
                  <span>
                    Levar planos, músicas e partituras deste aparelho para o
                    novo espaço
                  </span>
                </label>
              )}
              <div className="mc-actions">
                <button className="mc-primary" type="submit">
                  Criar espaço
                  {status.busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </button>
                <button
                  type="button"
                  className="mc-plain"
                  onClick={() => {
                    setNewSpace(false)
                    status.clear()
                  }}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        )}
        <Feedback error={status.error} message={status.message} />
        {spaces.length > 0 && (
          <div className="mc-spaces">
            {spaces.map((s) => (
              <button
                key={s.id}
                className="mc-space-row"
                disabled={status.busy}
                onClick={() => void status.run(() => onOpen(s.id))}
              >
                <span className="mc-section-icon">
                  <FolderOpen size={20} />
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.role === 'admin' ? 'Administrador' : 'Leitura'}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
        {onDeleteAccount && (
          <div className="mc-account-removal">
            {deleteConfirm ? (
              <form
                className="mc-form mc-panel"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (deleteWord === 'EXCLUIR') void status.run(onDeleteAccount)
                }}
              >
                <fieldset disabled={status.busy}>
                  <h2>Excluir conta permanentemente?</h2>
                  <p>
                    Excluir sua conta também apaga os espaços que você criou e
                    os arquivos desses espaços para toda a equipe. Guarde os
                    planos que precisar antes de continuar.
                  </p>
                  <label>
                    Digite EXCLUIR para confirmar
                    <input
                      value={deleteWord}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setDeleteWord(e.target.value)}
                    />
                  </label>
                  <div className="mc-actions">
                    <button
                      className="mc-danger"
                      disabled={deleteWord !== 'EXCLUIR'}
                    >
                      Excluir minha conta
                    </button>
                    <button
                      type="button"
                      className="mc-plain"
                      onClick={() => {
                        setDeleteConfirm(false)
                        setDeleteWord('')
                        status.clear()
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <button
                className="mc-text mc-revoke"
                disabled={status.busy}
                onClick={() => {
                  setDeleteConfirm(true)
                  status.clear()
                }}
              >
                <Trash2 size={15} />
                Excluir minha conta
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

type ManagerProps = {
  name: string
  role: Role
  email: string
  webUrl: string
  onInvite: () => Promise<string>
  onRevoke: () => Promise<void>
  onMembers: () => Promise<{ id: string; email: string; role: Role }[]>
  onRemoveMember: (id: string) => Promise<void>
  onLeave: () => void
  onSwitch: () => void
  onMigrate?: () => Promise<void>
}

function InviteValue({ value, label }: { value: string; label: string }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('Copiado.')
    } catch {
      input.current?.focus()
      input.current?.select()
      setStatus('Selecione Copiar no menu do dispositivo.')
    }
  }
  return (
    <div className="mc-invite-value">
      <label htmlFor={id}>{label}</label>
      <span>
        <input
          id={id}
          ref={input}
          value={value}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.target.select()}
        />
        <button
          className="mc-plain"
          onClick={() => void copy()}
          aria-label={'Copiar ' + label.toLocaleLowerCase('pt-BR')}
        >
          <Copy size={16} />
          Copiar
        </button>
      </span>
      {status && <small role="status">{status}</small>}
    </div>
  )
}

export function Manager({
  name,
  role,
  email,
  webUrl,
  onInvite,
  onRevoke,
  onMembers,
  onRemoveMember,
  onLeave,
  onSwitch,
  onMigrate,
}: ManagerProps) {
  const status = useAction()
  const [token, setToken] = useState('')
  const [members, setMembers] = useState<
    { id: string; email: string; role: Role }[] | null
  >(null)
  const [removeId, setRemoveId] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmMigrate, setConfirmMigrate] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const url = token && inviteUrl(webUrl, token)
  const isAdmin = role === 'admin'
  useEffect(() => {
    setMembers(null)
    setRemoveId('')
    setToken('')
    setConfirmRevoke(false)
    setConfirmMigrate(false)
    setShowCode(false)
  }, [name, email, role])
  return (
    <section className="mc-manager">
      <header>
        <h1>Gerenciar espaço</h1>
        <p>{name}</p>
      </header>
      {isAdmin && (
        <article className="mc-panel">
          <div className="mc-card-title">
            <span className="mc-section-icon">
              <Link2 size={20} />
            </span>
            <div>
              <h2>Convites de leitura</h2>
              <p>
                Depois de entrar com sua conta e aceitar o convite, cada músico
                poderá consultar roteiros, escalas e partituras.
              </p>
            </div>
          </div>
          {token ? (
            <div className="mc-invitation" key={token}>
              {url && <InviteValue value={url} label="Link de convite" />}
              {url && (
                <button
                  className="mc-text"
                  aria-expanded={showCode}
                  onClick={() => setShowCode(!showCode)}
                >
                  <KeyRound size={16} />
                  {showCode
                    ? 'Ocultar código'
                    : 'Mostrar código para o aplicativo'}
                </button>
              )}
              {(!url || showCode) && (
                <InviteValue value={token} label="Código de convite" />
              )}
            </div>
          ) : (
            <button
              className="mc-primary"
              disabled={status.busy}
              onClick={() =>
                void status.run(async () => {
                  const next = await onInvite()
                  if (!next)
                    throw new Error('Não foi possível gerar um convite.')
                  setToken(next)
                })
              }
            >
              <Plus size={17} />
              Gerar convite de leitura
            </button>
          )}
          {confirmRevoke ? (
            <div
              className="mc-inline-confirm"
              role="group"
              aria-label="Confirmar revogação"
            >
              <strong>Revogar todos os convites?</strong>
              <p>
                Novos participantes precisarão de outro convite. Quem já entrou
                continua na lista de integrantes.
              </p>
              <div className="mc-actions">
                <button
                  className="mc-danger"
                  disabled={status.busy}
                  onClick={() =>
                    void status.run(async () => {
                      await onRevoke()
                      setToken('')
                      setShowCode(false)
                      setConfirmRevoke(false)
                      status.setMessage('Convites revogados.')
                    })
                  }
                >
                  Revogar convites
                </button>
                <button
                  className="mc-plain"
                  disabled={status.busy}
                  onClick={() => setConfirmRevoke(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mc-text mc-revoke"
              disabled={status.busy}
              onClick={() => {
                status.clear()
                setConfirmRevoke(true)
              }}
            >
              <Trash2 size={15} />
              Revogar todos os convites
            </button>
          )}
        </article>
      )}
      {isAdmin && (
        <article className="mc-panel">
          <div className="mc-card-title">
            <span className="mc-section-icon">
              <UsersRound size={20} />
            </span>
            <div>
              <h2>Integrantes com acesso</h2>
              <p>
                Consulte as contas que participam deste espaço e remova acessos
                quando necessário.
              </p>
            </div>
          </div>
          <button
            className="mc-plain"
            disabled={status.busy}
            onClick={() =>
              void status.run(async () => {
                setMembers(await onMembers())
                setRemoveId('')
              })
            }
          >
            {members ? 'Atualizar lista' : 'Ver integrantes'}
          </button>
          {members && (
            <ul className="mc-members">
              {members.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.email}</strong>
                    <small>
                      {m.role === 'admin' ? 'Administrador' : 'Leitura'}
                    </small>
                  </div>
                  {m.role === 'member' &&
                    (removeId !== m.id ? (
                      <button
                        className="mc-text mc-revoke"
                        disabled={status.busy}
                        onClick={() => {
                          setRemoveId(m.id)
                          status.clear()
                        }}
                      >
                        Remover
                      </button>
                    ) : (
                      <div className="mc-inline-confirm">
                        <strong>Retirar o acesso de {m.email}?</strong>
                        <div className="mc-actions">
                          <button
                            className="mc-danger"
                            disabled={status.busy}
                            onClick={() =>
                              void status.run(async () => {
                                await onRemoveMember(m.id)
                                setMembers(
                                  (current) =>
                                    current?.filter(
                                      (member) => member.id !== m.id
                                    ) ?? null
                                )
                                setRemoveId('')
                                status.setMessage('Acesso removido.')
                              })
                            }
                          >
                            Confirmar remoção
                          </button>
                          <button
                            className="mc-plain"
                            disabled={status.busy}
                            onClick={() => setRemoveId('')}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
      {isAdmin && onMigrate && (
        <article className="mc-panel">
          <div className="mc-card-title">
            <span className="mc-section-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <h2>Acervo deste aparelho</h2>
              <p>
                Importe os planos, músicas e partituras da versão local para o
                espaço da equipe.
              </p>
            </div>
          </div>
          {confirmMigrate ? (
            <div className="mc-inline-confirm">
              <strong>Adicionar o acervo ao espaço “{name}”?</strong>
              <div className="mc-actions">
                <button
                  className="mc-primary"
                  disabled={status.busy}
                  onClick={() =>
                    void status.run(async () => {
                      await onMigrate()
                      setConfirmMigrate(false)
                      status.setMessage('Acervo importado.')
                    })
                  }
                >
                  Confirmar importação
                </button>
                <button
                  className="mc-plain"
                  disabled={status.busy}
                  onClick={() => setConfirmMigrate(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mc-plain"
              disabled={status.busy}
              onClick={() => {
                status.clear()
                setConfirmMigrate(true)
              }}
            >
              Importar acervo local
            </button>
          )}
        </article>
      )}
      <article className="mc-panel">
        <div className="mc-card-title">
          <span className="mc-section-icon">
            {isAdmin ? <ShieldCheck size={20} /> : <UsersRound size={20} />}
          </span>
          <div>
            <h2>Seu acesso</h2>
            <p>
              {isAdmin ? 'Administrador' : 'Leitura'}
              {email ? ' · ' + email : ''}
            </p>
          </div>
        </div>
        <div className="mc-actions">
          {email && (
            <button
              className="mc-plain"
              onClick={onSwitch}
              disabled={status.busy}
            >
              <FolderOpen size={17} />
              Trocar de espaço
            </button>
          )}
          <button className="mc-text" onClick={onLeave} disabled={status.busy}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </article>
      <Feedback message={status.message} error={status.error} />
    </section>
  )
}
