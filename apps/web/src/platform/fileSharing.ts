import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

import { newFileId } from './fileIds'

export function base64(blob: Blob) {
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

export async function sendFile(blob: Blob, name: string, title: string) {
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

  const destination = {
    directory: Directory.Cache,
    path: newFileId() + '-' + name,
  }
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
