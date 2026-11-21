export interface DeviceNavigation {
  setReaderAppearance(reading: boolean): void
  onBack(action: () => void): () => void
  exit(): void
}
