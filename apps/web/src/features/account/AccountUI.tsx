import { Check, CircleAlert } from 'lucide-react'
import './access.css'

export function Brand() {
  return (
    <div className="brand onboarding-brand">
      <span className="logomark" aria-hidden="true">
        {[9, 17, 25, 14, 20].map((height) => (
          <i key={height} style={{ height }} />
        ))}
      </span>
      <b>MusicCenter</b>
    </div>
  )
}

export function Feedback({ error, message }: { error: string; message: string }) {
  if (error)
    return (
      <p className="mc-feedback mc-error" role="alert">
        <CircleAlert size={17} />
        {error}
      </p>
    )
  if (message)
    return (
      <p className="mc-feedback" role="status">
        <Check size={17} />
        {message}
      </p>
    )
  return null
}
