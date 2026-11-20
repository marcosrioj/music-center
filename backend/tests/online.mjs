// Integration suite for a disposable, loopback-only Supabase stack with this project's migrations.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.API_URL
const publicKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.PUBLISHABLE_KEY ||
  process.env.ANON_KEY
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SECRET_KEY ||
  process.env.SERVICE_ROLE_KEY
if (!url || !publicKey || !serviceKey) {
  throw new Error(
    'Exporte API_URL, ANON_KEY e SERVICE_ROLE_KEY de “supabase status -o env” para a pilha local.'
  )
}
const endpoint = new URL(url)
if (
  !['127.0.0.1', '[::1]', 'localhost'].includes(endpoint.hostname) ||
  endpoint.protocol !== 'http:' ||
  endpoint.username ||
  endpoint.password ||
  endpoint.pathname !== '/' ||
  endpoint.search ||
  endpoint.hash
) {
  throw new Error(
    'Este teste cria e exclui contas de teste. Use o endereço HTTP de uma instância Supabase de loopback.'
  )
}
function api(key = publicKey) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
    global: {
      fetch(input, init) {
        const target = new URL(input instanceof Request ? input.url : input)
        if (target.origin !== endpoint.origin)
          throw new Error('Destino de teste externo bloqueado.')
        return fetch(input, { ...init, redirect: 'error' })
      },
    },
  })
}
const admin = api(serviceKey)
const anonymous = api()
const created = []
const files = []
const bucket = 'musiccenter-scores'
const run = randomUUID()
function ok(result, action) {
  assert.ifError(
    result.error
      ? new Error(
          action +
            ' (' +
            (result.error.code || result.error.status || 'erro') +
            ')'
        )
      : null
  )
  return result.data
}
async function createAccount(name, signup = false) {
  const email = 'mc-qa-' + name + '-' + run + '@example.test'
  const password = randomBytes(24).toString('base64url')
  const session = api()
  let user
  if (signup) {
    user = ok(await session.auth.signUp({ email, password }), 'Cadastro').user
    assert.ok(user?.id, 'Cadastro retornou usuário')
    created.push(user.id)
    // Local mail delivery can be enabled. Confirm this synthetic fixture without depending on an inbox.
    ok(
      await admin.auth.admin.updateUserById(user.id, { email_confirm: true }),
      'Confirmação da conta de teste'
    )
  } else {
    user = ok(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
      'Criação de conta de teste'
    ).user
    created.push(user.id)
  }
  ok(await session.auth.signInWithPassword({ email, password }), 'Login')
  return { id: user.id, email, password, session }
}
async function rpc(client, name, params = {}) {
  return ok(await client.rpc(name, params), name)
}
async function denied(action, message, expected) {
  const { error } = await action
  assert.ok(error, message)
  if (expected) assert.equal(error.message, expected, message)
}
async function verifyAnnotations(
  owner,
  second,
  member,
  outsider,
  spaceId,
  workspace
) {
  const target = { p_space: spaceId }
  const write = {
    ...target,
    p_song: 'musica',
    p_note: 'Entrada na segunda volta',
    p_previous: '',
  }
  await rpc(member, 'mc_save_note', write)
  assert.deepEqual(
    await rpc(owner, 'mc_notes', target),
    {},
    'O gestor não lê a anotação de outro músico'
  )
  await rpc(owner, 'mc_save_note', { ...write, p_note: 'Início suave' })
  assert.deepEqual(
    await rpc(second, 'mc_notes', target),
    { musica: 'Início suave' },
    'O mesmo usuário vê sua anotação em outra sessão'
  )
  await denied(
    second.rpc('mc_save_note', { ...write, p_note: 'Edição defasada' }),
    'Conflito de anotação',
    'MC_CONFLICT'
  )
  assert.deepEqual(await rpc(member, 'mc_notes', target), {
    musica: write.p_note,
  })
  await denied(
    outsider.rpc('mc_notes', target),
    'Externo não lê anotações',
    'MC_FORBIDDEN'
  )
  await denied(anonymous.rpc('mc_notes', target), 'Notas exigem login')
  await denied(
    member.rpc('mc_save_note', { ...write, p_song: 'inexistente' }),
    'Exige música existente',
    'MC_SONG_MISSING'
  )
  await rpc(owner, 'mc_save_note', {
    ...write,
    p_previous: 'Início suave',
    p_note: '',
  })
  assert.deepEqual(await rpc(second, 'mc_notes', target), {})

  const migrationSpace = await rpc(owner, 'mc_create_space', {
    p_name: 'Importação transacional',
  })
  const archive = structuredClone(workspace)
  delete archive.songs[0].pdfId
  delete archive.songs[0].pdfName
  const migration = {
    p_space: migrationSpace.id,
    p_revision: 0,
    p_workspace: archive,
    p_notes: { musica: 'Anotação antiga' },
  }
  const access = { p_space: migrationSpace.id }
  await denied(
    owner.rpc('mc_import_workspace', {
      ...migration,
      p_notes: { errada: 'nota' },
    }),
    'Importação deve reverter todo o lote',
    'MC_INVALID_NOTES'
  )
  assert.equal(await rpc(owner, 'mc_revision', access), 0)
  assert.deepEqual(
    (await rpc(owner, 'mc_workspace', access)).workspace.songs,
    []
  )
  assert.deepEqual(await rpc(owner, 'mc_notes', access), {})
  const result = await rpc(owner, 'mc_import_workspace', migration)
  assert.equal(result.revision, 1)
  assert.deepEqual(await rpc(second, 'mc_notes', access), migration.p_notes)
  await denied(
    owner.rpc('mc_import_workspace', { ...migration, p_revision: 1 }),
    'Preserva acervo existente',
    'MC_NOT_EMPTY'
  )
  await rpc(owner, 'mc_save_workspace', {
    ...access,
    p_revision: 1,
    p_workspace: { version: 1, songs: [], plans: [] },
  })
  await rpc(owner, 'mc_save_workspace', {
    ...access,
    p_revision: 2,
    p_workspace: archive,
  })
  assert.deepEqual(
    await rpc(second, 'mc_notes', access),
    {},
    'Música recriada não ressuscita notas de outro cadastro'
  )
}

