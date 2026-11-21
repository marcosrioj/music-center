import { WorkspaceError } from '../application/errors'
import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const projectUrl = (
  window.__MC_CONFIG?.url ??
  import.meta.env.VITE_SUPABASE_URL ??
  ''
)
  .trim()
  .replace(/\/$/, '')
const publicKey = (
  window.__MC_CONFIG?.key ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim()
export const webUrl = (
  window.__MC_CONFIG?.webUrl ||
  import.meta.env.VITE_PUBLIC_WEB_URL ||
  (Capacitor.isNativePlatform() ? '' : location.origin + location.pathname)
).replace(/\/$/, '')
const nativeStore = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: (key: string, value: string) => Preferences.set({ key, value }),
  removeItem: (key: string) => Preferences.remove({ key }),
}
export const client =
  projectUrl && publicKey
    ? createClient(projectUrl, publicKey, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          // OnlineApp exchanges PKCE callbacks after registering its auth listener.
          detectSessionInUrl: false,
          ...(Capacitor.isNativePlatform() ? { storage: nativeStore } : {}),
        },
      })
    : null
export function db() {
  if (!client)
    throw new Error('Configure a conexão com o Supabase para abrir o painel.')
  return client
}

export function humanError(error: {
  message?: string
  code?: string
}): WorkspaceError {
  const detail = error.message || ''
  const code = error.code || ''
  const messages: [RegExp, string][] = [
    [
      /MC_CONFLICT/,
      'Outra sessão alterou este espaço. Confira a versão atualizada antes de editar novamente.',
    ],
    [
      /MC_INVALID_INVITE|MC_INVITE/i,
      'O convite é inválido ou foi revogado. Peça outro à administração.',
    ],
    [
      /MC_(FORBIDDEN|UNAUTHORIZED|AUTH_REQUIRED|ACCESS_DENIED|NOT_FOUND)|permission denied|row-level security|jwt expired|not authenticated/i,
      'Seu acesso a este espaço expirou ou foi removido.',
    ],
    [
      /MC_NOT_EMPTY/,
      'Escolha um espaço vazio para importar os dados deste aparelho.',
    ],
    [
      /MC_[A-Z_]*(LIMIT|QUOTA|LARGE)/,
      'O conteúdo excede o limite permitido pelo espaço.',
    ],
    [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/Email not confirmed/i, 'Confirme o e-mail de cadastro antes de entrar.'],
    [/already registered/i, 'Este e-mail já está cadastrado.'],
    [
      /password.{0,25}(weak|short|characters|different)|weak_password/i,
      'Use uma nova senha de pelo menos oito caracteres.',
    ],
    [
      /rate.limit|too many|security purposes/i,
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    ],
    [
      /failed to fetch|network|Load failed|fetch failed/i,
      'Não foi possível conectar ao servidor. Confira sua conexão.',
    ],
  ]
  const reason = detail + ' ' + code
  const denied =
    /MC_(FORBIDDEN|UNAUTHORIZED|AUTH_REQUIRED|ACCESS_DENIED|NOT_FOUND)|permission denied|jwt expired|PGRST30[123]|42501/i
  return new WorkspaceError(
    /MC_CONFLICT/.test(reason)
      ? 'conflict'
      : denied.test(reason)
        ? 'denied'
        : 'other',
    messages.find(([re]) => re.test(detail + ' ' + code))?.[1] ??
      'O servidor não concluiu a operação. Confira os dados e tente novamente.'
  )
}

export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await db().rpc(name, args)
  if (error) throw humanError(error)
  return data as T
}
