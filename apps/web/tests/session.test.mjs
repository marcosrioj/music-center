import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession } from '../src/application/session.ts'

function fixture(exchangeCode) {
  let authChanged,
    linkReceived,
    recoveryUser = null
  const events = []
  const session = createSession(
    {
      configured: true,
      observe(listener) {
        authChanged = listener
        return () => {}
      },
      exchangeCode,
      async signOut() {},
    },
    {
      watchAuthLinks(listener) {
        linkReceived = listener
        return () => {}
      },
      recoveryUser: () => recoveryUser,
      setRecovery(id) {
        recoveryUser = id
      },
    }
  )
  const stop = session.observe({
    changed: (user, recovering) => events.push([user?.id, recovering]),
    checking() {},
    linkWarning() {},
  })
  return {
    session,
    events,
    stop,
    change: (...args) => authChanged(...args),
    receive: (link) => linkReceived(link),
    recovery: () => recoveryUser,
  }
}

test('o retorno PKCE associa a recuperação à conta e sair remove o marcador', async () => {
  const state = fixture(async (code, flow) => {
    assert.equal(code, 'code')
    assert.equal(flow, 'flow')
    return { user: { id: 'owner' }, recovery: true }
  })
  await state.receive({ code: 'code', flowId: 'flow', failed: false })
  state.change({ id: 'owner' }, false)
  assert.deepEqual(state.events.at(-1), ['owner', 'owner'])
  await state.session.signOut()
  assert.equal(state.recovery(), null)
  state.stop()
})

test('um retorno PKCE atrasado não altera a sessão depois da desmontagem', async () => {
  let finish
  const state = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const pending = state.receive({ code: 'x', failed: false })
  state.stop()
  finish({ user: { id: 'old' }, recovery: true })
  await pending
  assert.deepEqual(state.events, [])
  assert.equal(state.recovery(), null)
})
