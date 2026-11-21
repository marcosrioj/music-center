const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const natural: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
const chord =
  /^([A-G])([#b♯♭]?)((?:(?:maj|min|dim|aug|sus|add|omit|no|m|M|Δ|ø|°|[-+(),0-9#b♯♭]))*)(?:\/([A-G])([#b♯♭]?))?$/

function shiftNote(
  note: string,
  accidental: string,
  steps: number,
  preferFlats: boolean
) {
  const change = ['#', '♯'].includes(accidental)
    ? 1
    : ['b', '♭'].includes(accidental)
      ? -1
      : 0
  return (preferFlats ? flats : sharps)[
    (((natural[note] + change + steps) % 12) + 12) % 12
  ]
}

export function transpose(
  symbol: string,
  steps: number,
  preferFlats = false
): string {
  const match = symbol.match(chord)
  if (!steps || !match) return symbol
  const [, root, accidental, quality, bass, bassAccidental] = match
  return (
    shiftNote(root, accidental, steps, preferFlats) +
    quality +
    (bass ? '/' + shiftNote(bass, bassAccidental, steps, preferFlats) : '')
  )
}

export const isChord = (value: string) => chord.test(value)

export const prefersFlats = (key: string) => /b|♭|^F(?:m)?$/.test(key)
