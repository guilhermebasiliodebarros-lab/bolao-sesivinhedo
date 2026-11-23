import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { loadPDFAssets } from './pdfAssets.js'
import { formatNoticeDate } from '../utils/scheduleNotices.js'
import { formatPoints } from '../utils/format.js'
import { schoolDay } from '../utils/tvSchedule.js'

export async function createFinalReportPDF(report) {
  if (!report.total) throw new Error('Não há partidas nesta seleção para gerar o relatório.')
  const [font, logo] = await loadPDFAssets()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  pdf.addFileToVFS('NotoSans-Regular.ttf', font); pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal'); pdf.setFont('NotoSans')
  pdf.setProperties({ title: `Relatório ${report.status} do Interclasse SESI Vinhedo`, author: 'Organização do Interclasse SESI Vinhedo' })
  let y = 37, pendingSections = []
  const width = 269
  const ensure = (space = 25) => { if (y + space > 187) { pdf.addPage(); y = 36 } }
  const section = (title, subtitle = '') => { pendingSections.push({ title, subtitle }) }
  const flushSections = (reserve = 15) => {
    const measured = pendingSections.map(({ title, subtitle }) => {
      pdf.setFont('NotoSans'); pdf.setFontSize(12)
      const lines = pdf.splitTextToSize(title, width)
      pdf.setFontSize(8)
      const detail = subtitle ? pdf.splitTextToSize(subtitle, width) : []
      return { lines, detail, height: lines.length * 5 + 3 + (detail.length ? detail.length * 4 + 3 : 0) }
    })
    ensure(Math.min(151, reserve + measured.reduce((sum, item) => sum + item.height, 0)))
    for (const { lines, detail } of measured) {
      pdf.setTextColor(28, 37, 50); pdf.setFontSize(12); pdf.text(lines, 14, y); y += lines.length * 5 + 3
      if (detail.length) { pdf.setTextColor(92, 102, 116); pdf.setFontSize(8); pdf.text(detail, 14, y); y += detail.length * 4 + 3 }
    }
    pendingSections = []
  }
  const table = (head, body, columns = {}) => {
    pdf.setFont('NotoSans'); pdf.setFontSize(8)
    const height = (row) => Math.max(...row.map((cell, index) => pdf.splitTextToSize(String(cell ?? ''), (columns[index]?.cellWidth || width / head.length) - 4.8).length)) * 3.3 + 4.8
    const rowHeights = [head, ...body].map(height), fullHeight = rowHeights.reduce((sum, item) => sum + item, 0)
    flushSections(fullHeight < 120 ? fullHeight : rowHeights.slice(0, 3).reduce((sum, item) => sum + item, 0))
    if (!body.length) { pdf.setFontSize(9); pdf.setTextColor(92, 102, 116); pdf.text('Sem registros nesta seleção.', 14, y + 3); y += 14; return }
    autoTable(pdf, { startY: y, margin: { top: 34, bottom: 20, left: 14, right: 14 }, head: [head], body, theme: 'grid', rowPageBreak: 'avoid',
      styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 8, cellPadding: 2.4, overflow: 'linebreak', textColor: [28, 37, 50], lineColor: [220, 224, 230], lineWidth: .15 },
      headStyles: { fillColor: [170, 15, 25], textColor: [255, 255, 255], fontStyle: 'normal' }, alternateRowStyles: { fillColor: [247, 248, 250] }, columnStyles: columns,
    })
    y = pdf.lastAutoTable.finalY + 12
  }
  section('Panorama do evento', report.status === 'parcial' ? 'RELATÓRIO PARCIAL: existem partidas pendentes. Somente resultados oficiais concluídos entram nas classificações.' : 'RELATÓRIO FINAL DOS JOGOS CADASTRADOS NESTA SELEÇÃO. Campeões aparecem apenas quando definidos nos registros oficiais.')
  flushSections(41)
  const facts = [[report.total, 'Partidas na seleção'], [report.played, 'Resultados concluídos'], [report.pending, 'Partidas pendentes'], [report.cancelled, 'Cancelamentos']]
  facts.forEach(([value, label], index) => {
    const x = 14 + index * 68
    pdf.setFillColor(247, 248, 250); pdf.setDrawColor(220, 224, 230); pdf.roundedRect(x, y, 65, 29, 2, 2, 'FD')
    pdf.setTextColor(28, 37, 50); pdf.setFontSize(21); pdf.text(String(value), x + 5, y + 13)
    pdf.setTextColor(92, 102, 116); pdf.setFontSize(8); pdf.text(label, x + 5, y + 23)
  }); y += 41
  section('Campeões e definições por competição')
  table(['Modalidade', 'Turno', 'Torneio', 'Campeão / situação'], report.champions.map((row) => [row.sport, row.shift, row.tournament, row.champion || row.situation]), { 0: { cellWidth: 36 }, 1: { cellWidth: 27 }, 2: { cellWidth: 96 }, 3: { cellWidth: 110 } })
  section('Classificação dos professores', 'Apurada no servidor para os jogos da seleção. Pontuação, acertos exatos e acertos de resultado definem a posição. Empates completos compartilham a colocação.')
  table(['Pos.', 'Professor', 'Pontos', 'Exatos', 'Resultados'], report.ranking.map(({ participant, position }) => [`${position}º`, participant.nome, formatPoints(participant.pontos), participant.acertosExatos || 0, participant.acertosResultado || 0]), { 0: { cellWidth: 14 }, 1: { cellWidth: 130 }, 2: { cellWidth: 30 }, 3: { cellWidth: 45 }, 4: { cellWidth: 50 } })
  for (const standing of report.standings) {
    section(`Classificação das equipes · ${standing.sportName} · ${standing.groupName}`, `${standing.tournamentName || 'Torneio'} · Apenas resultados concluídos`)
    table(['Pos.', 'Equipe', 'Pts', 'J', 'V', 'E', 'D', 'Saldo'], standing.rows.map((row, index) => [`${index + 1}º`, row.nome, row.pontos, row.jogos, row.vitorias, row.empates, row.derrotas, row.saldo]), { 0: { cellWidth: 14 }, 1: { cellWidth: 110 }, 2: { cellWidth: 23 }, 3: { cellWidth: 23 }, 4: { cellWidth: 23 }, 5: { cellWidth: 23 }, 6: { cellWidth: 23 }, 7: { cellWidth: 30 } })
  }
  section('Artilharia e pontos por atleta', 'Somente lances com autoria e partidas concluídas. Atletas são identificados pelo primeiro nome e pela equipe. Pontos sem autor não são atribuídos a jogadores.')
  if (!report.athletes.length) table(['Modalidade', 'Atleta', 'Equipe', 'Total'], [])
  for (const sport of report.athletes) {
    section(`${sport.sportName} · ${sport.unit}`)
    table(['Pos.', 'Atleta', 'Equipe', sport.unit, 'Jogos com registro'], sport.rows.map((row) => [`${row.rank}º`, row.name, row.teamName, row.total, row.games]), { 0: { cellWidth: 14 }, 1: { cellWidth: 85 }, 2: { cellWidth: 90 }, 3: { cellWidth: 35 }, 4: { cellWidth: 45 } })
  }
  section('Resultados e situação das partidas', 'Placares pendentes permanecem sem resultado. W.O. e cancelamentos são identificados; W.O. não pontua os palpites dos professores.')
  table(['Data / horário', 'Modalidade', 'Fase / torneio', 'Confronto', 'Placar', 'Situação'], report.results.map((row) => [row.date, row.sport, row.phase, row.match, row.score, row.situation]), { 0: { cellWidth: 33 }, 1: { cellWidth: 30 }, 2: { cellWidth: 60 }, 3: { cellWidth: 89 }, 4: { cellWidth: 24 }, 5: { cellWidth: 33 } })
  const pages = pdf.getNumberOfPages(), properties = pdf.getImageProperties(logo), scale = Math.min(39 / properties.width, 16 / properties.height)
  const filters = [report.labels.sport || 'Todas as modalidades', report.labels.shift || 'Todos os turnos', report.labels.tournament || 'Todos os torneios'].join(' · ')
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFont('NotoSans'); pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, 297, 29, 'F')
    pdf.addImage(logo, 'PNG', 14, 7, properties.width * scale, properties.height * scale, 'interclasse-logo')
    pdf.setTextColor(170, 15, 25); pdf.setFontSize(13); pdf.text('INTERCLASSE SESI VINHEDO', 60, 12)
    pdf.setTextColor(28, 37, 50); pdf.setFontSize(9); pdf.text(`Relatório ${report.status} · ${filters}`, 60, 19, { maxWidth: 222 })
    pdf.setDrawColor(220, 224, 230); pdf.line(14, 28, 283, 28)
    pdf.setTextColor(92, 102, 116); pdf.setFontSize(7)
    pdf.text(`Emitido em ${formatNoticeDate(report.generatedAt)} · Horário de São Paulo`, 14, 198)
    pdf.text('Bolão: 1 ponto pelo resultado + 1 pelo placar/sets exatos. Xadrez: 1 ponto pelo resultado.', 14, 203)
    pdf.text(`Página ${page} de ${pages}`, 283, 203, { align: 'right' })
  }
  return { pdf, pages, filename: `relatorio-interclasse-${report.status}-${schoolDay(report.generatedAt)}.pdf` }
}
