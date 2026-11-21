import assert from 'node:assert/strict'
import test from 'node:test'
import { importPlan, sharePlan } from '../src/application/planTransfer.ts'
import { saveSongWithScore } from '../src/application/scoreFiles.ts'
import {
  isChord,
  prefersFlats,
  transpose,
} from '../src/domain/transposition.ts'

const original = {
  id: 'first-song',
  title: 'Canção',
  artist: '',
  key: 'C',
  bpm: 80,
  meter: '4/4',
  chart: '[G]Canto',
  notes: 'anotação pessoal',
  pdfId: 'previous',
  pdfName: 'partitura.pdf',
}
const plan = {
  id: 'old-plan',
  title: 'Ensaio à noite',
  date: '2026-11-20',
  time: '20:00',
  location: '',
  items: [
    { id: 'one', title: 'Abertura', minutes: 3, songId: original.id },
    { id: 'two', title: 'Final', minutes: 4, songId: original.id },
  ],
  team: [{ id: 'member', name: 'Ana', role: 'Voz', status: 'confirmed' }],
}
const scoreBytes = Uint8Array.from([37, 80, 68, 70, 45, 0, 255])

test('transposes roots and slash bass, preserving quality and non-chord text', () => {
  assert.equal(transpose('F♯m7/A♯', 1, true), 'Gm7/B')
  assert.equal(transpose('G7(b9)/B', -1, true), 'Gb7(b9)/Bb')
  assert.equal(transpose('C', -37), 'B')
  assert.equal(transpose('Bbmaj7', 0), 'Bbmaj7')
  assert.equal(transpose('Verso', 7), 'Verso')
  assert.equal(isChord('CΔ7/E'), true)
  assert.equal(isChord('Refrão'), false)
  assert.equal(prefersFlats('Fm'), true)
})

test('replacing a PDF retains shared copies, removes orphaned uploads on a failed save', async () => {
  const events = []
  const repository = {
    store: async (file, id) => {
      events.push(['store', id, file.name])
    },
    remove: async (ids) => {
      events.push(['remove', ...ids])
    },
  }
  const edit = {
    original,
    draft: { ...original },
    file: new File(['bytes'], 'nova.pdf'),
    newId: () => 'next',
    retainPreviousPdf: true,
    persist: async (song) => {
      events.push(['save', song.pdfId, song.pdfName])
    },
  }
  await saveSongWithScore(repository, edit)
  assert.deepEqual(events.splice(0), [
    ['store', 'next', 'nova.pdf'],
    ['save', 'next', 'nova.pdf'],
  ])
  await saveSongWithScore(repository, { ...edit, retainPreviousPdf: false })
  assert.deepEqual(events.splice(0), [
    ['store', 'next', 'nova.pdf'],
    ['save', 'next', 'nova.pdf'],
    ['remove', 'previous'],
  ])
  await assert.rejects(
    saveSongWithScore(repository, {
      ...edit,
      persist() {
        throw new Error('conflito')
      },
    }),
    /conflito/
  )
  assert.deepEqual(events, [
    ['store', 'next', 'nova.pdf'],
    ['remove', 'next'],
  ])
  assert.equal(original.pdfId, 'previous')
})

test('password-protected PDFs fail before saving the song', async () => {
  const repository = {
    async store() {
      throw Object.assign(new Error(), { name: 'PasswordException' })
    },
    async remove() {
      assert.fail('no upload to remove')
    },
  }
  await assert.rejects(
    saveSongWithScore(repository, {
      original,
      draft: original,
      file: new File(['locked'], 'a.pdf'),
      newId: () => 'upload',
      retainPreviousPdf: false,
      persist() {
        assert.fail('not persisted')
      },
    }),
    /sem senha/
  )
})

async function exportFile() {
  let file
  await sharePlan(plan, [original], {
    scores: {
      async read(id) {
        assert.equal(id, 'previous')
        return scoreBytes.buffer
      },
    },
    base64: async (blob) =>
      Buffer.from(await blob.arrayBuffer()).toString('base64'),
    sendFile: async (blob, name, title) => {
      assert.equal(title, plan.title)
      file = new File([blob], name)
    },
  })
  return file
}

test('portable plan round trip deduplicates songs, remaps ids and excludes private notes', async () => {
  const file = await exportFile()
  assert.equal(file.name, 'Ensaio-a-noite.musiccenter.json')
  const raw = JSON.parse(await file.text())
  assert.equal(raw.songs.length, 1)
  assert.equal(Object.hasOwn(raw.songs[0], 'notes'), false)
  const saved = []
  const repository = {
    async store(pdf, id) {
      saved.push([id, pdf.name, new Uint8Array(await pdf.arrayBuffer())])
    },
    async remove() {
      assert.fail('unexpected rollback')
    },
  }
  let next = 0
  const result = await importPlan(file, repository, () => 'new-' + ++next)
  assert.notEqual(result.plan.id, plan.id)
  assert.equal(result.songs[0].notes, '')
  assert.notEqual(result.songs[0].id, original.id)
  assert.deepEqual(
    result.plan.items.map((i) => i.songId),
    [result.songs[0].id, result.songs[0].id]
  )
  assert.deepEqual(saved, [
    [result.songs[0].pdfId, original.pdfName, scoreBytes],
  ])
})

test('import rolls back PDFs already stored if the next upload fails', async () => {
  const raw = JSON.parse(await (await exportFile()).text())
  raw.songs.push({ ...raw.songs[0], title: 'Final' })
  raw.plan.items[1].song = 1
  let next = 0
  let first
  const removed = []
  const repository = {
    async store(_file, id) {
      if (first) throw new Error('interrupted')
      first = id
    },
    async remove(ids) {
      removed.push(...ids)
    },
  }
  const file = new File([JSON.stringify(raw)], 'plano.musiccenter.json')
  await assert.rejects(
    importPlan(file, repository, () => 'new-' + ++next),
    /Falha ao importar/
  )
  assert.deepEqual(removed, [first])
})
