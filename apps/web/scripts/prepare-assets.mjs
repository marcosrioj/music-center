// Keep PDF fallback fonts and Adobe character maps available in the native app without network access.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const modules = fileURLToPath(new URL('../../../node_modules/', import.meta.url))
const output = join(root, 'public/vendor')
await mkdir(output, { recursive: true })
for (const folder of ['cmaps', 'standard_fonts']) {
  await cp(join(modules, 'pdfjs-dist', folder), join(output, folder), {
    recursive: true,
  })
}
const packages = [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  '@fontsource-variable/dm-sans',
  'pdfjs-dist',
  '@capacitor/core',
  ...['@capacitor/android', '@capacitor/ios'].filter((name) =>
    existsSync(join(modules, name))
  ),
  '@capacitor/app',
  '@capacitor/preferences',
  '@capacitor/filesystem',
  '@capacitor/share',
  '@supabase/supabase-js',
  '@supabase/auth-js',
  '@supabase/postgrest-js',
  '@supabase/storage-js',
  '@supabase/functions-js',
  '@supabase/realtime-js',
  '@supabase/phoenix',
  'iceberg-js',
  'tslib',
]
const licenses = await Promise.all(
  packages.map(async (name) => {
    const filename =
      name === 'tslib'
        ? 'LICENSE.txt'
        : name === '@supabase/phoenix'
          ? 'LICENSE.md'
          : 'LICENSE'
    const license = await readFile(join(modules, name, filename), 'utf8')
    return name + '\n\n' + license
  })
)
await writeFile(join(output, 'LICENSES.txt'), licenses.join('\n\n'))
