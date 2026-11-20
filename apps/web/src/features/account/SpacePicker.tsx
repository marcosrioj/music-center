import { useEffect, useState, type FormEvent } from 'react'
import {
  ChevronRight,
  FolderOpen,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Space } from '../../data/supabase'
import { Brand, Feedback } from './AccountUI'
import { useAction } from './useAction'

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
