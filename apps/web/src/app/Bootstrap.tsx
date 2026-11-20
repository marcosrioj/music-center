import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import '../features/account/access.css'

type PublicConfig = { url: string; key: string; webUrl?: string }
declare global {
  interface Window {
    __MC_CONFIG?: PublicConfig
  }
}

const OnlineApp = lazy(() =>
  import('./App').then((module) => ({ default: module.OnlineApp }))
)
const preference = 'mc.online.panel.v1'
const filePath = '/musiccenter-config.json'
const native = Capacitor.isNativePlatform()

function address(value: unknown, allowLoopback: boolean) {
  if (typeof value !== 'string') throw new Error()
  const parsed = new URL(value.trim())
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (
    parsed.protocol !== 'https:' &&
    !(allowLoopback && parsed.protocol === 'http:' && loopback)
  )
    throw new Error()
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error()
  return parsed
}

function publicKey(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error()
  const key = value.trim()
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) return key
  const parts = key.split('.')
  if (
    parts.length === 3 &&
    parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  ) {
    const payload = JSON.parse(
      atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'))
    )
    if (payload.role === 'anon') return key
  }
  throw new Error()
}

function config(
  raw: unknown,
  panelOrigin?: string,
  allowLoopback = false
): PublicConfig {
  if (typeof raw !== 'object' || !raw) throw new Error()
  const data = raw as Record<string, unknown>
  const url = address(data.url, allowLoopback).href.replace(/\/$/, '')
  const webUrl = data.webUrl ? address(data.webUrl, allowLoopback) : undefined
  if (
    webUrl &&
    (webUrl.pathname !== '/' || (panelOrigin && webUrl.origin !== panelOrigin))
  )
    throw new Error()
  return {
    url,
    key: publicKey(data.key),
    webUrl: webUrl?.origin ?? panelOrigin,
  }
}

async function bundledConfig() {
  const raw = {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    webUrl: import.meta.env.VITE_PUBLIC_WEB_URL,
  }
  const allowLoopback =
    !native && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  if (raw.url && raw.key) {
    return config(raw, undefined, allowLoopback)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(filePath, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error()
    const body = await response.text()
    if (body.length > 16384) throw new Error()
    return config(
      JSON.parse(body),
      native ? undefined : location.origin,
      allowLoopback
    )
  } finally {
    clearTimeout(timer)
  }
}

async function panelConfig(value: string) {
  let origin: string
  try {
    origin = address(value, false).origin
  } catch {
    throw new Error('Informe o endereço HTTPS do painel da equipe.')
  }
  try {
    // Native HTTP also supports static sites that omit CORS headers on their public JSON file.
    const response = await CapacitorHttp.get({
      url: origin + filePath,
      responseType: 'text',
      disableRedirects: true,
      connectTimeout: 8000,
      readTimeout: 10000,
      headers: { Accept: 'application/json' },
    })
    if (
      response.status !== 200 ||
      (response.url && new URL(response.url).origin !== origin)
    )
      throw new Error()
    let data: unknown = response.data
    if (typeof data === 'string') {
      if (data.length > 16384) throw new Error()
      data = JSON.parse(data)
    }
    return config(data, origin)
  } catch {
    throw new Error(
      'Não foi possível ler a configuração do painel. Confira o endereço e a conexão.'
    )
  }
}

function Loading() {
  return (
    <main className="boot">
      <strong className="brand">MusicCenter</strong>
      <p role="status">Conectando ao painel…</p>
    </main>
  )
}

export function Bootstrap() {
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
      let settings: PublicConfig
      try {
        settings = await bundledConfig()
      } catch {
        if (!native) throw new Error()
        const { value } = await Preferences.get({ key: preference })
        if (!value) return
        if (active) setPanel(value)
        settings = await panelConfig(value)
      }
      if (active) {
        window.__MC_CONFIG = settings
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
  }, [attempt])

  async function connect(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const settings = await panelConfig(panel)
      await Preferences.set({ key: preference, value: settings.webUrl! })
      window.__MC_CONFIG = settings
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
