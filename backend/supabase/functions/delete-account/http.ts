import type { DeleteAccount } from './application/delete-account.ts'

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

export function createDeleteAccountHandler(
  configuredAction: () => DeleteAccount | null
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST')
      return message(405, 'Use POST para excluir a conta.')

    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.get('authorization') ?? ''
    )?.[1]
    if (!token) return message(401, 'Entre na sua conta para continuar.')

    try {
      const action = configuredAction()
      if (!action) return message(503, 'Serviço indisponível.')
      if ((await action(token)) === 'unauthenticated')
        return message(401, 'Entre novamente na sua conta.')
      return Response.json({ deleted: true }, { headers })
    } catch {
      return message(
        503,
        'Não foi possível concluir a exclusão. Tente novamente para continuar.'
      )
    }
  }
}
