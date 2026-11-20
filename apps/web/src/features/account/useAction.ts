import { useRef, useState } from 'react'

function errorMessage(reason: unknown) {
  const raw = reason instanceof Error ? reason.message : ''
  if (/invalid login credentials/i.test(raw))
    return 'Confira o e-mail e a senha e tente novamente.'
  if (/email not confirmed/i.test(raw))
    return 'Abra o link de confirmação enviado ao seu e-mail para entrar.'
  if (/already registered/i.test(raw))
    return 'Este e-mail já possui uma conta. Entre com sua senha.'
  if (/failed to fetch|network error|load failed/i.test(raw))
    return 'Não foi possível conectar. Confira sua conexão e tente novamente.'
  if (/rate limit|too many requests/i.test(raw))
    return 'Houve várias tentativas seguidas. Aguarde um pouco antes de tentar novamente.'
  return raw || 'Não foi possível concluir a ação. Tente novamente.'
}

export function useAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const clear = () => {
    setError('')
    setMessage('')
  }
  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    clear()
    try {
      await action()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { busy, message, setMessage, error, clear, run }
}
