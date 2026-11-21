import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import type { Configuration } from '../application/configuration'
import '../features/account/access.css'

const OnlineApp = lazy(async () => {
  const [{ OnlineApp }, { runtime }] = await Promise.all([
    import('./App'),
    import('./runtime'),
  ])
  return { default: () => <OnlineApp {...runtime} /> }
})

function Loading() {
  return (
    <main className="boot">
      <strong className="brand">MusicCenter</strong>
      <p role="status">Conectando ao painel…</p>
    </main>
  )
}

export function Bootstrap({ configuration }: { configuration: Configuration }) {
  const { native } = configuration
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function start() {
      const { settings, savedPanel, failed } = await configuration.load()
      if (!active) return
      if (savedPanel) setPanel(savedPanel)
      if (failed) throw new Error()
      if (settings) {
        configuration.activate(settings)
        setReady(true)
      }
    }
    void start()
      .catch(() => {
        if (active && native)
          setError(
            'Não foi possível conectar ao painel salvo. Confira o endereço ou tente novamente.'
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt, configuration, native])

  async function connect(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const settings = await configuration.connect(panel)
      configuration.activate(settings)
      setReady(true)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível conectar ao painel.'
      )
    } finally {
      setBusy(false)
    }
  }
  if (ready)
    return (
      <Suspense fallback={<Loading />}>
        <OnlineApp />
      </Suspense>
    )
  if (loading) return <Loading />
  return (
    <main className="mc-entry">
      <div className="mc-entry-box">
        <div className="mc-cover">
          <div className="brand">MusicCenter</div>
        </div>
        <section className="mc-entry-panel">
          <h1>{native ? 'Conectar ao painel' : 'Configurar o painel'}</h1>
          {native ? (
            <>
              <p>Use o endereço do painel web que sua equipe compartilhou.</p>
              <form className="mc-form" onSubmit={connect}>
                <fieldset disabled={busy}>
                  <label htmlFor="mc-panel-address">Endereço do painel</label>
                  <input
                    id="mc-panel-address"
                    type="url"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="https://painel.exemplo.com"
                    value={panel}
                    onChange={(event) => setPanel(event.target.value)}
                  />
                  {error && (
                    <p role="alert" className="rep-error">
                      {error}
                    </p>
                  )}
                  <button type="submit" className="action-primary">
                    {busy ? 'Conectando…' : 'Conectar'}
                  </button>
                </fieldset>
              </form>
            </>
          ) : (
            <>
              <p>
                A configuração do Supabase está indisponível. Para ativar o
                acesso, publique o arquivo <code>musiccenter-config.json</code>{' '}
                na raiz do site com a URL do projeto e a chave pública.
              </p>
              <button
                className="action-primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
