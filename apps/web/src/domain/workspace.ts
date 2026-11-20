export type Song = {
  id: string
  title: string
  artist: string
  key: string
  bpm: number
  meter: string
  chart: string
  notes: string
  pdfId?: string
  pdfName?: string
}
export type PlanItem = {
  id: string
  songId?: string
  title: string
  minutes: number
}
export type Member = {
  id: string
  name: string
  role: string
  status: 'pending' | 'confirmed' | 'declined'
}
export type Plan = {
  id: string
  title: string
  date: string
  time: string
  location: string
  items: PlanItem[]
  team: Member[]
}
export type Workspace = { version: 1; plans: Plan[]; songs: Song[] }

export function dateKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
export const parseDate = (date: string) => new Date(date + 'T12:00:00')
export const dateText = (date: string, options: Intl.DateTimeFormatOptions) =>
  parseDate(date).toLocaleDateString('pt-BR', options)
export const planSongs = (plan: Plan, songs: Song[]) =>
  plan.items.flatMap(
    (item) => songs.find((song) => song.id === item.songId) ?? []
  )
export const chronological = (plans: Plan[]) =>
  [...plans].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
