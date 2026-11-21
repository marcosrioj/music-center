import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import type { Configuration, PublicConfig } from '../application/configuration'

declare global {
  interface Window {
    __MC_CONFIG?: PublicConfig
  }
}

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

export const panelConfiguration: Configuration = {
  native,
  async load() {
    try {
      return { settings: await bundledConfig() }
    } catch {
      if (!native) return {}
      const { value } = await Preferences.get({ key: preference })
      if (!value) return {}
      try {
        return { settings: await panelConfig(value), savedPanel: value }
      } catch {
        return { savedPanel: value, failed: true }
      }
    }
  },
  async connect(value) {
    const settings = await panelConfig(value)
    await Preferences.set({ key: preference, value: settings.webUrl! })
    return settings
  },
  activate(settings) {
    window.__MC_CONFIG = settings
  },
}
