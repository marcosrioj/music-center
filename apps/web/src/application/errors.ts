export class WorkspaceError extends Error {
  readonly kind: 'conflict' | 'denied' | 'other'

  constructor(kind: WorkspaceError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

export const isDenied = (error: unknown) =>
  error instanceof WorkspaceError && error.kind === 'denied'

export const isConflict = (error: unknown) =>
  error instanceof WorkspaceError && error.kind === 'conflict'
