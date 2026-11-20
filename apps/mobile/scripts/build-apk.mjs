import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const android = fileURLToPath(new URL('../android/', import.meta.url))
const delivery = fileURLToPath(new URL('../../../entrega/', import.meta.url))
const windows = process.platform === 'win32'
const gradle = windows ? 'gradlew.bat' : './gradlew'
const result = spawnSync(gradle, ['assembleDebug'], {
  cwd: android,
  stdio: 'inherit',
  shell: windows,
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

const apk = path.join(android, 'app/build/outputs/apk/debug/app-debug.apk')
const target = path.join(delivery, 'MusicCenter-Android.apk')
await mkdir(delivery, { recursive: true })
const temporary = await mkdtemp(path.join(delivery, '.apk-'))
try {
  const pending = path.join(temporary, 'MusicCenter-Android.apk')
  await copyFile(apk, pending)
  await rename(pending, target)
  console.log(target)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
