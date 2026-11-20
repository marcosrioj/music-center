import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { Brand, Feedback } from './AccountUI'
import { useAction } from './useAction'

type AccessProps = {
  configured: boolean
  inviteToken: string
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<string | void>
  onResetPassword: (email: string) => Promise<void>
  onRecovery: boolean
  onUpdatePassword: (password: string) => Promise<void>
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