try {
  const owner = await createAccount('gestor', true)
  const member = await createAccount('membro')
  const outsider = await createAccount('externo')
  const otherSession = api()
  ok(
    await otherSession.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    }),
    'Segunda sessão do gestor'
  )
  const space = await rpc(owner.session, 'mc_create_space', {
    p_name: 'Equipe integração',
  })
  assert.equal(space.role, 'admin')
  const target = { p_space: space.id }
  const token = await rpc(owner.session, 'mc_invite', target)
  assert.match(token, /^[a-f0-9]{64}$/)
  await denied(
    anonymous.rpc('mc_join_space', { p_token: token }),
    'Convite requer login'
  )
  await denied(
    anonymous.rpc('mc_create_space', { p_name: 'Acesso inválido' }),
    'Criar equipe requer login'
  )
  await denied(
    outsider.session.rpc('mc_workspace', target),
    'Equipe alheia permanece privada',
    'MC_FORBIDDEN'
  )
  assert.deepEqual(await rpc(outsider.session, 'mc_list_spaces'), [])
  const joined = await rpc(member.session, 'mc_join_space', { p_token: token })
  assert.deepEqual(joined, { id: space.id, name: space.name, role: 'member' })
  assert.equal((await rpc(member.session, 'mc_list_spaces'))[0].id, space.id)
  assert.equal(
    (await rpc(owner.session, 'mc_members', target)).find(
      (m) => m.id === member.id
    ).email,
    member.email
  )
  const pdfId = randomUUID()
  const path = space.id + '/' + pdfId
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'
  )
  const uploadOptions = { contentType: 'application/pdf', upsert: false }
  await denied(
    member.session.storage.from(bucket).upload(path, pdf, uploadOptions),
    'Membro sem permissão de upload'
  )
  ok(
    await owner.session.storage.from(bucket).upload(path, pdf, uploadOptions),
    'Upload autenticado'
  )
  files.push(path)
  await denied(
    member.session.storage.from(bucket).download(path),
    'Upload pendente é privado'
  )
  await denied(
    owner.session.storage.from(bucket).upload(path, pdf, uploadOptions),
    'Objeto existente é imutável'
  )
  const song = {
    id: 'musica',
    title: 'Canção',
    artist: 'Equipe',
    key: 'C',
    bpm: 84,
    meter: '4/4',
    chart: '[C]Canção de teste',
    notes: '',
    pdfId,
    pdfName: 'Teste.pdf',
  }
  const plan = {
    id: 'plano',
    title: 'Plano de integração',
    date: '2026-12-20',
    time: '10:00',
    location: 'Auditório',
    items: [{ id: 'faixa', songId: song.id, title: song.title, minutes: 4 }],
    team: [
      { id: 'pessoa', name: 'Nome de teste', role: 'Voz', status: 'pending' },
    ],
  }
  const initial = await rpc(owner.session, 'mc_workspace', target)
  const workspace = { version: 1, songs: [song], plans: [plan] }
  const save = {
    p_space: space.id,
    p_revision: initial.revision,
    p_workspace: workspace,
  }
  const writes = await Promise.all([
    owner.session.rpc('mc_save_workspace', save),
    otherSession.rpc('mc_save_workspace', save),
  ])
  assert.deepEqual(
    writes.map((w) => w.error?.message || 'ok').sort(),
    ['MC_CONFLICT', 'ok'],
    'Apenas um dispositivo pode publicar na mesma revisão'
  )
  const snapshot = await rpc(member.session, 'mc_workspace', target)
  assert.deepEqual(snapshot.workspace, workspace)
  assert.equal(
    snapshot.revision,
    await rpc(member.session, 'mc_revision', target)
  )
  await verifyAnnotations(
    owner.session,
    otherSession,
    member.session,
    outsider.session,
    space.id,
    workspace
  )
  const material = ok(
    await member.session.storage.from(bucket).download(path),
    'Download pelo integrante'
  )
  assert.deepEqual(Buffer.from(await material.arrayBuffer()), pdf)
  await denied(
    outsider.session.storage.from(bucket).download(path),
    'Externo sem acesso ao PDF'
  )
  await denied(
    anonymous.storage.from(bucket).download(path),
    'Download requer login'
  )
  await denied(
    member.session.rpc('mc_save_workspace', {
      ...save,
      p_revision: snapshot.revision,
    }),
    'Integrante não edita',
    'MC_FORBIDDEN'
  )
  await denied(
    member.session.rpc('mc_invite', target),
    'Convite exige gestor',
    'MC_FORBIDDEN'
  )
  const update = structuredClone(workspace)
  update.plans[0].team[0].status = 'confirmed'
  await rpc(otherSession, 'mc_save_workspace', {
    ...save,
    p_revision: snapshot.revision,
    p_workspace: update,
  })
  const refreshed = await rpc(member.session, 'mc_workspace', target)
  assert.equal(refreshed.workspace.plans[0].team[0].status, 'confirmed')
  await rpc(owner.session, 'mc_revoke_invites', target)
  await denied(
    outsider.session.rpc('mc_join_space', { p_token: token }),
    'Convite revogado',
    'MC_INVALID_INVITE'
  )
  assert.equal(
    await rpc(member.session, 'mc_revision', target),
    refreshed.revision
  )
  const before = await rpc(owner.session, 'mc_invite', target)
  await rpc(owner.session, 'mc_remove_member', { ...target, p_user: member.id })
  await denied(
    member.session.rpc('mc_workspace', target),
    'Remoção revoga acesso',
    'MC_FORBIDDEN'
  )
  await denied(
    member.session.rpc('mc_notes', target),
    'Remoção revoga acesso às anotações',
    'MC_FORBIDDEN'
  )
  await denied(
    member.session.storage.from(bucket).download(path),
    'Remoção revoga download'
  )
  await denied(
    member.session.rpc('mc_join_space', { p_token: before }),
    'Link anterior à remoção não readmite membro',
    'MC_INVALID_INVITE'
  )
  const after = await rpc(owner.session, 'mc_invite', target)
  assert.equal(
    (await rpc(member.session, 'mc_join_space', { p_token: after })).role,
    'member'
  )
  const events = [
    'cadastro e login',
    'convites autenticados',
    'sincronização em sessões independentes',
    'PDF privado e compartilhado',
    'concorrência',
    'notas privadas sincronizadas e importação atômica',
    'revogação e isolamento',
  ]
  console.log('Supabase local verificado — ' + events.join(', ') + '.')
} finally {
  const errors = []
  if (files.length) {
    const result = await admin.storage.from(bucket).remove(files)
    if (result.error) errors.push('arquivos')
  }
  for (const id of created.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) errors.push('conta de teste')
  }
  if (errors.length) throw new Error('Falha na limpeza de ' + errors.join(', '))
}
