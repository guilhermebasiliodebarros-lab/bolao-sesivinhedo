import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { normalizeRegulation, REGULATION_SECTIONS } from '../utils/regulations.js'
import { formatDateTime } from '../utils/format.js'
import { loadPDFAssets } from './pdfAssets.js'

export async function createRegulationsPDF({ sports }) {
  const selected = sports.map((sport) => ({ ...sport, regulation: normalizeRegulation(sport.regulation) })).filter((sport) => Object.values(sport.regulation).some(Boolean))
  if (!selected.length) throw new Error('Cadastre e salve um regulamento antes de baixar o PDF.')
  const [font, logo] = await loadPDFAssets()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  pdf.addFileToVFS('NotoSans-Regular.ttf', font)
  pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  pdf.setFont('NotoSans')
  pdf.setProperties({ title: 'Regulamentos do Interclasse', author: 'Organização do Interclasse' })
  const image = pdf.getImageProperties(logo)
  const scale = Math.min(42 / image.width, 17 / image.height)
  selected.forEach((sport, index) => {
    if (index) pdf.addPage()
    pdf.addImage(logo, 'PNG', 14, 9, image.width * scale, image.height * scale)
    pdf.setTextColor(160, 15, 25); pdf.setFontSize(15)
    pdf.text('INTERCLASSE SESI VINHEDO', 62, 17)
    pdf.setTextColor(25, 35, 50); pdf.setFontSize(12)
    const title = pdf.splitTextToSize(`Regulamento · ${sport.nome}`, 182)
    pdf.text(title, 14, 35)
    let startY = 35 + title.length * 6
    if (sport.regulationUpdatedAt) {
      pdf.setFontSize(8)
      pdf.text(`Atualizado em ${formatDateTime(sport.regulationUpdatedAt)} · versão ${sport.regulationRevision || 1}`, 14, startY)
      startY += 7
    }
    autoTable(pdf, {
      startY, margin: { left: 14, right: 14, top: 20, bottom: 22 }, theme: 'plain',
      body: REGULATION_SECTIONS.filter(({ id }) => sport.regulation[id]).flatMap(({ id, label }) => [
        [{ content: label, styles: { fillColor: [245, 238, 238], textColor: [145, 15, 25], fontSize: 11 } }],
        [sport.regulation[id]],
      ]),
      styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
      rowPageBreak: 'auto',
      didDrawPage: ({ pageNumber }) => {
        if (pageNumber > 1) {
          pdf.setFontSize(8); pdf.setTextColor(90)
          pdf.text(`Interclasse · ${sport.nome}`, 14, 12, { maxWidth: 182 })
        }
      },
    })
  })
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setFont('NotoSans'); pdf.setFontSize(8); pdf.setTextColor(90)
    pdf.text('Regulamento cadastrado pela organização. Consulte a versão atualizada no site.', 14, 282)
    pdf.text(`Página ${page} de ${pages}`, 196, 289, { align: 'right' })
  }
  return { pdf, filename: 'regulamentos-interclasse.pdf' }
}
