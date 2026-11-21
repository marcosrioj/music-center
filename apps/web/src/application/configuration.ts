export type PublicConfig = { url: string; key: string; webUrl?: string }

export interface Configuration {
  native: boolean
  load(): Promise<{
    settings?: PublicConfig
    savedPanel?: string
    failed?: boolean
  }>
  connect(address: string): Promise<PublicConfig>
  activate(settings: PublicConfig): void
}
