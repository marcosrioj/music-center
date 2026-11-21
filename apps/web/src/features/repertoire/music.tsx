import { isChord, transpose } from '../../domain/transposition'

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
          if (heading && !isChord(heading[1]))
            return <h3 key={idx}>{heading[1]}</h3>
          const tokens = trimmed.split(/\s+/)
          if (
            tokens.some((token) => isChord(token)) &&
            tokens.every((token) => isChord(token) || /^[|:%-]+$/.test(token))
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
            isChord(match[1])
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
