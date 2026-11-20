import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { Member, Plan, Song } from './model'
import { currentScope } from './online/service'
import { readScore, removeScores, storeScore } from './repertoire/pdfStore'

const format = 'musiccenter.plan'
const MiB = 1024 * 1024
const maxFile = 80 * MiB
const maxPdf = 50 * MiB
const maxRows = 1000
const fileLimit = 'O arquivo do plano pode ter até 80 MB.'
const invalid = 'Este arquivo contém dados de plano inválidos.'

type Score = { name: string; data: string }
type SharedSong = Pick<
  Song,
  'title' | 'artist' | 'key' | 'bpm' | 'meter' | 'chart'
> & { pdf?: Score }
type SharedItem = { title: string; minutes: number; song?: number }
type SharedPlan = Omit<Plan, 'id' | 'items' | 'team'> & {
  items: SharedItem[]
  team: Omit<Member, 'id'>[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(invalid)
  return value as Record<string, unknown>
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > maxRows) throw new Error(invalid)
  return value
}

function text(value: unknown, limit = 1024, allowEmpty = false) {
  if (
    typeof value !== 'string' ||
    value.length > limit ||
    (!allowEmpty && !value.trim())
  )
    throw new Error(invalid)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
    throw new Error(invalid)
  return value
}

function integer(value: unknown, min: number, max: number) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(invalid)
  return value
}

function planFields(plan: Record<string, unknown>) {
  const date = text(plan.date, 10)
  const time = text(plan.time, 5)
  const parsed = new Date(date + 'T12:00:00Z')
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error(invalid)
  return {
    title: text(plan.title),
    date,
    time,
    location: text(plan.location, 1024, true),
  }
}

function memberFields(value: unknown): Omit<Member, 'id'> {
  const member = record(value)
  const status = member.status
  if (status !== 'pending' && status !== 'confirmed' && status !== 'declined')
    throw new Error(invalid)
  return { name: text(member.name), role: text(member.role), status }
}

