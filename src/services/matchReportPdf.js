import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { getMatchCondition, getMatchLabel, getMatchState, getWalkoverWinnerName, MATCH_STATE } from '../utils/match.js'
import { eventDate } from '../utils/tvSchedule.js'
import { formatSportScore, scoreLabel } from '../utils/sportRules.js'
import { normalizeMatchReportInput } from '../utils/matchReport.js'
import { currentAttendance, ATTENDANCE_LABELS } from '../utils/attendance.js'
import { tieBreakSummary } from '../utils/tieBreak.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { loadPDFAssets } from './pdfAssets.js'

const schoolTime = (value) => {
  const date = eventDate(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(date) : 'A definir'
}

export async function createMatchReportPDF({ game, report: value, playersA = [], playersB = [], attendance: attendanceValue, includePlayers = true }) {
  const report = normalizeMatchReportInput(value)
  const attendance = currentAttendance(game, attendanceValue)
  const [font, logo] = await loadPDFAssets()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  pdf.addFileToVFS('NotoSans-Regular.ttf', font)
  pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  pdf.setFont('NotoSans')
  pdf.setProperties({ title: `Súmula · ${game.timeA} × ${game.timeB}`, subject: 'Interclasse SESI Vinhedo', author: 'Organização do Interclasse' })
  const image = pdf.getImageProperties(logo)
  const scale = Math.min(42 / image.width, 18 / image.height)
  pdf.addImage(logo, 'PNG', 14, 10, image.width * scale, image.height * scale)
  pdf.setFontSize(15); pdf.setTextColor(170, 15, 25); pdf.text('INTERCLASSE SESI VINHEDO', 62, 16)
  pdf.setTextColor(25, 35, 50); pdf.setFontSize(12); pdf.text('Súmula da partida', 62, 24)
  const table = (options) => autoTable(pdf, { theme: 'grid', margin: { left: 14, right: 14, top: 16, bottom: 20 }, styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' }, headStyles: { fillColor: [170, 15, 25], fontStyle: 'normal' }, ...options })
  const nextY = () => (pdf.lastAutoTable?.finalY || 32) + 7
  table({ startY: 34, body: [
    ['Modalidade', game.esporteNome || 'A definir'], ['Torneio / fase', [game.tournamentName, game.fase, game.groupName, game.rodada].filter(Boolean).join(' · ') || 'A definir'],
    ['Equipes', `${game.timeA} × ${game.timeB}`], ['Horário programado', schoolTime(game.dataHora)], ['Local / área', matchVenueLabel(game) || 'A definir'],
    ['Coletes', `${game.timeA}: ${game.vestA || 'a definir'} · ${game.timeB}: ${game.vestB || 'a definir'}`], ['Situação', getMatchLabel(game)],
    ...(game.startedAt ? [['Início registrado', schoolTime(game.startedAt)]] : []), ...(game.endedAt ? [['Término registrado', schoolTime(game.endedAt)]] : []),
    ...(game.conditionReason ? [['Motivo / alteração', game.conditionReason]] : []),
    ...(attendance ? [['Presença das equipes', `${game.timeA}: ${ATTENDANCE_LABELS[attendance.A.status]} · ${game.timeB}: ${ATTENDANCE_LABELS[attendance.B.status]}`], ['Conferência de presença', schoolTime(attendance.checkedAt)]] : []),
    ...(attendance?.responsible ? [['Responsável pela partida', attendance.responsible]] : []),
  ], columnStyles: { 0: { cellWidth: 43 } } })
  const condition = getMatchCondition(game)
  const state = getMatchState(game)
  const knownScore = Number.isFinite(game.placarA) && Number.isFinite(game.placarB)
  let result = state === MATCH_STATE.LIVE ? `Parcial: ${formatSportScore(game.liveScoreA ?? 0)} × ${formatSportScore(game.liveScoreB ?? 0)}` : state === MATCH_STATE.FINISHED && knownScore ? `${formatSportScore(game.placarA)} × ${formatSportScore(game.placarB)}` : 'Sem placar final'
  if (condition === 'walkover') result = `${getWalkoverWinnerName(game)} vence por W.O.${knownScore ? ` · Placar regulamentar: ${formatSportScore(game.placarA)} × ${formatSportScore(game.placarB)}` : ' · Sem placar regulamentar informado'}`
  table({ startY: nextY(), head: [['Resultado', scoreLabel(game)]], body: [[result, '']], columnStyles: { 0: { cellWidth: 145 } } })
  if (getMatchCondition(game) === 'normal' && game.tieBreak) table({ startY: nextY(), head: [['Desempate do mata-mata']], body: [[`${tieBreakSummary(game)}. Registrado separadamente do placar do tempo normal.`]] })
  if (game.setScores?.length) table({ startY: nextY(), head: [['Set', game.timeA, game.timeB]], body: game.setScores.map((set, index) => [String(index + 1), String(set.a), String(set.b)]) })
  if (includePlayers) {
    for (const [side, current] of [['A', playersA], ['B', playersB]]) {
      const name = game[`time${side}`]
      const players = attendance?.[side]?.players || current
      table({ startY: nextY(), head: [[`Jogadores · ${name}`, 'Posição / capitão', 'Presença']], body: players.length ? players.map((player) => [player.nome, [player.posicao, player.capitao ? 'Capitão' : ''].filter(Boolean).join(' · '), attendance ? ATTENDANCE_LABELS[player.status] || 'Não conferido' : '']) : [['Elenco não cadastrado', '', '']], columnStyles: { 0: { cellWidth: 90 }, 2: { cellWidth: 25 } } })
    }
  }
  table({ startY: nextY(), head: [['Observações da organização']], body: [[report.notes || '\n\n\n\n']], rowPageBreak: 'avoid' })
  table({ startY: nextY(), head: [['Responsável', 'Nome', 'Assinatura']], body: [ ['Arbitragem', report.referee, '\n\n'], [game.timeA, report.responsibleA, '\n\n'], [game.timeB, report.responsibleB, '\n\n'] ], columnStyles: { 0: { cellWidth: 43 }, 2: { cellWidth: 60 } } })
  const count = pdf.getNumberOfPages()
  for (let page = 1; page <= count; page += 1) {
    pdf.setPage(page); pdf.setFont('NotoSans'); pdf.setFontSize(7); pdf.setTextColor(90)
    pdf.text(`Organização do Interclasse · Emitido em ${schoolTime(new Date())}`, 14, 286)
    pdf.text(`Página ${page} de ${count}`, 196, 286, { align: 'right' })
  }
  const safeName = `${game.esporteNome}-${game.timeA}-${game.timeB}-${game.id}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 120)
  return { pdf, filename: `sumula-${safeName}.pdf` }
}
