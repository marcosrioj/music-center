import assert from 'node:assert/strict'
import test from 'node:test'
import { WorkspaceSession } from '../src/application/workspaceSession.ts'
import { WorkspaceError } from '../src/application/errors.ts'
import { migrateLocal } from '../src/application/migrateLocal.ts'

const scope = {
  space: { id: 'space', role: 'admin', name: 'Banda' },
  userId: 'account',
}
const song = { id: 's', title: 'Canção', notes: '', pdfId: 'pdf' }
const initial = {
  revision: 1,
  workspace: { version: 1, songs: [song], plans: [] },
}
const plan = { id: 'p', items: [], title: 'Ensaio', team: [] }
const services = {
  sameScope: () => true,
  saveSnapshot: async (_space, revision, workspace) => ({
    revision: revision + 1,
    workspace,
  }),
}

test('serializa edições e mantém notas pessoais fora do snapshot compartilhado', async () => {
  const saved = []
  const session = new WorkspaceSession(
    {
      ...services,
      saveSnapshot: async (...args) => {
        saved.push(args)
        return services.saveSnapshot(...args)
      },
    },
    scope,
    initial,
    { s: 'Privado' }
  )
  const first = session.savePlan(plan)
  const stale = session.saveSong(song)
  await first
  await assert.rejects(stale, /dados mudaram/)
  assert.equal(saved.length, 1)
  assert.equal(saved[0][2].songs[0].notes, '')
  assert.equal(session.current().songs[0].notes, 'Privado')
  assert.deepEqual(session.current().plans, [plan])
})

test('recarrega a revisão atual em conflito e não remove uma música em uso', async () => {
  const inUse = { ...plan, items: [{ songId: song.id }] }
  const session = new WorkspaceSession(
    {
      ...services,
      saveSnapshot: async () => {
        throw new WorkspaceError('conflict', 'conflito')
      },
      fetchSnapshot: async () => ({
        revision: 3,
        workspace: { ...initial.workspace, plans: [inUse] },
      }),
    },
    scope,
    initial,
    {}
  )
  await assert.rejects(session.savePlan(plan), /conflito/)
  await assert.rejects(session.deleteSong(song.id), /Ensaio/)
  assert.deepEqual(session.current().songs, [song])
})

test('uma edição de membro ou de sessão encerrada não chega ao repositório', async () => {
  for (const [role, active] of [
    ['member', true],
    ['admin', false],
  ]) {
    const session = new WorkspaceSession(
      {
        sameScope: () => active,
        saveSnapshot: () => assert.fail('gravou sem acesso'),
      },
      { ...scope, space: { ...scope.space, role } },
      initial,
      {}
    )
    await assert.rejects(session.savePlan(plan), /administração/)
  }
})

test('a migração reverte PDFs novos quando falha a importação atômica', async () => {
  const removed = []
  const source = {
    ...initial.workspace,
    songs: [{ ...song, notes: 'particular' }],
  }
  await assert.rejects(
    migrateLocal(scope, {
      load: async () => source,
      fetchSnapshot: async () => ({
        revision: 4,
        workspace: { songs: [], plans: [] },
      }),
      newId: () => 'new-pdf',
      readFile: async () => new ArrayBuffer(1),
      upload: async () => {},
      remove: async (_, ids) => {
        removed.push(...ids)
      },
      importWorkspace: async (_, revision, workspace, notes) => {
        assert.equal(revision, 4)
        assert.equal(workspace.songs[0].notes, '')
        assert.deepEqual(notes, { s: 'particular' })
        throw new Error('falha')
      },
    }),
    /falha/
  )
  assert.deepEqual(removed, ['new-pdf'])
  assert.equal(source.songs[0].pdfId, 'pdf')
})
