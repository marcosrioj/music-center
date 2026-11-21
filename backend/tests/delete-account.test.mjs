import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteAccount } from '../supabase/functions/delete-account/application/delete-account.ts'
import { supabaseAccountDeletion } from '../supabase/functions/delete-account/adapters/supabase.ts'
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/http.ts'

test('a falha na limpeza mantém a identidade e permite concluir numa nova tentativa', async () => {
  const scores = new Set(['primeiro', 'segundo'])
  const events = []
  let failOnce = true
  const remove = deleteAccount({
    async authenticatedAccountId(token) {
      assert.equal(token, 'sessao')
      return 'titular'
    },
    async prepareOwnedSpaces(id) {
      assert.equal(id, 'titular')
      events.push('preparar')
      return ['primeiro', 'segundo']
    },
    async removeSpaceScores(id) {
      events.push(id)
      if (id === 'segundo' && failOnce) {
        failOnce = false
        throw new Error('limpeza interrompida')
      }
      scores.delete(id)
    },
    async deleteIdentity(id) {
      assert.equal(scores.size, 0)
      events.push('excluir ' + id)
    },
  })

  await assert.rejects(remove('sessao'), /limpeza interrompida/)
  assert.deepEqual([...scores], ['segundo'])
  assert.deepEqual(events, ['preparar', 'primeiro', 'segundo'])
  assert.equal(await remove('sessao'), 'deleted')
  assert.deepEqual(events.slice(3), [
    'preparar',
    'primeiro',
    'segundo',
    'excluir titular',
  ])
})

function request(method = 'POST', authorization, body) {
  const headers = authorization === undefined ? {} : { authorization }
  return new Request('http://localhost/functions/v1/delete-account', {
    method,
    headers,
    body,
  })
}

function checkHeaders(response) {
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(
    response.headers.get('access-control-allow-methods'),
    'POST, OPTIONS'
  )
  assert.equal(
    response.headers.get('access-control-allow-headers'),
    'authorization, apikey, x-client-info, content-type'
  )
  assert.equal(response.headers.get('cache-control'), 'no-store')
}

test('preflight, método e cabeçalho inválidos são tratados antes de acessar credenciais', async () => {
  let configured = false
  const handle = createDeleteAccountHandler(() => {
    configured = true
    return null
  })
  const preflight = await handle(request('OPTIONS'))
  assert.equal(preflight.status, 204)
  assert.equal(await preflight.text(), '')
  checkHeaders(preflight)

  for (const [method, header, status, error] of [
    ['GET', 'Bearer abc', 405, 'Use POST para excluir a conta.'],
    ['POST', undefined, 401, 'Entre na sua conta para continuar.'],
    ['POST', 'Basic abc', 401, 'Entre na sua conta para continuar.'],
    ['POST', 'Bearer token extra', 401, 'Entre na sua conta para continuar.'],
  ]) {
    const result = await handle(request(method, header))
    assert.equal(result.status, status)
    assert.deepEqual(await result.json(), { error })
    checkHeaders(result)
  }
  assert.equal(configured, false)
})

test('configuração ausente e falhas operacionais preservam as respostas 503 distintas', async () => {
  const noConfig = createDeleteAccountHandler(() => null)
  const outage = createDeleteAccountHandler(() => async () => {
    throw new Error('detalhes internos')
  })
  for (const [handle, expected] of [
    [noConfig, 'Serviço indisponível.'],
    [
      outage,
      'Não foi possível concluir a exclusão. Tente novamente para continuar.',
    ],
  ]) {
    const result = await handle(request('POST', 'Bearer token'))
    assert.equal(result.status, 503)
    assert.deepEqual(await result.json(), { error: expected })
    checkHeaders(result)
  }
})

const ownSpace = '00000000-0000-4000-8000-000000000001'
const foreignSpace = '00000000-0000-4000-8000-000000000002'
const user = { id: 'titular' }
const secondPage = Array.from(
  { length: 101 },
  (_, i) => ownSpace + '/pdf-' + String(i).padStart(3, '0')
)
const nestedFile = ownSpace + '/pasta/outro-pdf'
const foreignFile = foreignSpace + '/partitura'

