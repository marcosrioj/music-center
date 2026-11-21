import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { SessionPlatform } from '../application/session'

const callback = 'app.musiccenter.mobile://auth/callback'
export function sessionLinks(
  projectUrl: string,
  webUrl: string
): SessionPlatform {
  const inviteKey = 'mc.invite.' + projectUrl
  const recoveryKey = 'mc.recovering.' + projectUrl
  const native = Capacitor.isNativePlatform()
  function readInvite() {
    const token = /^#\/convite\/([0-9a-f]{64})\/?$/i.exec(location.hash)?.[1]
    if (token) {
      sessionStorage.setItem(inviteKey, token)
      history.replaceState(null, '', location.pathname + location.search)
    }
    return sessionStorage.getItem(inviteKey) || ''
  }
  return {
    redirect: native ? callback : webUrl || location.origin,
    readInvite,
    clearInvite: () => sessionStorage.removeItem(inviteKey),
    watchInvite(listener) {
      const onHash = () => listener(readInvite())
      window.addEventListener('hashchange', onHash)
      return () => window.removeEventListener('hashchange', onHash)
    },
    recoveryUser: () => sessionStorage.getItem(recoveryKey),
    setRecovery(userId) {
      if (userId) sessionStorage.setItem(recoveryKey, userId)
      else sessionStorage.removeItem(recoveryKey)
    },
    watchAuthLinks(handle) {
      let stopped = false
      let removeNative: (() => void) | undefined
      const handled = new Set<string>()
      async function receive(raw: string) {
        if (stopped || handled.has(raw)) return
        let url: URL
        try {
          url = new URL(raw)
        } catch {
          return
        }
        if (
          native &&
          url.protocol + '//' + url.host + url.pathname !== callback
        )
          return
        const code = url.searchParams.get('code')
        const failed =
          url.searchParams.has('error') ||
          new URLSearchParams(url.hash.slice(1)).has('error')
        if (!code && !failed) return
        handled.add(raw)
        try {
          await handle({
            code,
            flowId: url.searchParams.get('sb_flow_id') || undefined,
            failed,
          })
        } finally {
          if (!native && !stopped) {
            for (const key of [
              'code',
              'sb_flow_id',
              'error',
              'error_code',
              'error_description',
            ])
              url.searchParams.delete(key)
            if (failed) url.hash = ''
            history.replaceState(
              history.state,
              '',
              url.pathname + url.search + url.hash
            )
          }
        }
      }
      if (native) {
        void App.addListener('appUrlOpen', ({ url }) => void receive(url)).then(
          (subscription) => {
            if (stopped) void subscription.remove()
            else removeNative = () => void subscription.remove()
          }
        )
        void App.getLaunchUrl().then((result) => {
          if (result) void receive(result.url)
        })
      } else {
        void receive(window.location.href)
      }
      return () => {
        stopped = true
        removeNative?.()
      }
    },
  }
}
