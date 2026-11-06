import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { dailySchedule, scheduleRow, SCHEDULE_COLUMNS } from '../utils/dailySchedule.js'
import { eventDate, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { loadPDFAssets } from './pdfAssets.js'

export async function createDailySchedulePDF({ games, day, sport = '', venue = '', includeCancelled = true, sportName = '' }) {
  const date = eventDate(`${day}T12:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime())) throw new Error('Escolha uma data válida para a programação.')
  const selected = dailySchedule(games, { day, sport, venue, includeCancelled })
  if (!selected.length) throw new Error('Não há partidas nesta seleção para gerar o PDF.')
  const [font, logo] = await loadPDFAssets()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  pdf.addFileToVFS('NotoSans-Regular.ttf', font); pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal'); pdf.setFont('NotoSans')
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, dateStyle: 'full' }).format(date)
  pdf.setProperties({ title: `Programação do Interclasse · ${day}`, author: 'Organização do Interclasse' })
  const image = pdf.getImageProperties(logo)
  const scale = Math.min(42 / image.width, 18 / image.height)
  pdf.addImage(logo, 'PNG', 14, 8, image.width * scale, image.height * scale)
  pdf.setTextColor(170, 15, 25); pdf.setFontSize(16); pdf.text('INTERCLASSE SESI VINHEDO', 62, 15)
  pdf.setTextColor(25, 35, 50); pdf.setFontSize(10); pdf.text(`Programação diária · ${dateLabel}`, 62, 22)
  pdf.setFontSize(8); pdf.text(`${selected.length} partida(s) · ${sportName || 'Todas as modalidades'} · ${venue || 'Todos os locais'}${includeCancelled ? '' : ' · Cancelados ocultos'}`, 14, 31, { maxWidth: 269 })
  autoTable(pdf, { startY: 36, margin: { left: 14, right: 14, top: 14, bottom: 20 }, theme: 'grid', head: [SCHEDULE_COLUMNS], body: selected.map(scheduleRow),
    styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' }, headStyles: { fillColor: [170, 15, 25], fontStyle: 'normal' }, rowPageBreak: 'avoid',
    columnStyles: { 0: { cellWidth: 17 }, 1: { cellWidth: 24 }, 2: { cellWidth: 47 }, 3: { cellWidth: 48 }, 4: { cellWidth: 43 }, 5: { cellWidth: 29 }, 6: { cellWidth: 61 } },
  })
  const pages = pdf.getNumberOfPages()
  const issuedAt = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date())
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setFont('NotoSans'); pdf.setFontSize(7); pdf.setTextColor(90)
    pdf.text('Horários sujeitos a alterações. Confira a programação atualizada no site. Local e coletes são definidos na preparação.', 14, 196)
    pdf.text(`Emitido em ${issuedAt} · Horário de São Paulo`, 14, 202)
    pdf.text(`Página ${page} de ${pages}`, 283, 202, { align: 'right' })
  }
  return { pdf, filename: `programacao-interclasse-${day}.pdf` }
}
