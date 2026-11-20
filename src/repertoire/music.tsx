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
    (natural[note] + change + steps + 24) % 12
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

export function SongChart({
  value,
  steps,
  preferFlats,
}: {
  value: string
  steps: number
  preferFlats: boolean
}) {
  return (
    <div className="rep-chart">
      {value
        .replace(/\r/g, '')
        .split('\n')
        .map((line, idx) => {
          const trimmed = line.trim()
          if (!trimmed)
            return (
              <div key={idx} className="rep-chart-gap" aria-hidden="true" />
            )
          if (
            /^\{(?:title|t|subtitle|artist|key|tempo|time):.*\}$/i.test(trimmed)
          )
            return null
          const heading =
            trimmed.match(/^\{(?:comment|c|section):\s*(.+?)\s*\}$/i) ??
            trimmed.match(/^\[([^\]]+)\]$/) ??
            trimmed.match(/^#\s*(.+)$/)
          if (heading && !chord.test(heading[1]))
            return <h3 key={idx}>{heading[1]}</h3>
          const tokens = trimmed.split(/\s+/)
          if (
            tokens.some((token) => chord.test(token)) &&
            tokens.every(
              (token) => chord.test(token) || /^[|:%-]+$/.test(token)
            )
          ) {
            return (
              <div className="rep-chord-line" key={idx}>
                {line.replace(/\S+/g, (token) =>
                  transpose(token, steps, preferFlats)
                )}
              </div>
            )
          }
          const chunks = [...line.matchAll(/\[([^\]]+)\]/g)].filter((match) =>
            chord.test(match[1])
          )
          if (!chunks.length)
            return (
              <p className="rep-lyric" key={idx}>
                {line}
              </p>
            )
          return (
            <p className="rep-inline-chart" key={idx}>
              {line.slice(0, chunks[0].index)}
              {chunks.map((match, i) => (
                <span className="rep-chunk" key={match.index}>
                  <b>{transpose(match[1], steps, preferFlats)}</b>
                  <span>
                    {line.slice(
                      match.index! + match[0].length,
                      chunks[i + 1]?.index ?? line.length
                    ) || '\u00a0'}
                  </span>
                </span>
              ))}
            </p>
          )
        })}
    </div>
  )
}
