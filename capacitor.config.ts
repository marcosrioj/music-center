import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.musiccenter.mobile',
  appName: 'MusicCenter',
  webDir: 'dist',
  backgroundColor: '#f6f7f3',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#f6f7f3' },
}
export default config
