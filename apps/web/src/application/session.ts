export type Account = { id: string; email?: string }

export interface Authentication {
  configured: boolean
  observe(
    listener: (user: Account | null, recovery: boolean) => void
  ): () => void
  exchangeCode(
    code: string,
    flowId?: string
  ): Promise<{ user: Account; recovery?: boolean }>
  signIn(email: string, password: string): Promise<void>
  signUp(
    email: string,
    password: string,
    redirect: string
  ): Promise<{ needsConfirmation: boolean }>
  resetPassword(email: string, redirect: string): Promise<void>
  changePassword(password: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
}

export type AuthLink = { code: string | null; flowId?: string; failed: boolean }
export interface SessionPlatform {
  redirect: string
  recoveryUser(): string | null
  setRecovery(userId: string | null): void
  readInvite(): string
  clearInvite(): void
  watchInvite(listener: (token: string) => void): () => void
  watchAuthLinks(listener: (link: AuthLink) => Promise<void>): () => void
}

type SessionObserver = {
  changed(user: Account | null, recoveryUser: string | null): void
  checking(checking: boolean): void
  linkWarning(message: string): void
}

export function createSession(auth: Authentication, platform: SessionPlatform) {
  return {
    configured: auth.configured,
    readInvite: platform.readInvite,
    clearInvite: platform.clearInvite,
    watchInvite: platform.watchInvite,
    observe(observer: SessionObserver) {
      if (!auth.configured) return () => {}
      let active = true
      let pendingLinks = 0
      const stopAuth = auth.observe((user, recovery) => {
        if (!active) return
        if (recovery && user) platform.setRecovery(user.id)
        else if (!user || platform.recoveryUser() !== user.id)
          platform.setRecovery(null)
        observer.changed(user, platform.recoveryUser())
      })
      const stopLinks = platform.watchAuthLinks(
        async ({ code, flowId, failed }) => {
          pendingLinks++
          observer.checking(true)
          try {
            if (!code || failed) throw new Error()
            const result = await auth.exchangeCode(code, flowId)
            if (!active) return
            if (result.recovery !== undefined)
              platform.setRecovery(result.recovery ? result.user.id : null)
            observer.changed(result.user, platform.recoveryUser())
            observer.linkWarning('')
          } catch {
            if (active)
              observer.linkWarning(
                'O link expirou ou foi aberto em outro aparelho. Solicite outro link neste navegador ou aplicativo.'
              )
          } finally {
            pendingLinks--
            if (active) observer.checking(pendingLinks > 0)
          }
        }
      )
      return () => {
        active = false
        stopLinks()
        stopAuth()
      }
    },
    signIn: auth.signIn,
    signUp(email: string, password: string) {
      return auth.signUp(email, password, platform.redirect)
    },
    resetPassword(email: string) {
      return auth.resetPassword(email, platform.redirect)
    },
    async changePassword(password: string) {
      await auth.changePassword(password)
      platform.setRecovery(null)
    },
    async signOut() {
      await auth.signOut()
      platform.setRecovery(null)
    },
    deleteAccount: auth.deleteAccount,
  }
}

export type AccountSession = ReturnType<typeof createSession>