// Fake only the four Supabase API operations used by the adapter. The application
// and HTTP handler run unchanged, including paging, prefix validation and retries.
function fixture({
  auth = { data: { user } },
  spaces = [ownSpace],
  fail,
} = {}) {
  const files = new Set([...secondPage, nestedFile, foreignFile])
  const calls = {
    services: 0,
    tokens: [],
    prepared: [],
    deleted: [],
    lists: [],
  }
  const publicClient = {
    auth: {
      async getUser(token) {
        calls.tokens.push(token)
        return auth
      },
    },
  }
  const bucket = {
    async list(prefix, options) {
      calls.lists.push(prefix)
      assert.deepEqual(options, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (fail === 'list') return { data: null, error: new Error() }
      if (fail === 'path') return { data: [{ name: '../outro', id: 'x' }] }
      const entries = new Map()
      for (const path of [...files].sort()) {
        if (!path.startsWith(prefix + '/')) continue
        const [name, subpath] = path.slice(prefix.length + 1).split('/')
        entries.set(name, { name, id: subpath ? null : 'objeto' })
      }
      return { data: [...entries.values()].slice(0, options.limit) }
    },
    async remove(paths) {
      if (fail === 'remove') return { data: [], error: null }
      for (const path of paths) assert.equal(files.delete(path), true)
      return { data: paths.map((name) => ({ name })) }
    },
  }
  const service = {
    async rpc(name, params) {
      assert.equal(name, 'mc_prepare_account_deletion')
      calls.prepared.push(params.p_user)
      return fail === 'prepare'
        ? { data: null, error: new Error() }
        : { data: spaces }
    },
    storage: {
      from(name) {
        assert.equal(name, 'musiccenter-scores')
        return bucket
      },
    },
    auth: {
      admin: {
        async deleteUser(id) {
          calls.deleted.push(id)
          return { error: fail === 'identity' ? new Error() : null }
        },
      },
    },
  }
  const handle = createDeleteAccountHandler(() =>
    deleteAccount(
      supabaseAccountDeletion(publicClient, () => {
        calls.services++
        return service
      })
    )
  )
  return { handle, files, calls }
}

test('sessões rejeitadas, ausentes ou anônimas não acionam o cliente administrativo', async () => {
  for (const auth of [
    { data: { user }, error: new Error('JWT inválido') },
    { data: { user: null } },
    { data: { user: { ...user, is_anonymous: true } } },
  ]) {
    const { handle, calls } = fixture({ auth })
    const result = await handle(request('POST', 'Bearer recebido'))
    assert.equal(result.status, 401)
    assert.deepEqual(await result.json(), {
      error: 'Entre novamente na sua conta.',
    })
    assert.deepEqual(calls.tokens, ['recebido'])
    assert.equal(calls.services, 0)
  }
})

test('a exclusão segue páginas e pastas dos espaços do titular verificado', async () => {
  const { handle, files, calls } = fixture()
  const result = await handle(
    request('POST', 'bEaReR recebido', JSON.stringify({ userId: 'outro' }))
  )
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { deleted: true })
  checkHeaders(result)
  assert.deepEqual(calls.prepared, ['titular'])
  assert.deepEqual(calls.deleted, ['titular'])
  assert.equal(calls.services, 1)
  assert.ok(calls.lists.filter((prefix) => prefix === ownSpace).length >= 3)
  assert.deepEqual([...files], [foreignFile])
})

test('preparação, caminhos e operações de Storage com falha impedem a exclusão da identidade', async () => {
  for (const scenario of [
    { fail: 'prepare' },
    { spaces: null },
    { spaces: ['outro/espaço'] },
    { fail: 'list' },
    { fail: 'path' },
    { fail: 'remove' },
  ]) {
    const { handle, calls, files } = fixture(scenario)
    const result = await handle(request('POST', 'Bearer valido'))
    assert.equal(result.status, 503)
    assert.deepEqual(calls.deleted, [])
    assert.equal(files.size, secondPage.length + 2)
  }
})

test('uma falha do Auth Admin é reportada mesmo após a limpeza completa', async () => {
  const { handle, calls, files } = fixture({ fail: 'identity' })
  const result = await handle(request('POST', 'Bearer valido'))
  assert.equal(result.status, 503)
  assert.deepEqual(calls.deleted, ['titular'])
  assert.deepEqual([...files], [foreignFile])
})
