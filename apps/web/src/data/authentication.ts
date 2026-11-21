import type { Account, Authentication } from '../application/session'
import { client, db, humanError } from './supabase'

function account(
  user?: { id: string; email?: string; is_anonymous?: boolean } | null
): Account | null {
  return user && !user.is_anonymous ? { id: user.id, email: user.email } : null
}

export const authentication: Authentication = {
  configured: !!client,
  observe(listener) {
    const { data } = db().auth.onAuthStateChange((event, session) => {
      listener(account(session?.user), event === 'PASSWORD_RECOVERY')
    })
    return () => data.subscription.unsubscribe()
  },
  async exchangeCode(code, flowId) {
    const { data, error } = await db().auth.exchangeCodeForSession(code, {
      flowId,
    })
    const user = account(data.user)
    if (error || !user) throw new Error('O link não pôde ser verificado.')
    return {
      user,
      recovery:
        'redirectType' in data ? data.redirectType === 'recovery' : undefined,
    }
  },
  async signIn(email, password) {
    const { error } = await db().auth.signInWithPassword({ email, password })
    if (error) throw humanError(error)
  },
  async signUp(email, password, redirect) {
    const { data, error } = await db().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirect },
    })
    if (error) throw humanError(error)
    return { needsConfirmation: !data.session }
  },
  async resetPassword(email, redirect) {
    const { error } = await db().auth.resetPasswordForEmail(email, {
      redirectTo: redirect,
    })
    if (error) throw humanError(error)
  },
  async changePassword(password) {
    const { error } = await db().auth.updateUser({ password })
    if (error) throw humanError(error)
  },
  async signOut() {
    const { error } = await db().auth.signOut({ scope: 'local' })
    if (error) throw humanError(error)
  },
  async deleteAccount() {
    const { error } = await db().functions.invoke('delete-account', {
      body: {},
    })
    if (error)
      throw new Error(
        'Não foi possível excluir a conta. Tente novamente com uma sessão válida.'
      )
  },
}
