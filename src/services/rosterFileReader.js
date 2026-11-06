import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url'

function pdfLines(items) {
  const lines = []
  let line = ''; let previousY = null; let previousEnd = 0
  items.forEach((item) => {
    if (typeof item.str !== 'string') return
    const [,,,, x, y] = item.transform
    if (previousY !== null && Math.abs(y - previousY) > 3) { if (line.trim()) lines.push(line.trim()); line = ''; previousEnd = 0 }
    if (line) line += x - previousEnd > 25 ? '\t' : ' '
    line += item.str
    previousY = y; previousEnd = x + (item.width || 0)
    if (item.hasEOL) { if (line.trim()) lines.push(line.trim()); line = ''; previousY = null; previousEnd = 0 }
  })
  if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}

export async function readRosterFile(file, { onProgress = () => {}, signal } = {}) {
  if (!file || file.size > 15 * 1024 * 1024) throw new Error('Selecione um arquivo de até 15 MB.')
  signal?.throwIfAborted()
  const extension = file.name.split('.').at(-1).toLowerCase()
  const buffer = await file.arrayBuffer()
  if (extension === 'txt') {
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), ocr: false } }
    catch { return { text: new TextDecoder('windows-1252').decode(buffer), ocr: false } }
  }
  if (extension === 'doc') throw new Error('Salve o documento como Word (.docx) antes de importar.')
  if (extension === 'docx') {
    onProgress('Lendo o documento do Word…')
    const module = await import('mammoth')
    const mammoth = module.default || module
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
    signal?.throwIfAborted()
    const document = new DOMParser().parseFromString(result.value, 'text/html')
    const lines = []
    document.querySelectorAll('p, tr').forEach((element) => {
      if (element.tagName === 'TR') lines.push([...element.querySelectorAll('td, th')].map((cell) => cell.textContent.trim()).join('\t'))
      else if (!element.closest('table')) lines.push(element.textContent)
    })
    return { text: lines.join('\n'), ocr: false }
  }
  if (extension !== 'pdf') throw new Error('Use Word (.docx), PDF ou arquivo de texto (.txt).')
  onProgress('Lendo o PDF…')
  const pdf = await import('pdfjs-dist')
  pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdf.getDocument({ data: buffer, isEvalSupported: false, useSystemFonts: true })
  const document = await loadingTask.promise
  let worker
  let usedOcr = false
  let cleanupTask
  let workerCleanupTask
  const stop = () => { cleanupTask ??= loadingTask.destroy(); if (worker) workerCleanupTask ??= worker.terminate() }
  signal?.addEventListener('abort', stop, { once: true })
  try {
    if (document.numPages > 20) throw new Error('Divida o PDF em arquivos de até 20 páginas.')
    const pages = []
    for (let index = 1; index <= document.numPages; index += 1) {
      signal?.throwIfAborted()
      onProgress(`Lendo página ${index} de ${document.numPages}…`)
      const page = await document.getPage(index)
      const content = await page.getTextContent()
      let text = pdfLines(content.items)
      if (!text.trim()) {
        usedOcr = true
        onProgress(`Reconhecendo os nomes da página ${index}…`)
        if (!worker) {
          const { createWorker } = await import('tesseract.js')
          worker = await createWorker('por', 1, { workerPath: ocrWorkerUrl, corePath: '/ocr/tesseract-core-lstm.wasm.js', langPath: '/ocr', gzip: false, logger: (message) => {
            if (message.status === 'recognizing text') onProgress(`Reconhecendo página ${index}: ${Math.round(message.progress * 100)}%`)
          } })
        }
        signal?.throwIfAborted()
        const viewport = page.getViewport({ scale: 2 })
        if (viewport.width * viewport.height > 25000000) throw new Error('Esta página é muito grande. Exporte o PDF em tamanho A4 e tente novamente.')
        const canvas = globalThis.document.createElement('canvas')
        canvas.width = viewport.width; canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        text = (await worker.recognize(canvas)).data.text
        canvas.width = 0; canvas.height = 0
      }
      pages.push(text)
    }
    return { text: pages.join('\n'), ocr: usedOcr }
  } finally {
    signal?.removeEventListener('abort', stop)
    await (cleanupTask ?? loadingTask.destroy())
    if (worker) await (workerCleanupTask ?? worker.terminate())
  }
}
