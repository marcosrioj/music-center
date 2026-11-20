import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import type { Workspace } from '../domain/workspace'

export type Space = { id: string; name: string; role: 'admin' | 'member' }
export type Membership = { id: string; email: string; role: 'admin' | 'member' }
export type Snapshot = { revision: number; workspace: Workspace }
export type Scope = { space: Space; userId: string }
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

export class CloudError extends Error {
  constructor(
    public readonly detail: string,
    message: string
  ) {
    super(message)
  }
}
export function humanError(error: {
  message?: string
  code?: string
}): CloudError {
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
  return new CloudError(
    detail + ' ' + code,
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
export function isDenied(error: unknown) {
  return (
    error instanceof CloudError &&
    /MC_(FORBIDDEN|UNAUTHORIZED|AUTH_REQUIRED|ACCESS_DENIED|NOT_FOUND)|permission denied|jwt expired|PGRST30[123]|42501/i.test(
      error.detail
    )
  )
}
export const isConflict = (error: unknown) =>
  error instanceof CloudError && /MC_CONFLICT/.test(error.detail)
export const fetchSnapshot = (space: Space) =>
  rpc<Snapshot>('mc_workspace', { p_space: space.id })
export function publicWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    songs: workspace.songs.map((song) => ({ ...song, notes: '' })),
  }
}
export const saveSnapshot = (
  space: Space,
  revision: number,
  workspace: Workspace
) =>
  rpc<Snapshot>('mc_save_workspace', {
    p_space: space.id,
    p_revision: revision,
    p_workspace: publicWorkspace(workspace),
  })

export type Notes = Record<string, string>
export const readNotes = (scope: Scope) =>
  rpc<Notes>('mc_notes', { p_space: scope.space.id })
export const writeNote = (
  scope: Scope,
  id: string,
  note: string,
  previous: string
) =>
  rpc<void>('mc_save_note', {
    p_space: scope.space.id,
    p_song: id,
    p_note: note,
    p_previous: previous,
  })
export const withNotes = (workspace: Workspace, notes: Notes): Workspace => ({
  ...workspace,
  songs: workspace.songs.map((song) => ({
    ...song,
    notes: Object.hasOwn(notes, song.id) ? notes[song.id] : '',
  })),
})

let activeScope: Scope | undefined
export function activateScores(scope?: Scope) {
  activeScope = scope
}
export function currentScope() {
  if (!activeScope)
    throw new Error('Entre e selecione um espaço para acessar partituras.')
  return activeScope
}
export function sameScope(scope: Scope) {
  return (
    activeScope?.space.id === scope.space.id &&
    activeScope?.userId === scope.userId
  )
}
export const scoreBucket = 'musiccenter-scores'
export function scorePath(scope: Scope, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new Error('Identificador de partitura inválido.')
  return scope.space.id + '/' + id
}
export async function uploadScore(scope: Scope, id: string, data: ArrayBuffer) {
  if (scope.space.role !== 'admin')
    throw new Error('Apenas a administração pode enviar partituras.')
  const { error } = await db()
    .storage.from(scoreBucket)
    .upload(
      scorePath(scope, id),
      new Blob([data], { type: 'application/pdf' }),
      { contentType: 'application/pdf', upsert: false }
    )
  if (error) throw humanError(error)
}
export async function downloadScore(scope: Scope, id: string) {
  const { data, error } = await db()
    .storage.from(scoreBucket)
    .download(scorePath(scope, id))
  if (error) throw humanError(error)
  return data.arrayBuffer()
}
export async function deleteScores(scope: Scope, ids: string[]) {
  if (!ids.length) return
  const { error } = await db()
    .storage.from(scoreBucket)
    .remove(ids.map((id) => scorePath(scope, id)))
  if (error) throw humanError(error)
}
