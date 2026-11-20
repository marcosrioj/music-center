import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.119.2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function message(status: number, error: string) {
  return Response.json({ error }, { status, headers })
}

async function emptyFolder(
  storage: SupabaseClient,
  folder: string
): Promise<void> {
  const bucket = storage.storage.from('musiccenter-scores')
  // Deletions shift the page offsets. Drain the first page until the prefix is empty.
  while (true) {
    const { data, error } = await bucket.list(folder, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error || !data) throw new Error('storage.list')
    if (!data.length) return
    const paths: string[] = []
    for (const entry of data) {
      if (
        !entry.name ||
        entry.name === '.' ||
        entry.name === '..' ||
        entry.name.includes('/')
      ) {
        throw new Error('storage.path')
      }
      const path = folder + '/' + entry.name
      if (entry.id) paths.push(path)
      else await emptyFolder(storage, path)
    }
    if (paths.length) {
      const { data: removed, error: removeError } = await bucket.remove(paths)
      if (removeError || !removed?.length) throw new Error('storage.remove')
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers })
  if (request.method !== 'POST')
    return message(405, 'Use POST para excluir a conta.')
  const token = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get('authorization') ?? ''
  )?.[1]
  if (!token) return message(401, 'Entre na sua conta para continuar.')

  const url = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publicKey || !secret)
    return message(503, 'Serviço indisponível.')
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }

  try {
    const client = createClient(url, publicKey, options)
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(token)
    if (authError || !user || user.is_anonymous)
      return message(401, 'Entre novamente na sua conta.')

    // The authenticated user is the sole deletion target. The SQL function also locks out new uploads.
    const service = createClient(url, secret, options)
    const { data: ownedSpaces, error } = await service.rpc(
      'mc_prepare_account_deletion',
      { p_user: user.id }
    )
    if (error || !Array.isArray(ownedSpaces)) throw new Error('account.prepare')
    for (const id of ownedSpaces) {
      if (
        typeof id !== 'string' ||
        !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)
      ) {
        throw new Error('account.space')
      }
      await emptyFolder(service, id)
    }
    const { error: deletionError } = await service.auth.admin.deleteUser(
      user.id
    )
    if (deletionError) throw new Error('account.delete')
    return Response.json({ deleted: true }, { headers })
  } catch {
    return message(
      503,
      'Não foi possível concluir a exclusão. Tente novamente para continuar.'
    )
  }
})
