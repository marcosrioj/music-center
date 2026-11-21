import type { Workspace, Plan, Song } from '../domain/workspace'
import {
  withNotes,
  publicWorkspace,
  type Notes,
  type Scope,
  type Snapshot,
} from '../domain/space.ts'
import { isConflict } from './errors.ts'
import type { WorkspaceServices } from './workspaces'

type SessionRepository = Pick<
  WorkspaceServices,
  | 'revision'
  | 'fetchSnapshot'
  | 'saveSnapshot'
  | 'readNotes'
  | 'writeNote'
  | 'sameScope'
  | 'deleteScores'
>

// One editor session owns the revision queue and private notes for one user and space.
export class WorkspaceSession {
  private revision: number
  private notes: Notes
  private workspace: Workspace
  private writes = Promise.resolve()
  private listeners = new Set<() => void>()
  private readonly repository: SessionRepository
  private readonly scope: Scope

  constructor(
    repository: SessionRepository,
    scope: Scope,
    initial: Snapshot,
    notes: Notes
  ) {
    this.repository = repository
    this.scope = scope
    this.revision = initial.revision
    this.notes = notes
    this.workspace = withNotes(initial.workspace, notes)
  }

  current = () => this.workspace

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(workspace: Workspace) {
    this.workspace = withNotes(workspace, this.notes)
    for (const notify of this.listeners) notify()
  }

  apply(snapshot: Snapshot) {
    if (
      !this.repository.sameScope(this.scope) ||
      snapshot.revision < this.revision
    )
      return
    this.revision = snapshot.revision
    this.publish(snapshot.workspace)
  }

  async refresh() {
    if ((await this.repository.revision(this.scope.space)) > this.revision) {
      this.apply(await this.repository.fetchSnapshot(this.scope.space))
    }
  }

  async refreshNotes() {
    const previous = this.notes
    const notes = await this.repository.readNotes(this.scope)
    if (
      this.repository.sameScope(this.scope) &&
      this.notes === previous &&
      JSON.stringify(previous) !== JSON.stringify(notes)
    ) {
      this.notes = notes
      this.publish(this.workspace)
    }
  }

  private commit(update: (current: Workspace) => Workspace) {
    const revision = this.revision
    const task = this.writes.then(async () => {
      if (
        this.scope.space.role !== 'admin' ||
        !this.repository.sameScope(this.scope)
      )
        throw new Error('Apenas a administração deste espaço pode editar.')
      if (revision !== this.revision)
        throw new Error(
          'Os dados mudaram. Revise o conteúdo antes de salvar novamente.'
        )
      try {
        this.apply(
          await this.repository.saveSnapshot(
            this.scope.space,
            revision,
            publicWorkspace(update(this.workspace))
          )
        )
      } catch (error) {
        if (isConflict(error))
          this.apply(await this.repository.fetchSnapshot(this.scope.space))
        throw error
      }
    })
    this.writes = task.catch(() => {})
    return task
  }

  savePlan(plan: Plan) {
    return this.commit((workspace) => ({
      ...workspace,
      plans: upsert(workspace.plans, plan),
    }))
  }

  saveSong(song: Song) {
    return this.commit((workspace) => ({
      ...workspace,
      songs: upsert(workspace.songs, song),
    }))
  }

  deletePlan(id: string) {
    return this.commit((workspace) => ({
      ...workspace,
      plans: workspace.plans.filter((plan) => plan.id !== id),
    }))
  }

  async deleteSong(id: string) {
    let pdfId: string | undefined
    await this.commit((workspace) => {
      const plan = workspace.plans.find((p) =>
        p.items.some((item) => item.songId === id)
      )
      if (plan)
        throw new Error(
          'Remova a música do roteiro “' + plan.title + '” antes de excluí-la.'
        )
      pdfId = workspace.songs.find((song) => song.id === id)?.pdfId
      return {
        ...workspace,
        songs: workspace.songs.filter((song) => song.id !== id),
      }
    })
    if (pdfId && !this.workspace.songs.some((song) => song.pdfId === pdfId)) {
      await this.repository.deleteScores(this.scope, [pdfId]).catch(() => {})
    }
  }

  async addImportedPlan(plan: Plan, songs: Song[]) {
    try {
      await this.commit((workspace) => ({
        ...workspace,
        plans: [...workspace.plans, plan],
        songs: [...workspace.songs, ...songs],
      }))
    } catch (error) {
      await this.repository
        .deleteScores(
          this.scope,
          songs.flatMap((s) => (s.pdfId ? [s.pdfId] : []))
        )
        .catch(() => {})
      throw error
    }
  }

  async saveNote(song: Song, previous: string) {
    if (!this.repository.sameScope(this.scope))
      throw new Error('A sessão mudou.')
    try {
      await this.repository.writeNote(this.scope, song.id, song.notes, previous)
    } catch (error) {
      if (isConflict(error) && this.repository.sameScope(this.scope)) {
        await this.refreshNotes()
        throw new Error(
          'Sua anotação mudou em outra sessão. Copie seu rascunho e reabra a anotação para revisar a versão atual.'
        )
      }
      throw error
    }
    if (this.repository.sameScope(this.scope)) {
      this.notes = { ...this.notes, [song.id]: song.notes }
      this.publish(this.workspace)
    }
  }
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item]
}
