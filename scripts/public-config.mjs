import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode =
  process.env.npm_lifecycle_event === 'predev' ? 'development' : 'production'
const env = loadEnv(mode, root, 'VITE_')
function address(value) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error()
  return url
}
function allowedKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(value)) return true
  const parts = value.split('.')
  if (
    parts.length !== 3 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    return false
  return (
    JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'anon'
  )
}

let output = {}
const url = env.VITE_SUPABASE_URL?.trim()
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
if (url || key || env.VITE_PUBLIC_WEB_URL?.trim()) {
  try {
    if (!url || !key || key.length > 4096 || !allowedKey(key)) throw new Error()
    output = { url: address(url).href.replace(/\/$/, ''), key }
    if (env.VITE_PUBLIC_WEB_URL?.trim()) {
      const webUrl = address(env.VITE_PUBLIC_WEB_URL.trim())
      if (webUrl.pathname !== '/') throw new Error()
      output.webUrl = webUrl.origin
    }
  } catch {
    // Never include a key or URL in a build error, including errors from the URL constructor.
    throw new Error(
      'Configuração pública inválida. Confira VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e VITE_PUBLIC_WEB_URL. Use uma chave publicável ou anon.'
    )
  }
}
const dir = new URL('../public/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(
  new URL('musiccenter-config.json', dir),
  JSON.stringify(output, null, 2) + '\n'
)
