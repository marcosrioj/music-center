import type { Plugin } from 'vite'

function address(value: string) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error()
  }
  return url
}

function isPublicKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) return true
  const parts = key.split('.')
  if (
    parts.length !== 3 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return false
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'anon'
}

function configJson(env: Record<string, string>) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const webUrl = env.VITE_PUBLIC_WEB_URL?.trim()
  if (!url && !key && !webUrl) return '{}\n'

  try {
    if (!url || !key || key.length > 4096 || !isPublicKey(key)) throw new Error()
    const panel = webUrl ? address(webUrl) : undefined
    if (panel && panel.pathname !== '/') throw new Error()
    const config = { url: address(url).href.replace(/\/$/, ''), key, webUrl: panel?.origin }
    return JSON.stringify(config, null, 2) + '\n'
  } catch {
    throw new Error(
      'Configuração pública inválida. Confira VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e VITE_PUBLIC_WEB_URL. Use uma chave publicável ou anon.'
    )
  }
}

export function publicConfig(env: Record<string, string>): Plugin {
  const fileName = 'musiccenter-config.json'
  const source = configJson(env)
  return {
    name: 'musiccenter-public-config',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (
          request.url?.split('?')[0] !== '/' + fileName ||
          (request.method !== 'GET' && request.method !== 'HEAD')
        ) return next()
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(request.method === 'HEAD' ? undefined : source)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source })
    },
  }
}
