import { useEffect, useRef, useState } from 'react'
import { AudioLines, Minus, Plus, Square } from 'lucide-react'

export function Metronome({
  initialBpm,
  meter,
}: {
  initialBpm: number
  meter: string
}) {
  const [bpm, setBpm] = useState(initialBpm)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const tempo = useRef(bpm)
  tempo.current = bpm
  const context = useRef<AudioContext | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const cycle = useRef(0)
  const beats = Math.max(1, Number.parseInt(meter, 10) || 4)
  const stopAudio = () => {
    cycle.current++
    clearInterval(timer.current)
    if (context.current && context.current.state !== 'closed')
      void context.current.close().catch(() => {})
    context.current = null
  }
  useEffect(() => {
    function hide() {
      if (document.hidden) {
        stopAudio()
        setPlaying(false)
      }
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      stopAudio()
    }
  }, [])
  async function toggle() {
    if (context.current) {
      stopAudio()
      setPlaying(false)
      return
    }
    const session = ++cycle.current
    try {
      const engine = new AudioContext()
      context.current = engine
      await engine.resume()
      if (session !== cycle.current) return
      let next = engine.currentTime + 0.04
      let beat = 0
      function schedule() {
        if (engine.state !== 'running') return
        if (next < engine.currentTime) next = engine.currentTime + 0.01
        while (next < engine.currentTime + 0.14) {
          const tick = engine.createOscillator()
          const envelope = engine.createGain()
          tick.type = 'sine'
          tick.frequency.value = beat === 0 ? 1480 : 1000
          envelope.gain.setValueAtTime(0.001, next)
          envelope.gain.exponentialRampToValueAtTime(0.32, next + 0.002)
          envelope.gain.exponentialRampToValueAtTime(0.001, next + 0.049)
          tick.connect(envelope).connect(engine.destination)
          tick.start(next)
          tick.stop(next + 0.05)
          tick.onended = () => {
            tick.disconnect()
            envelope.disconnect()
          }
          next += 60 / tempo.current
          beat = (beat + 1) % beats
        }
      }
      schedule()
      timer.current = setInterval(schedule, 40)
      setError('')
      setPlaying(true)
    } catch {
      if (session === cycle.current) {
        stopAudio()
        setPlaying(false)
        setError('O dispositivo não conseguiu iniciar o áudio.')
      }
    }
  }
  return (
    <div className="rep-metro-wrap">
      <div className="rep-metro" role="group" aria-label="Metrônomo">
        <button
          className="rep-metro-toggle"
          aria-pressed={playing}
          onClick={() => void toggle()}
          aria-label={playing ? 'Parar metrônomo' : 'Iniciar metrônomo'}
        >
          {playing ? (
            <Square size={15} fill="currentColor" />
          ) : (
            <AudioLines size={19} />
          )}{' '}
          Metrônomo
        </button>
        <div className="rep-stepper">
          <button
            className="rep-small-icon"
            aria-label="Reduzir BPM"
            disabled={bpm <= 30}
            onClick={() => setBpm((v) => Math.max(30, v - 1))}
          >
            <Minus size={15} />
          </button>
          <span>
            {bpm} <small>BPM</small>
          </span>
          <button
            className="rep-small-icon"
            aria-label="Aumentar BPM"
            disabled={bpm >= 300}
            onClick={() => setBpm((v) => Math.min(300, v + 1))}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      {error && (
        <div className="rep-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