function songFields(song: Record<string, unknown>): SharedSong {
  const key = text(song.key, 8)
  const meter = text(song.meter, 8)
  if (
    !/^[A-G][#b]?m?$/.test(key) ||
    !/^(?:[1-9]|1[0-6])\/(?:2|4|8|16)$/.test(meter)
  )
    throw new Error(invalid)
  return {
    title: text(song.title),
    artist: text(song.artist, 1024, true),
    key,
    meter,
    bpm: integer(song.bpm, 30, 300),
    chart: text(song.chart, MiB, true),
  }
}

function fileName(value: unknown) {
  return text(value, 1024).split(/[\\/]/).pop()?.trim() || 'Partitura.pdf'
}

function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () =>
      reject(new Error('Não foi possível ler o arquivo no dispositivo.'))
    reader.onload = () => {
      const uri = String(reader.result)
      resolve(uri.slice(uri.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

async function sendFile(blob: Blob, name: string, title: string) {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return
  }

  const destination = { directory: Directory.Cache, path: newId() + '-' + name }
  try {
    // Transfer bounded chunks across the WebView bridge on memory-limited devices.
    const chunkSize = 512 * 1024
    let uri = ''
    for (let start = 0; start < blob.size; start += chunkSize) {
      const data = await base64(blob.slice(start, start + chunkSize))
      if (start === 0)
        uri = (await Filesystem.writeFile({ ...destination, data })).uri
      else await Filesystem.appendFile({ ...destination, data })
    }
    await Share.share({
      files: [uri],
      title,
      dialogTitle: 'Compartilhar plano',
    })
    // Android recipients can read after the sheet closes. The OS manages this cache.
  } catch (error) {
    await Filesystem.deleteFile(destination).catch(() => undefined)
    if (error instanceof Error && /cancel/i.test(error.message))
      throw new Error('Compartilhamento cancelado.')
    throw new Error(
      'Não foi possível compartilhar o arquivo. Verifique o espaço disponível.'
    )
  }
}

export async function sharePlan(plan: Plan, songs: Song[]): Promise<void> {
  if (plan.items.length > maxRows || plan.team.length > maxRows)
    throw new Error('O plano excede o limite de 1.000 itens ou integrantes.')
  const scope = currentScope()
  const linked = [
    ...new Set(
      plan.items.flatMap((item) => (item.songId ? [item.songId] : []))
    ),
  ]
  const library = new Map(songs.map((song) => [song.id, song]))
  const index = new Map(linked.map((id, i) => [id, i]))
  const packedPlan: SharedPlan = {
    ...planFields(plan),
    items: plan.items.map((item) => ({
      title: text(item.title),
      minutes: integer(item.minutes, 0, 1440),
      ...(item.songId ? { song: index.get(item.songId) } : {}),
    })),
    team: plan.team.map(memberFields),
  }
  const packedSongs: SharedSong[] = []
  let used = 0
  for (const id of linked) {
    const song = library.get(id)
    if (!song)
      throw new Error('Uma música do roteiro está ausente no repertório.')
    const packed = songFields(song)
    used += new Blob([packed.chart]).size
    if (used > maxFile) throw new Error(fileLimit)
    if (song.pdfId) {
      let data: ArrayBuffer
      try {
        data = await readScore(song.pdfId, scope)
      } catch {
        throw new Error(
          'Não foi possível ler o PDF da música “' + song.title + '”.'
        )
      }
      if (!data.byteLength || data.byteLength > maxPdf)
        throw new Error('Cada PDF deve ter até 50 MB e conter uma partitura.')
      used += 4 * Math.ceil(data.byteLength / 3)
      if (used > maxFile) throw new Error(fileLimit)
      packed.pdf = {
        name: fileName(song.pdfName || 'Partitura.pdf'),
        data: await base64(new Blob([data])),
      }
    }
    packedSongs.push(packed)
  }
  const blob = new Blob(
    [
      JSON.stringify({
        format,
        version: 1,
        plan: packedPlan,
        songs: packedSongs,
      }),
    ],
    { type: 'application/json' }
  )
  if (blob.size > maxFile) throw new Error(fileLimit)
  const slug = plan.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  await sendFile(blob, (slug || 'plano') + '.musiccenter.json', plan.title)
}

function scoreData(value: unknown): Score {
  const pdf = record(value)
  if (
    typeof pdf.data !== 'string' ||
    !pdf.data.length ||
    pdf.data.length > 4 * Math.ceil(maxPdf / 3)
  )
    throw new Error('PDF ausente ou maior que 50 MB.')
  return { name: fileName(pdf.name), data: pdf.data }
}

function toFile(pdf: Score) {
  const binary = atob(pdf.data)
  if (!binary.length || binary.length > maxPdf) throw new Error(invalid)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], pdf.name, { type: 'application/pdf' })
}

export async function importPlan(
  file: File
): Promise<{ plan: Plan; songs: Song[] }> {
  const scope = currentScope()
  if (file.size > maxFile) throw new Error(fileLimit)
  let raw: Record<string, unknown>
  try {
    raw = record(JSON.parse(await file.text()))
  } catch {
    throw new Error(
      'Escolha um arquivo .musiccenter.json exportado pelo MusicCenter.'
    )
  }
  if (raw.format !== format)
    throw new Error('Escolha um arquivo de plano do MusicCenter.')
  if (raw.version !== 1)
    throw new Error('Esta versão de arquivo ainda não é compatível.')

  const planData = record(raw.plan)
  const pdfs = new Map<string, Score>()
  const songs: Song[] = list(raw.songs).map((value) => {
    const data = record(value)
    const song: Song = { ...songFields(data), id: newId(), notes: '' }
    if (data.pdf !== undefined) {
      const pdf = scoreData(data.pdf)
      song.pdfName = pdf.name
      song.pdfId = newId()
      pdfs.set(song.pdfId, pdf)
    }
    return song
  })
  const referenced = new Set<number>()
  const plan: Plan = {
    ...planFields(planData),
    id: newId(),
    items: list(planData.items).map((value) => {
      const item = record(value)
      const result = {
        id: newId(),
        title: text(item.title),
        minutes: integer(item.minutes, 0, 1440),
      }
      if (item.song === undefined) return result
      const i = integer(item.song, 0, songs.length - 1)
      referenced.add(i)
      return { ...result, songId: songs[i].id }
    }),
    team: list(planData.team).map((value) => ({
      ...memberFields(value),
      id: newId(),
    })),
  }
  if (referenced.size !== songs.length) throw new Error(invalid)
  const saved: string[] = []
  try {
    for (const [id, pdf] of pdfs) {
      await storeScore(toFile(pdf), id, scope)
      saved.push(id)
    }
  } catch {
    await removeScores(saved, scope).catch(() => undefined)
    throw new Error(
      'Falha ao importar as partituras. Verifique os PDFs e o espaço disponível.'
    )
  }
  return { plan, songs }
}
