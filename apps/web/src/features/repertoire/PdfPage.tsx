import { useEffect, useRef, useState } from 'react'
import type {
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api'
import { openScore, readScore } from '../../data/scores'

export function PdfPage({
  fileId,
  page,
  onPages,
}: {
  fileId: string
  page: number
  onPages: (total: number) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(true)
  useEffect(() => {
    const element = host.current!
    const resize = () => setWidth(Math.round(element.clientWidth))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let dead = false
    let loaded: PDFDocumentProxy | undefined
    setDocument(undefined)
    setError('')
    onPages(0)
    readScore(fileId)
      .then(openScore)
      .then((pdf) => {
        if (dead) {
          void pdf.destroy()
          return
        }
        loaded = pdf
        setDocument(pdf)
        onPages(pdf.numPages)
      })
      .catch(() => {
        if (!dead)
          setError(
            'Não foi possível abrir esta partitura. Reimporte o PDF na edição da música.'
          )
      })
    return () => {
      dead = true
      if (loaded) void loaded.destroy()
    }
  }, [fileId, onPages])
  useEffect(() => {
    const container = host.current
    if (!document || width < 1 || !container) return
    let dead = false
    let render: RenderTask | undefined
    setRendering(true)
    setError('')
    document
      .getPage(page)
      .then(async (pdfPage) => {
        if (dead) return
        const natural = pdfPage.getViewport({ scale: 1 })
        // Keep memory bounded on high-density phones when a page has an unusual aspect ratio.
        const idealScale =
          (width * Math.min(window.devicePixelRatio || 1, 2)) / natural.width
        const scale = Math.min(
          idealScale,
          4096 / natural.height,
          4096 / natural.width,
          Math.sqrt(6_000_000 / (natural.width * natural.height))
        )
        const viewport = pdfPage.getViewport({ scale })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        canvas.setAttribute('role', 'img')
        canvas.setAttribute('aria-label', 'Página ' + page + ' da partitura')
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas indisponível')
        render = pdfPage.render({ canvasContext: context, viewport })
        await render.promise
        if (!dead) {
          container.replaceChildren(canvas)
          setRendering(false)
        }
      })
      .catch(() => {
        if (!dead) setError('Falha ao exibir esta página do PDF.')
      })
    return () => {
      dead = true
      render?.cancel()
      container.replaceChildren()
    }
  }, [document, page, width])
  return (
    <div className="rep-pdf">
      {error ? (
        <p role="alert" className="rep-error">
          {error}
        </p>
      ) : (
        (!document || rendering) && <p role="status">Abrindo página…</p>
      )}
      <div className="rep-canvas" ref={host} />
    </div>
  )
}
