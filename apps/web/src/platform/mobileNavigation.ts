import { App } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import type { DeviceNavigation } from '../application/deviceNavigation'

export const mobileNavigation: DeviceNavigation = {
  setReaderAppearance(reading) {
    if (Capacitor.isNativePlatform()) {
      void SystemBars.setStyle({
        style: reading ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {})
    }
  },
  onBack(action) {
    if (Capacitor.getPlatform() !== 'android') return () => {}
    const listener = App.addListener('backButton', action)
    return () => {
      void listener.then((handle) => handle.remove())
    }
  },
  exit() {
    void App.exitApp()
  },
}
