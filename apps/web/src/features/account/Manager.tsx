import { useEffect, useId, useRef, useState } from 'react'
import {
  BookOpen,
  Copy,
  FolderOpen,
  KeyRound,
  Link2,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import type { Membership, Space } from '../../data/supabase'
import { Feedback } from './AccountUI'
import { useAction } from './useAction'

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

type ManagerProps = {
  name: string
  role: Space['role']
  email: string
  webUrl: string
  onInvite: () => Promise<string>
  onRevoke: () => Promise<void>
  onMembers: () => Promise<Membership[]>
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
  const [members, setMembers] = useState<Membership[] | null>(null)
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
