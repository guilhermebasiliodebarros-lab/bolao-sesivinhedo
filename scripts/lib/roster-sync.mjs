import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { SCHOOL_CLASSES, schoolClassCode, schoolClassTeamId } from '../../src/utils/schoolClasses.js'
import { normalizePlayerInput } from '../../src/utils/player.js'
import { nameKey } from '../../src/utils/rosterImport.js'
import { getSportProfile } from '../../src/utils/sportRules.js'
import { isSportAvailable } from '../../src/utils/sportAvailability.js'

export const REGISTRATION_SPORTS = {
  basquete: { nome: 'Basquete', aliases: ['basquete', 'basquete 3x3'] },
  volei: { nome: 'Vôlei', aliases: ['volei', 'volei misto', 'voleibol'] },
  handebol: { nome: 'Handebol', aliases: ['handebol', 'handebol feminino'] },
  futsal: { nome: 'Futsal', aliases: ['futsal', 'futebol', 'futesal'] },
  mancala: { nome: 'Mancala', aliases: ['mancala'] },
  futmesa: { nome: 'Futmesa', aliases: ['futmesa'] },
  'tenis-mesa': { nome: 'Tênis de Mesa', aliases: ['tenis de mesa', 'tenis mesa'] },
  xadrez: { nome: 'Xadrez', aliases: ['xadrez'] },
  fifa: { nome: 'FIFA', aliases: ['fifa'], scoringMode: 'goals' },
  rpg: { nome: 'RPG', aliases: ['rpg'], scoringMode: 'points' },
}
const classFor = (code) => SCHOOL_CLASSES.find((item) => item.code === code)
const exactlyOne = (items, description) => { if (items.length > 1) throw new Error(`Cadastros duplicados para ${description}. Revise antes de importar.`); return items[0] }
const safeId = (value) => createHash('sha256').update(value).digest('hex').slice(0, 32)

export function buildRosterSyncPlan({ sports, teams, players }, manifest) {
  if (manifest?.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.source?.sha256 || '') || !manifest.source?.file || !Array.isArray(manifest.groups) || !manifest.groups.length) throw new Error('Manifesto de inscrições inválido.')
  const changes = [], selectedSports = new Map(), expectedPlayers = [], selectedGroups = new Set()
  const allTeams = [...teams], selectedClasses = new Set()
  let total = 0, starters = 0, reserves = 0
  for (const group of manifest.groups) {
    const definition = REGISTRATION_SPORTS[group.sport], schoolClass = classFor(group.classCode)
    if (!definition || !schoolClass || !Array.isArray(group.players) || group.players.length > 200 || !Array.isArray(group.sourcePages) || group.sourcePages.some((page) => !Number.isInteger(page) || page < 1)) throw new Error('Turma, modalidade ou lista de jogadores inválida no manifesto.')
    const groupKey = `${group.sport}/${group.classCode}`
    if (selectedGroups.has(groupKey)) throw new Error('A mesma turma e modalidade aparecem duas vezes no manifesto.')
    selectedGroups.add(groupKey)
    if (!isSportAvailable(definition, schoolClass.turno)) continue
    selectedClasses.add(group.classCode)
    if (!selectedSports.has(group.sport)) {
      const current = exactlyOne(sports.filter((sport) => definition.aliases.includes(nameKey(sport.nome))), definition.nome)
      const sport = current || { id: `inscricao-2026-${group.sport}`, nome: definition.nome, ...getSportProfile(definition), schoolClassesVersion: 1 }
      if (!current) {
        if (sports.some((item) => item.id === sport.id)) throw new Error('O identificador da nova modalidade já está em uso.')
        const { id, ...data } = sport
        changes.push({ path: `sports/${id}`, type: 'create', fields: data })
        for (const { code, ...info } of SCHOOL_CLASSES.filter((item) => isSportAvailable(sport, item.turno))) {
          const team = { id: schoolClassTeamId(id, code), ...info, sportId: id, esporteNome: sport.nome, playerCount: 0 }
          if (teams.some((item) => item.id === team.id)) throw new Error('O identificador da nova equipe já está em uso.')
          const { id: teamId, ...data } = team
          allTeams.push(team); changes.push({ path: `teams/${teamId}`, type: 'create', fields: data })
        }
      }
      selectedSports.set(group.sport, sport)
    }
    const sport = selectedSports.get(group.sport)
    const team = exactlyOne(allTeams.filter((item) => item.sportId === sport.id && (schoolClassCode(item.turma) || schoolClassCode(item.nome)) === schoolClass.code), `${schoolClass.nome} / ${sport.nome}`)
    if (!team) throw new Error(`Equipe não encontrada: ${schoolClass.nome} / ${sport.nome}.`)
    const existing = players.filter((player) => player.teamId === team.id), seen = new Set()
    let added = 0, changed = false
    for (const incoming of group.players) {
      const normalized = normalizePlayerInput(incoming), key = nameKey(normalized.nome)
      if (seen.has(key)) throw new Error('O mesmo jogador aparece duas vezes na lista da mesma equipe.')
      seen.add(key)
      const current = exactlyOne(existing.filter((item) => nameKey(item.nome) === key), 'jogador da equipe')
      const playerId = current?.id || `inscricao-${safeId(key)}`, path = `teams/${team.id}/players/${playerId}`
      if (!current && existing.some((item) => item.id === playerId)) throw new Error('O identificador de um jogador já está em uso.')
      const desired = { nome: normalized.nome, posicao: normalized.posicao, registrationSource: { sha256: manifest.source.sha256, file: manifest.source.file, pages: group.sourcePages } }
      const fields = current ? Object.fromEntries(Object.entries(desired).filter(([key, value]) => !isDeepStrictEqual(current[key], value))) : { ...desired, capitao: false }
      if (Object.keys(fields).length) {
        changes.push({ path, type: current ? 'update' : 'create', fields }); changed = true
        if (!current) added++
      }
      expectedPlayers.push({ path, ...desired })
      total++; if (normalized.posicao === 'Reserva') reserves++; else starters++
    }
    const playerCount = existing.length + added
    const creation = changes.find((item) => item.path === `teams/${team.id}` && item.type === 'create')
    if (creation) creation.fields.playerCount = playerCount
    else if (changed || (group.players.length && team.playerCount !== playerCount)) changes.push({ path: `teams/${team.id}`, type: 'update', fields: { playerCount } })
  }
  return { changes, expectedPlayers, summary: { classes: selectedClasses.size, sports: selectedSports.size, players: total, starters, reserves, createSports: changes.filter((item) => /^sports\//.test(item.path) && item.type === 'create').length, createTeams: changes.filter((item) => /^teams\/[^/]+$/.test(item.path) && item.type === 'create').length, createPlayers: changes.filter((item) => item.path.includes('/players/') && item.type === 'create').length, updatePlayers: changes.filter((item) => item.path.includes('/players/') && item.type === 'update').length, updateTeams: changes.filter((item) => /^teams\/[^/]+$/.test(item.path) && item.type === 'update').length } }
}
